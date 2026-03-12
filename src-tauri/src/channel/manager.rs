use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

use super::message::*;

/// Channel 管理器 - 管理所有 Channel 适配器，统一收发消息
pub struct ChannelManager {
    adapters: Arc<RwLock<HashMap<String, Box<dyn ChannelAdapter>>>>,
    /// 所有 Channel 收到的消息汇聚到这里
    incoming_tx: mpsc::Sender<ChannelMessage>,
    incoming_rx: Arc<RwLock<Option<mpsc::Receiver<ChannelMessage>>>>,
}

impl ChannelManager {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel(256);
        Self {
            adapters: Arc::new(RwLock::new(HashMap::new())),
            incoming_tx: tx,
            incoming_rx: Arc::new(RwLock::new(Some(rx))),
        }
    }

    /// 注册 Channel 适配器
    pub async fn register(&self, id: &str, adapter: Box<dyn ChannelAdapter>) {
        self.adapters
            .write()
            .await
            .insert(id.to_string(), adapter);
    }

    /// 启动所有已注册的 Channel
    pub async fn start_all(&self) -> Vec<(String, Result<(), ChannelError>)> {
        let mut results = Vec::new();
        let mut adapters = self.adapters.write().await;
        for (id, adapter) in adapters.iter_mut() {
            let result = adapter.start().await;
            results.push((id.clone(), result));
        }
        results
    }

    /// 停止所有 Channel
    pub async fn stop_all(&self) {
        let mut adapters = self.adapters.write().await;
        for (_, adapter) in adapters.iter_mut() {
            let _ = adapter.stop().await;
        }
    }

    /// 向指定 Channel 发送消息
    pub async fn send(
        &self,
        adapter_id: &str,
        channel_id: &str,
        content: &str,
    ) -> Result<(), ChannelError> {
        let adapters = self.adapters.read().await;
        let adapter = adapters
            .get(adapter_id)
            .ok_or_else(|| ChannelError::InvalidConfig(format!("Channel '{}' 不存在", adapter_id)))?;
        adapter.send_message(channel_id, content).await
    }

    /// 获取消息接收端（只能取一次）
    pub async fn take_receiver(&self) -> Option<mpsc::Receiver<ChannelMessage>> {
        self.incoming_rx.write().await.take()
    }

    /// 获取消息发送端（供 Channel 适配器推送消息）
    pub fn incoming_sender(&self) -> mpsc::Sender<ChannelMessage> {
        self.incoming_tx.clone()
    }

    /// 列出所有 Channel 状态
    pub async fn list_channels(&self) -> Vec<ChannelStatus> {
        let adapters = self.adapters.read().await;
        adapters
            .iter()
            .map(|(id, adapter)| ChannelStatus {
                id: id.clone(),
                channel_type: adapter.channel_type(),
                display_name: adapter.display_name().to_string(),
                running: adapter.is_running(),
            })
            .collect()
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ChannelStatus {
    pub id: String,
    pub channel_type: ChannelType,
    pub display_name: String,
    pub running: bool,
}
