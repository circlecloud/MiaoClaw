use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tokio::sync::mpsc;

use super::provider::*;

/// Codex OAuth 常量 (与 OpenAI Codex CLI 一致)
const AUTH_URL: &str = "https://auth.openai.com/authorize";
const TOKEN_URL: &str = "https://auth.openai.com/oauth/token";
const CLIENT_ID: &str = "DJvkhBIkFdITpUCLNXbfn";
const AUDIENCE: &str = "https://api.openai.com/v1";
const REDIRECT_PORT: u16 = 18457;
const SCOPE: &str = "openid profile email offline_access";
const API_BASE: &str = "https://api.openai.com";

/// Codex OAuth Token
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CodexToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<u64>,
}

/// Codex Provider - 通过 ChatGPT Plus/Pro 订阅的 OAuth 授权使用 OpenAI 模型
pub struct CodexProvider {
    client: Client,
    token: Arc<RwLock<Option<CodexToken>>>,
}

impl CodexProvider {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            token: Arc::new(RwLock::new(None)),
        }
    }

    /// 从已保存的 token 恢复
    pub fn with_token(token: CodexToken) -> Self {
        Self {
            client: Client::new(),
            token: Arc::new(RwLock::new(Some(token))),
        }
    }

    /// 获取当前 token
    pub fn get_token(&self) -> Option<CodexToken> {
        self.token.read().unwrap().clone()
    }

    /// 设置 token
    pub fn set_token(&self, token: CodexToken) {
        *self.token.write().unwrap() = Some(token);
    }

    /// 生成 PKCE code_verifier 和 code_challenge
    fn generate_pkce() -> (String, String) {
        use base64::Engine;
        use sha2::Digest;

        let mut buf = [0u8; 32];
        rand::fill(&mut buf);
        let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf);

        let mut hasher = sha2::Sha256::new();
        hasher.update(verifier.as_bytes());
        let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(hasher.finalize());

        (verifier, challenge)
    }

    /// 启动 OAuth 登录流程：打开浏览器 → 本地回调服务器接收 code → 换 token
    pub fn start_oauth_login(&self) -> Result<CodexToken, AIError> {
        let (verifier, challenge) = Self::generate_pkce();

        let state: String = {
            let mut buf = [0u8; 16];
            rand::fill(&mut buf);
            hex::encode(&buf)
        };

        let redirect_uri = format!("http://localhost:{}/callback", REDIRECT_PORT);

        let auth_url = format!(
            "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&audience={}&code_challenge={}&code_challenge_method=S256&state={}",
            AUTH_URL,
            CLIENT_ID,
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(SCOPE),
            urlencoding::encode(AUDIENCE),
            challenge,
            state,
        );

        // 打开浏览器
        let _ = open::that(&auth_url);

        // 启动本地 HTTP 服务器等待回调
        let server = tiny_http::Server::http(
            format!("127.0.0.1:{}", REDIRECT_PORT)
        ).map_err(|e| AIError::ApiError(format!("无法启动回调服务器: {}", e)))?;

        tracing::info!("等待 Codex OAuth 回调...");

        let request = server
            .recv()
            .map_err(|e| AIError::ApiError(format!("等待回调失败: {}", e)))?;

        let url = request.url().to_string();
        let response = tiny_http::Response::from_string(
            "<html><body><h2>授权成功！你可以关闭此页面。</h2></body></html>"
        ).with_header(
            "Content-Type: text/html; charset=utf-8"
                .parse::<tiny_http::Header>()
                .unwrap(),
        );
        let _ = request.respond(response);

        // 解析 code
        let code = url
            .split('?')
            .nth(1)
            .and_then(|q| {
                q.split('&').find_map(|p| {
                    let mut kv = p.splitn(2, '=');
                    if kv.next() == Some("code") {
                        kv.next().map(|v| v.to_string())
                    } else {
                        None
                    }
                })
            })
            .ok_or_else(|| AIError::ApiError("回调中未找到 code 参数".into()))?;

        // 用 code 换 token (同步)
        let token = self.exchange_code_blocking(&code, &verifier, &redirect_uri)?;
        self.set_token(token.clone());
        Ok(token)
    }

    fn exchange_code_blocking(
        &self,
        code: &str,
        verifier: &str,
        redirect_uri: &str,
    ) -> Result<CodexToken, AIError> {
        let body = serde_json::json!({
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": verifier,
        });

        let resp = reqwest::blocking::Client::new()
            .post(TOKEN_URL)
            .json(&body)
            .send()
            .map_err(|e| AIError::Network(e.into()))?;

        let data: serde_json::Value = resp.json()
            .map_err(|e| AIError::Network(e.into()))?;

        let access_token = data["access_token"]
            .as_str()
            .ok_or_else(|| AIError::ApiError("token 响应中无 access_token".into()))?
            .to_string();

        let refresh_token = data["refresh_token"].as_str().map(|s| s.to_string());
        let expires_in = data["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + expires_in;

        Ok(CodexToken {
            access_token,
            refresh_token,
            expires_at: Some(expires_at),
        })
    }

    /// 刷新 token
    pub async fn refresh_token(&self) -> Result<CodexToken, AIError> {
        let current = self.get_token()
            .ok_or_else(|| AIError::InvalidConfig("未登录".into()))?;

        let refresh = current.refresh_token
            .ok_or_else(|| AIError::InvalidConfig("无 refresh_token，请重新登录".into()))?;

        let body = serde_json::json!({
            "grant_type": "refresh_token",
            "client_id": CLIENT_ID,
            "refresh_token": refresh,
        });

        let resp = self.client.post(TOKEN_URL).json(&body).send().await?;
        let data: serde_json::Value = resp.json().await?;

        let access_token = data["access_token"]
            .as_str()
            .ok_or_else(|| AIError::ApiError("刷新 token 失败".into()))?
            .to_string();

        let refresh_token = data["refresh_token"].as_str().map(|s| s.to_string());
        let expires_in = data["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + expires_in;

        let token = CodexToken {
            access_token,
            refresh_token,
            expires_at: Some(expires_at),
        };
        self.set_token(token.clone());
        Ok(token)
    }

    /// 获取有效的 access_token，过期自动刷新
    async fn get_valid_token(&self) -> Result<String, AIError> {
        let token = self.get_token()
            .ok_or_else(|| AIError::InvalidConfig("Codex 未登录，请先授权".into()))?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if let Some(expires_at) = token.expires_at {
            if now >= expires_at.saturating_sub(60) {
                let refreshed = self.refresh_token().await?;
                return Ok(refreshed.access_token);
            }
        }

        Ok(token.access_token)
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        super::hex_encode(bytes)
    }
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        url_escape(s)
    }

    fn url_escape(s: &str) -> String {
        let mut result = String::new();
        for b in s.bytes() {
            match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(b as char);
                }
                _ => {
                    result.push_str(&format!("%{:02X}", b));
                }
            }
        }
        result
    }
}

#[derive(Deserialize)]
struct OAIResponse {
    choices: Vec<OAIChoice>,
}

#[derive(Deserialize)]
struct OAIChoice {
    message: Option<OAIMessage>,
}

#[derive(Deserialize)]
struct OAIMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OAIModelList {
    data: Vec<OAIModelEntry>,
}

#[derive(Deserialize)]
struct OAIModelEntry {
    id: String,
}

#[async_trait]
impl AIProvider for CodexProvider {
    fn id(&self) -> &str {
        "codex"
    }

    fn name(&self) -> &str {
        "Codex (ChatGPT 订阅)"
    }

    async fn send_message(
        &self,
        messages: &[ChatMessage],
        options: &ModelOptions,
    ) -> Result<String, AIError> {
        let token = self.get_valid_token().await?;
        let model = options.model.as_deref().unwrap_or("gpt-4o");

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": options.temperature.unwrap_or(0.7),
            "max_tokens": options.max_tokens.unwrap_or(4096),
        });

        let resp: OAIResponse = self
            .client
            .post(format!("{}/v1/chat/completions", API_BASE))
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;

        Ok(resp
            .choices
            .first()
            .and_then(|c| c.message.as_ref())
            .and_then(|m| m.content.clone())
            .unwrap_or_default())
    }

    async fn send_message_stream(
        &self,
        _messages: &[ChatMessage],
        _options: &ModelOptions,
        _tx: mpsc::Sender<StreamChunk>,
    ) -> Result<(), AIError> {
        // TODO: 流式实现
        Ok(())
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, AIError> {
        let token = self.get_valid_token().await?;

        let resp: OAIModelList = self
            .client
            .get(format!("{}/v1/models", API_BASE))
            .bearer_auth(&token)
            .send()
            .await?
            .json()
            .await?;

        Ok(resp
            .data
            .into_iter()
            .map(|m| ModelInfo {
                id: m.id.clone(),
                name: m.id,
                provider: "codex".into(),
                context_length: None,
            })
            .collect())
    }

    async fn validate(&self) -> Result<bool, AIError> {
        Ok(self.get_token().is_some())
    }
}

// (end of file)
