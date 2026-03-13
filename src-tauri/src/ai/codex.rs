use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tokio::sync::mpsc;

use super::provider::*;

/// Codex OAuth 常量
const AUTH_URL: &str = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL: &str = "https://auth.openai.com/oauth/token";
const CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const CALLBACK_PATH: &str = "/auth/callback";
const SCOPE: &str = "openid profile email offline_access";
const API_BASE: &str = "https://api.openai.com";

/// Device Code Flow 端点
const DEVICE_CODE_URL: &str = "https://auth.openai.com/api/accounts/deviceauth/usercode";
const DEVICE_TOKEN_URL: &str = "https://auth.openai.com/api/accounts/deviceauth/token";
const DEVICE_REDIRECT_URI: &str = "https://auth.openai.com/deviceauth/callback";
const DEVICE_VERIFY_URL: &str = "https://auth.openai.com/codex/device";
const DEVICE_TIMEOUT_SECS: u64 = 900; // 15 分钟

/// Codex OAuth Token
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CodexToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<u64>,
}

/// Device Code Flow 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_auth_id: String,
    pub user_code: String,
    pub verification_uri: String,
    pub interval: u64,
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
            let mut buf = [0u8; 32];
            rand::fill(&mut buf);
            base64_url_encode(&buf)
        };

        // 动态端口：绑定 0 让 OS 分配
        let server = tiny_http::Server::http(
            "127.0.0.1:0"
        ).map_err(|e| AIError::ApiError(format!("无法启动回调服务器: {}", e)))?;

        let port = server.server_addr().to_ip().unwrap().port();
        let redirect_uri = format!("http://localhost:{}{}", port, CALLBACK_PATH);

        let auth_url = format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&code_challenge={}&code_challenge_method=S256&id_token_add_organizations=true&codex_cli_simplified_flow=true&state={}&originator=miaoclaw",
            AUTH_URL,
            CLIENT_ID,
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(SCOPE),
            challenge,
            urlencoding::encode(&state),
        );

        // 打开浏览器
        let _ = open::that(&auth_url);

        tracing::info!("等待 Codex OAuth 回调 (port {})...", port);

        // 循环接收请求，直到收到 /auth/callback
        let callback_url;
        loop {
            let request = server
                .recv()
                .map_err(|e| AIError::ApiError(format!("等待回调失败: {}", e)))?;

            let url = request.url().to_string();
            tracing::debug!("收到请求: {}", url);

            if url.starts_with(CALLBACK_PATH) {
                let response = tiny_http::Response::from_string(
                    "<html><body><h2>✅ 授权成功！你可以关闭此页面。</h2></body></html>"
                ).with_header(
                    "Content-Type: text/html; charset=utf-8"
                        .parse::<tiny_http::Header>()
                        .unwrap(),
                );
                let _ = request.respond(response);
                callback_url = url;
                break;
            } else {
                // 非回调请求（favicon 等），返回 404
                let response = tiny_http::Response::from_string("Not Found")
                    .with_status_code(404);
                let _ = request.respond(response);
            }
        }

        // 解析 code
        let code = callback_url
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

    /// Device Code Flow: 请求设备码
    pub fn start_device_code_login(&self) -> Result<DeviceCodeResponse, AIError> {
        let body = serde_json::json!({ "client_id": CLIENT_ID });

        let resp = reqwest::blocking::Client::new()
            .post(DEVICE_CODE_URL)
            .json(&body)
            .send()
            .map_err(|e| AIError::Network(e.into()))?;

        if !resp.status().is_success() {
            let text = resp.text().unwrap_or_default();
            return Err(AIError::ApiError(format!("请求设备码失败: {}", text)));
        }

        let data: serde_json::Value = resp.json()
            .map_err(|e| AIError::Network(e.into()))?;

        Ok(DeviceCodeResponse {
            device_auth_id: data["device_auth_id"].as_str().unwrap_or("").to_string(),
            user_code: data["user_code"].as_str()
                .or(data["usercode"].as_str())
                .unwrap_or("").to_string(),
            verification_uri: DEVICE_VERIFY_URL.to_string(),
            interval: data["interval"].as_u64()
                .or(data["interval"].as_str().and_then(|s| s.parse().ok()))
                .unwrap_or(5),
        })
    }

    /// Device Code Flow: 轮询等待用户授权并换取 token
    pub fn poll_device_code(&self, device_auth_id: &str, user_code: &str, interval: u64) -> Result<CodexToken, AIError> {
        let client = reqwest::blocking::Client::new();
        let start = std::time::Instant::now();

        loop {
            if start.elapsed().as_secs() > DEVICE_TIMEOUT_SECS {
                return Err(AIError::ApiError("设备码授权超时（15分钟）".into()));
            }

            std::thread::sleep(std::time::Duration::from_secs(interval));

            let resp = client
                .post(DEVICE_TOKEN_URL)
                .json(&serde_json::json!({
                    "device_auth_id": device_auth_id,
                    "user_code": user_code,
                }))
                .send()
                .map_err(|e| AIError::Network(e.into()))?;

            let status = resp.status();
            if status.is_success() {
                let data: serde_json::Value = resp.json()
                    .map_err(|e| AIError::Network(e.into()))?;

                let auth_code = data["authorization_code"].as_str()
                    .ok_or_else(|| AIError::ApiError("响应中无 authorization_code".into()))?;
                let code_verifier = data["code_verifier"].as_str()
                    .ok_or_else(|| AIError::ApiError("响应中无 code_verifier".into()))?;

                // 用 authorization_code 换 access_token
                return self.exchange_device_token(auth_code, code_verifier);
            }

            // 403/404 = 用户尚未授权，继续轮询
            if status.as_u16() == 403 || status.as_u16() == 404 {
                tracing::debug!("设备码授权等待中...");
                continue;
            }

            let text = resp.text().unwrap_or_default();
            return Err(AIError::ApiError(format!("轮询失败 ({}): {}", status, text)));
        }
    }

    fn exchange_device_token(&self, code: &str, verifier: &str) -> Result<CodexToken, AIError> {
        let body = format!(
            "grant_type=authorization_code&client_id={}&code={}&code_verifier={}&redirect_uri={}",
            CLIENT_ID,
            urlencoding::encode(code),
            urlencoding::encode(verifier),
            urlencoding::encode(DEVICE_REDIRECT_URI),
        );

        let resp = reqwest::blocking::Client::new()
            .post(TOKEN_URL)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .map_err(|e| AIError::Network(e.into()))?;

        let data: serde_json::Value = resp.json()
            .map_err(|e| AIError::Network(e.into()))?;

        let access_token = data["access_token"].as_str()
            .ok_or_else(|| AIError::ApiError("token 响应中无 access_token".into()))?
            .to_string();

        let refresh_token = data["refresh_token"].as_str().map(|s| s.to_string());
        let expires_in = data["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() + expires_in;

        let token = CodexToken { access_token, refresh_token, expires_at: Some(expires_at) };
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

fn base64_url_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
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
