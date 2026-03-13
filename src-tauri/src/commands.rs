use serde::Serialize;
use tauri::State;

use crate::ai::{AIRouter, ChatMessage, ModelOptions};
use crate::channel::ChannelManager;
use crate::config::{AppConfig, ConfigManager};
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

// ─── Config Commands ───

#[tauri::command]
pub async fn config_get(manager: State<'_, ConfigManager>) -> CmdResult<AppConfig> {
    Ok(manager.get().await)
}

#[tauri::command]
pub async fn config_update(
    manager: State<'_, ConfigManager>,
    config: AppConfig,
) -> CmdResult<()> {
    manager.update(config).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn config_patch(
    manager: State<'_, ConfigManager>,
    patch: serde_json::Value,
) -> CmdResult<AppConfig> {
    manager.patch(patch).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn config_is_first_run(manager: State<'_, ConfigManager>) -> bool {
    manager.is_first_run()
}

#[tauri::command]
pub async fn config_validate_provider(
    base_url: String,
    api_key: Option<String>,
    provider_type: String,
) -> CmdResult<serde_json::Value> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let (url, needs_auth) = match provider_type.as_str() {
        "ollama" => (format!("{}/api/tags", base_url.trim_end_matches('/')), false),
        _ => (format!("{}/v1/models", base_url.trim_end_matches('/')), true),
    };

    let mut req = client.get(&url);
    if needs_auth {
        if let Some(key) = &api_key {
            req = req.bearer_auth(key);
        }
    }

    match req.send().await {
        Ok(resp) => {
            let status = resp.status();
            if status.is_success() {
                Ok(serde_json::json!({
                    "valid": true,
                    "message": "连接成功"
                }))
            } else {
                Ok(serde_json::json!({
                    "valid": false,
                    "message": format!("服务返回错误: {}", status)
                }))
            }
        }
        Err(e) => Ok(serde_json::json!({
            "valid": false,
            "message": format!("连接失败: {}", e)
        })),
    }
}

// ─── Codex OAuth Commands ───

#[tauri::command]
pub fn codex_login(router: State<'_, AIRouter>) -> CmdResult<serde_json::Value> {
    let provider = crate::ai::codex::CodexProvider::new();
    let token = provider.start_oauth_login().map_err(|e| e.to_string())?;

    // 注册到 router
    let codex = crate::ai::codex::CodexProvider::with_token(token.clone());
    router.register(Box::new(codex));

    Ok(serde_json::json!({
        "success": true,
        "expires_at": token.expires_at,
    }))
}

#[tauri::command]
pub fn codex_is_logged_in(router: State<'_, AIRouter>) -> bool {
    router.has_provider("codex")
}

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
pub fn ai_list_providers(router: State<'_, AIRouter>) -> CmdResult<Vec<String>> {
    Ok(router.list_providers())
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
