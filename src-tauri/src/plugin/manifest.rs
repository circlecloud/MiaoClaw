use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// 插件 Manifest - 兼容 openclaw.plugin.json + miaoclaw 扩展
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub entry: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    /// JSON Schema 校验插件配置
    #[serde(rename = "configSchema", default)]
    pub config_schema: serde_json::Value,
    /// MiaoClaw 扩展字段
    #[serde(default)]
    pub miaoclaw: Option<MiaoClawExtension>,
}

/// MiaoClaw 独有的扩展字段
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MiaoClawExtension {
    /// 可触发的宠物表情/动画
    #[serde(default)]
    pub pet_reactions: Vec<String>,
    /// 支持的 Channel 类型
    #[serde(default)]
    pub channel_support: Vec<String>,
}

/// 已加载的插件实例信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub path: PathBuf,
    pub enabled: bool,
    pub loaded: bool,
    pub source: PluginSource,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PluginSource {
    /// 内置插件
    Builtin,
    /// 用户安装
    User,
    /// OpenClaw 兼容插件
    OpenClaw,
}

impl PluginManifest {
    /// 从文件加载 manifest（自动识别 miaoclaw.plugin.json 或 openclaw.plugin.json）
    pub fn load_from_dir(dir: &Path) -> Result<(Self, PluginSource), PluginError> {
        // 优先 miaoclaw.plugin.json
        let miaoclaw_path = dir.join("miaoclaw.plugin.json");
        if miaoclaw_path.exists() {
            let content = std::fs::read_to_string(&miaoclaw_path)?;
            let manifest: Self = serde_json::from_str(&content)?;
            return Ok((manifest, PluginSource::User));
        }

        // 兼容 openclaw.plugin.json
        let openclaw_path = dir.join("openclaw.plugin.json");
        if openclaw_path.exists() {
            let content = std::fs::read_to_string(&openclaw_path)?;
            let manifest: Self = serde_json::from_str(&content)?;
            return Ok((manifest, PluginSource::OpenClaw));
        }

        Err(PluginError::ManifestNotFound(dir.display().to_string()))
    }
}

/// 插件错误
#[derive(Debug, thiserror::Error)]
pub enum PluginError {
    #[error("Manifest 未找到: {0}")]
    ManifestNotFound(String),
    #[error("Manifest 解析失败: {0}")]
    ManifestParse(#[from] serde_json::Error),
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("插件加载失败: {0}")]
    LoadFailed(String),
    #[error("插件执行错误: {0}")]
    RuntimeError(String),
    #[error("配置校验失败: {0}")]
    ConfigValidation(String),
}
