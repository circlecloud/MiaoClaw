use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

/// AI 模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub context_length: Option<u32>,
}

/// 对话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: MessageRole,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
}

/// 模型调用选项
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelOptions {
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

/// 流式响应 chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub delta: String,
    pub done: bool,
}

/// AI Provider 统一接口
#[async_trait]
pub trait AIProvider: Send + Sync {
    /// Provider 唯一标识
    fn id(&self) -> &str;

    /// Provider 显示名称
    fn name(&self) -> &str;

    /// 发送消息（非流式）
    async fn send_message(
        &self,
        messages: &[ChatMessage],
        options: &ModelOptions,
    ) -> Result<String, AIError>;

    /// 发送消息（流式）
    async fn send_message_stream(
        &self,
        messages: &[ChatMessage],
        options: &ModelOptions,
        tx: mpsc::Sender<StreamChunk>,
    ) -> Result<(), AIError>;

    /// 列出可用模型
    async fn list_models(&self) -> Result<Vec<ModelInfo>, AIError>;

    /// 验证配置是否有效
    async fn validate(&self) -> Result<bool, AIError>;
}

/// Provider 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub provider_type: ProviderType,
    pub base_url: String,
    pub api_key: Option<String>,
    pub default_model: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    Ollama,
    OpenAICompat,
}

/// AI 错误类型
#[derive(Debug, thiserror::Error)]
pub enum AIError {
    #[error("网络请求失败: {0}")]
    Network(#[from] reqwest::Error),
    #[error("配置无效: {0}")]
    InvalidConfig(String),
    #[error("模型不存在: {0}")]
    ModelNotFound(String),
    #[error("API 错误: {0}")]
    ApiError(String),
    #[error("序列化错误: {0}")]
    Serialization(#[from] serde_json::Error),
}
