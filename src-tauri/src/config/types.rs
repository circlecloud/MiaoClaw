use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// MiaoClaw 完整配置，参考 OpenClaw 的 openclaw.json 结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub identity: IdentityConfig,
    #[serde(default)]
    pub models: ModelsConfig,
    #[serde(default)]
    pub channels: ChannelsConfig,
    #[serde(default)]
    pub plugins: PluginsConfig,
    #[serde(default)]
    pub pet: PetConfig,
}

/// 身份/人格配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityConfig {
    pub name: String,
    pub theme: String,
    pub emoji: String,
    /// SOUL.md 路径
    pub soul_path: Option<String>,
}

impl Default for IdentityConfig {
    fn default() -> Self {
        Self {
            name: "MiaoClaw".into(),
            theme: "可爱的桌面宠物猫，同时也是你的个人AI助理".into(),
            emoji: "🐱".into(),
            soul_path: None,
        }
    }
}

/// AI 模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsConfig {
    /// 主模型 (格式: provider/model, 如 "ollama/llama3.2")
    pub primary: Option<String>,
    /// 备用模型链
    #[serde(default)]
    pub fallbacks: Vec<String>,
    /// Provider 配置
    #[serde(default)]
    pub providers: HashMap<String, ProviderEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEntry {
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(rename = "apiKey", default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 显示名称
    #[serde(rename = "displayName", default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}

fn default_true() -> bool { true }

impl Default for ModelsConfig {
    fn default() -> Self {
        Self {
            primary: None,
            fallbacks: vec![],
            providers: HashMap::new(),
        }
    }
}

/// Channel 配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelsConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub telegram: Option<TelegramConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discord: Option<DiscordConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slack: Option<SlackConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub websocket: Option<WebSocketConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramConfig {
    pub enabled: bool,
    #[serde(rename = "botToken")]
    pub bot_token: String,
    #[serde(rename = "dmPolicy", default = "default_dm_policy")]
    pub dm_policy: String,
    #[serde(rename = "allowFrom", default)]
    pub allow_from: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordConfig {
    pub enabled: bool,
    #[serde(rename = "botToken")]
    pub bot_token: String,
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "dmPolicy", default = "default_dm_policy")]
    pub dm_policy: String,
    #[serde(rename = "allowFrom", default)]
    pub allow_from: Vec<String>,
    #[serde(default)]
    pub guilds: HashMap<String, GuildConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuildConfig {
    #[serde(default)]
    pub channels: Vec<String>,
    #[serde(rename = "requireMention", default = "default_true")]
    pub require_mention: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackConfig {
    pub enabled: bool,
    #[serde(rename = "botToken")]
    pub bot_token: String,
    #[serde(rename = "appToken")]
    pub app_token: String,
    #[serde(rename = "dmPolicy", default = "default_dm_policy")]
    pub dm_policy: String,
    #[serde(rename = "allowFrom", default)]
    pub allow_from: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketConfig {
    pub enabled: bool,
    #[serde(default = "default_ws_port")]
    pub port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

fn default_dm_policy() -> String { "pairing".into() }
fn default_ws_port() -> u16 { 18790 }

/// 插件配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PluginsConfig {
    /// 插件搜索目录
    #[serde(default)]
    pub dirs: Vec<String>,
    /// 各插件的配置
    #[serde(default)]
    pub config: HashMap<String, serde_json::Value>,
}

/// 宠物配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetConfig {
    pub style: String,
    #[serde(rename = "alwaysOnTop", default = "default_true")]
    pub always_on_top: bool,
    #[serde(rename = "autoStart", default)]
    pub auto_start: bool,
    #[serde(rename = "globalShortcut", default = "default_shortcut")]
    pub global_shortcut: String,
}

fn default_shortcut() -> String { "CommandOrControl+Shift+M".into() }

impl Default for PetConfig {
    fn default() -> Self {
        Self {
            style: "smd".into(),
            always_on_top: true,
            auto_start: false,
            global_shortcut: default_shortcut(),
        }
    }
}

// (no more splices)

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            identity: IdentityConfig::default(),
            models: ModelsConfig::default(),
            channels: ChannelsConfig::default(),
            plugins: PluginsConfig::default(),
            pet: PetConfig::default(),
        }
    }
}
