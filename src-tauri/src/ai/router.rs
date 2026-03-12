use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::ollama::OllamaProvider;
use super::openai_compat::OpenAICompatProvider;
use super::provider::*;

/// AI 路由器 - 管理多个 Provider，路由请求
pub struct AIRouter {
    providers: Arc<RwLock<HashMap<String, Box<dyn AIProvider>>>>,
    default_provider: Arc<RwLock<Option<String>>>,
}

impl AIRouter {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            default_provider: Arc::new(RwLock::new(None)),
        }
    }

    /// 从配置加载所有 Provider
    pub async fn load_providers(&self, configs: &[ProviderConfig]) {
        let mut providers = self.providers.write().await;
        providers.clear();

        for config in configs {
            if !config.enabled {
                continue;
            }

            let provider: Box<dyn AIProvider> = match config.provider_type {
                ProviderType::Ollama => {
                    Box::new(OllamaProvider::new(&config.base_url))
                }
                ProviderType::OpenAICompat => {
                    Box::new(OpenAICompatProvider::new(
                        &config.base_url,
                        config.api_key.as_deref().unwrap_or(""),
                        "OpenAI Compatible",
                    ))
                }
            };

            let id = provider.id().to_string();
            providers.insert(id, provider);
        }
    }

    /// 注册单个 Provider
    pub async fn register(&self, provider: Box<dyn AIProvider>) {
        let id = provider.id().to_string();
        self.providers.write().await.insert(id, provider);
    }

    /// 设置默认 Provider
    pub async fn set_default(&self, provider_id: &str) {
        *self.default_provider.write().await = Some(provider_id.to_string());
    }

    /// 发送消息到指定或默认 Provider
    pub async fn send(
        &self,
        messages: &[ChatMessage],
        options: &ModelOptions,
        provider_id: Option<&str>,
    ) -> Result<String, AIError> {
        let providers = self.providers.read().await;
        let default = self.default_provider.read().await;

        let id = provider_id
            .or(default.as_deref())
            .ok_or_else(|| AIError::InvalidConfig("未配置任何 AI Provider".into()))?;

        let provider = providers
            .get(id)
            .ok_or_else(|| AIError::InvalidConfig(format!("Provider '{}' 不存在", id)))?;

        provider.send_message(messages, options).await
    }

    /// 列出所有已注册的 Provider
    pub async fn list_providers(&self) -> Vec<String> {
        self.providers.read().await.keys().cloned().collect()
    }
}
