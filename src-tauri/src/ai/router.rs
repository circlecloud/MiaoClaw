use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::RwLock as TokioRwLock;

use super::ollama::OllamaProvider;
use super::openai_compat::OpenAICompatProvider;
use super::provider::*;

/// AI 路由器 - 管理多个 Provider，路由请求
#[derive(Clone)]
pub struct AIRouter {
    /// 用 tokio RwLock，因为 send() 需要跨 await 持有读锁
    providers: Arc<TokioRwLock<HashMap<String, Box<dyn AIProvider>>>>,
    default_provider: Arc<RwLock<Option<String>>>,
}

impl AIRouter {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(TokioRwLock::new(HashMap::new())),
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

    /// 注册单个 Provider（同步，blocking_write 可在非 async 上下文调用）
    pub fn register(&self, provider: Box<dyn AIProvider>) {
        let id = provider.id().to_string();
        self.providers.blocking_write().insert(id, provider);
    }

    /// 设置默认 Provider
    pub fn set_default(&self, provider_id: &str) {
        *self.default_provider.write().unwrap() = Some(provider_id.to_string());
    }

    /// 发送消息到指定或默认 Provider
    pub async fn send(
        &self,
        messages: &[ChatMessage],
        options: &ModelOptions,
        provider_id: Option<&str>,
    ) -> Result<String, AIError> {
        let id = {
            let default = self.default_provider.read().unwrap();
            provider_id
                .map(|s| s.to_string())
                .or_else(|| default.clone())
                .ok_or_else(|| AIError::InvalidConfig("未配置任何 AI Provider".into()))?
        };

        let providers = self.providers.read().await;
        let provider = providers
            .get(&id)
            .ok_or_else(|| AIError::InvalidConfig(format!("Provider '{}' 不存在", id)))?;

        provider.send_message(messages, options).await
    }

    /// 列出所有已注册的 Provider
    pub fn list_providers(&self) -> Vec<String> {
        self.providers.blocking_read().keys().cloned().collect()
    }

    /// 检查是否有指定 Provider
    pub fn has_provider(&self, id: &str) -> bool {
        self.providers.blocking_read().contains_key(id)
    }
}
