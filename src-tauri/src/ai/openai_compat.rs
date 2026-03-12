use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use tokio::sync::mpsc;

use super::provider::*;

/// OpenAI 兼容 Provider（支持 OpenAI / Claude / Gemini / LM Studio / vLLM 等）
pub struct OpenAICompatProvider {
    client: Client,
    base_url: String,
    api_key: String,
    display_name: String,
}

impl OpenAICompatProvider {
    pub fn new(base_url: &str, api_key: &str, display_name: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            display_name: display_name.to_string(),
        }
    }
}

#[derive(Deserialize)]
struct OAIResponse {
    choices: Vec<OAIChoice>,
}

#[derive(Deserialize)]
struct OAIChoice {
    message: Option<OAIMessage>,
    delta: Option<OAIMessage>,
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

#[derive(Deserialize)]
struct OAIStreamChunk {
    choices: Vec<OAIChoice>,
}

#[async_trait]
impl AIProvider for OpenAICompatProvider {
    fn id(&self) -> &str {
        "openai_compat"
    }

    fn name(&self) -> &str {
        &self.display_name
    }

    async fn send_message(
        &self,
        messages: &[ChatMessage],
        options: &ModelOptions,
    ) -> Result<String, AIError> {
        let model = options
            .model
            .as_deref()
            .unwrap_or("gpt-4o-mini");

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": options.temperature.unwrap_or(0.7),
            "max_tokens": options.max_tokens.unwrap_or(4096),
            "stream": false,
        });

        let resp: OAIResponse = self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .bearer_auth(&self.api_key)
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
        messages: &[ChatMessage],
        options: &ModelOptions,
        tx: mpsc::Sender<StreamChunk>,
    ) -> Result<(), AIError> {
        let model = options
            .model
            .as_deref()
            .unwrap_or("gpt-4o-mini");

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": options.temperature.unwrap_or(0.7),
            "max_tokens": options.max_tokens.unwrap_or(4096),
            "stream": true,
        });

        let mut resp = self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await?;

        let mut buffer = String::new();
        while let Some(chunk) = resp.chunk().await? {
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            // SSE 格式: data: {...}\n\n
            while let Some(pos) = buffer.find("\n\n") {
                let line = buffer[..pos].to_string();
                buffer = buffer[pos + 2..].to_string();

                let data = line.trim_start_matches("data: ");
                if data == "[DONE]" {
                    let _ = tx
                        .send(StreamChunk {
                            delta: String::new(),
                            done: true,
                        })
                        .await;
                    return Ok(());
                }

                if let Ok(parsed) = serde_json::from_str::<OAIStreamChunk>(data) {
                    let content = parsed
                        .choices
                        .first()
                        .and_then(|c| c.delta.as_ref())
                        .and_then(|d| d.content.clone())
                        .unwrap_or_default();
                    let _ = tx
                        .send(StreamChunk {
                            delta: content,
                            done: false,
                        })
                        .await;
                }
            }
        }

        Ok(())
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, AIError> {
        let resp: OAIModelList = self
            .client
            .get(format!("{}/v1/models", self.base_url))
            .bearer_auth(&self.api_key)
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
                provider: self.display_name.clone(),
                context_length: None,
            })
            .collect())
    }

    async fn validate(&self) -> Result<bool, AIError> {
        let resp = self
            .client
            .get(format!("{}/v1/models", self.base_url))
            .bearer_auth(&self.api_key)
            .send()
            .await;
        Ok(resp.map(|r| r.status().is_success()).unwrap_or(false))
    }
}
