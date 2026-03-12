use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use tokio::sync::mpsc;

use super::provider::*;

/// Ollama 本地模型 Provider
pub struct OllamaProvider {
    client: Client,
    base_url: String,
}

impl OllamaProvider {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Deserialize)]
struct OllamaModelList {
    models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: Option<OllamaChatMessage>,
    done: bool,
}

#[derive(Deserialize)]
struct OllamaChatMessage {
    content: String,
}

#[async_trait]
impl AIProvider for OllamaProvider {
    fn id(&self) -> &str {
        "ollama"
    }

    fn name(&self) -> &str {
        "Ollama (本地)"
    }

    async fn send_message(
        &self,
        messages: &[ChatMessage],
        options: &ModelOptions,
    ) -> Result<String, AIError> {
        let model = options
            .model
            .as_deref()
            .unwrap_or("llama3.2");

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": false,
            "options": {
                "temperature": options.temperature.unwrap_or(0.7),
            }
        });

        let resp: OllamaChatResponse = self
            .client
            .post(format!("{}/api/chat", self.base_url))
            .json(&body)
            .send()
            .await?
            .json()
            .await?;

        Ok(resp
            .message
            .map(|m| m.content)
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
            .unwrap_or("llama3.2");

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": true,
            "options": {
                "temperature": options.temperature.unwrap_or(0.7),
            }
        });

        let mut resp = self
            .client
            .post(format!("{}/api/chat", self.base_url))
            .json(&body)
            .send()
            .await?;

        while let Some(chunk) = resp.chunk().await? {
            if let Ok(data) = serde_json::from_slice::<OllamaChatResponse>(&chunk) {
                let content = data
                    .message
                    .map(|m| m.content)
                    .unwrap_or_default();
                let _ = tx
                    .send(StreamChunk {
                        delta: content,
                        done: data.done,
                    })
                    .await;
                if data.done {
                    break;
                }
            }
        }

        Ok(())
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, AIError> {
        let resp: OllamaModelList = self
            .client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await?
            .json()
            .await?;

        Ok(resp
            .models
            .into_iter()
            .map(|m| ModelInfo {
                id: m.name.clone(),
                name: m.name,
                provider: "ollama".into(),
                context_length: None,
            })
            .collect())
    }

    async fn validate(&self) -> Result<bool, AIError> {
        let resp = self
            .client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await;
        Ok(resp.is_ok())
    }
}
