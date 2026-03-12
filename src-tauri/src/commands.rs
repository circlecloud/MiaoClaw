use serde::Serialize;
use tauri::State;

use crate::ai::{AIRouter, ChatMessage, ModelOptions};
use crate::channel::ChannelManager;
use crate::plugin::PluginEngine;

/// 错误类型包装，让 Tauri 能序列化
#[derive(Debug, Serialize)]
pub struct CommandError {
    pub message: String,
}

impl<E: std::fmt::Display> From<E> for CommandError {
    fn from(e: E) -> Self {
        Self {
            message: e.to_string(),
        }
    }
}

type CmdResult<T> = Result<T, String>;

// ─── AI Commands ───

#[tauri::command]
pub async fn ai_send_message(
    router: State<'_, AIRouter>,
    messages: Vec<ChatMessage>,
    options: ModelOptions,
    provider_id: Option<String>,
) -> CmdResult<String> {
    router
        .send(&messages, &options, provider_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_list_providers(router: State<'_, AIRouter>) -> CmdResult<Vec<String>> {
    Ok(router.list_providers().await)
}

// ─── Channel Commands ───

#[tauri::command]
pub async fn channel_list(
    manager: State<'_, ChannelManager>,
) -> CmdResult<Vec<crate::channel::manager::ChannelStatus>> {
    Ok(manager.list_channels().await)
}

#[tauri::command]
pub async fn channel_send(
    manager: State<'_, ChannelManager>,
    adapter_id: String,
    channel_id: String,
    content: String,
) -> CmdResult<()> {
    manager
        .send(&adapter_id, &channel_id, &content)
        .await
        .map_err(|e| e.to_string())
}

// ─── Plugin Commands ───

#[tauri::command]
pub async fn plugin_list(
    engine: State<'_, PluginEngine>,
) -> CmdResult<Vec<crate::plugin::PluginInfo>> {
    Ok(engine.list_plugins().await)
}

#[tauri::command]
pub async fn plugin_call_tool(
    engine: State<'_, PluginEngine>,
    tool_name: String,
    params: serde_json::Value,
) -> CmdResult<crate::plugin::api::ToolResult> {
    engine
        .call_tool(&tool_name, params)
        .await
        .map_err(|e| e.to_string())
}

// ─── Pet Commands ───

#[tauri::command]
pub async fn pet_get_state() -> CmdResult<crate::storage::db::PetState> {
    Ok(crate::storage::db::PetState {
        current_style: "css".into(),
        current_animation: "idle".into(),
        position_x: 100.0,
        position_y: 100.0,
        mood: 1.0,
    })
}
