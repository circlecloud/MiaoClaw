use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 统一消息格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelMessage {
    pub id: String,
    pub channel_id: String,
    pub channel_type: ChannelType,
    pub sender_id: String,
    pub sender_name: Option<String>,
    pub content: String,
    pub attachments: Vec<Attachment>,
    pub reply_to: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ChannelType {
    Desktop,
    Telegram,
    Discord,
    Slack,
    Webchat,
    Websocket,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub filename: String,
    pub mime_type: String,
    pub url: Option<String>,
    pub data: Option<Vec<u8>>,
}

/// Channel 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfig {
    pub channel_type: ChannelType,
    pub enabled: bool,
    pub config: serde_json::Value,
}

/// Channel 适配器接口 - 每个平台实现此 trait
#[async_trait]
pub trait ChannelAdapter: Send + Sync {
    /// Channel 类型标识
    fn channel_type(&self) -> ChannelType;

    /// 显示名称
    fn display_name(&self) -> &str;

    /// 启动 Channel（连接、轮询等）
    async fn start(&mut self) -> Result<(), ChannelError>;

    /// 停止 Channel
    async fn stop(&mut self) -> Result<(), ChannelError>;

    /// 发送消息到该 Channel
    async fn send_message(&self, channel_id: &str, content: &str) -> Result<(), ChannelError>;

    /// 是否正在运行
    fn is_running(&self) -> bool;
}

/// Channel 错误
#[derive(Debug, thiserror::Error)]
pub enum ChannelError {
    #[error("连接失败: {0}")]
    ConnectionFailed(String),
    #[error("认证失败: {0}")]
    AuthFailed(String),
    #[error("发送失败: {0}")]
    SendFailed(String),
    #[error("配置无效: {0}")]
    InvalidConfig(String),
    #[error("Channel 未启动")]
    NotRunning,
}
