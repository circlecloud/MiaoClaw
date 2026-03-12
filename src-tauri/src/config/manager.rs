use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::AppConfig;

/// 配置管理器 - 加载、保存、监听配置变更
pub struct ConfigManager {
    config: Arc<RwLock<AppConfig>>,
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(data_dir: &PathBuf) -> Self {
        let config_path = data_dir.join("miaoclaw.json");
        Self {
            config: Arc::new(RwLock::new(AppConfig::default())),
            config_path,
        }
    }

    /// 加载配置，不存在则创建默认配置
    pub fn load(&self) -> Result<AppConfig, ConfigError> {
        if !self.config_path.exists() {
            let default = AppConfig::default();
            self.save_sync(&default)?;
            return Ok(default);
        }

        let content = std::fs::read_to_string(&self.config_path)?;
        let config: AppConfig = serde_json::from_str(&content).map_err(|e| {
            ConfigError::Parse(format!(
                "配置文件解析失败 ({}): {}",
                self.config_path.display(),
                e
            ))
        })?;
        Ok(config)
    }

    /// 初始化：加载配置到内存
    pub async fn init(&self) -> Result<AppConfig, ConfigError> {
        let config = self.load()?;
        *self.config.write().await = config.clone();
        Ok(config)
    }

    /// 获取当前配置
    pub async fn get(&self) -> AppConfig {
        self.config.read().await.clone()
    }

    /// 更新并保存配置
    pub async fn update(&self, config: AppConfig) -> Result<(), ConfigError> {
        self.save_sync(&config)?;
        *self.config.write().await = config;
        Ok(())
    }

    /// 部分更新配置（合并）
    pub async fn patch(&self, patch: serde_json::Value) -> Result<AppConfig, ConfigError> {
        let mut config = self.get().await;
        let mut current = serde_json::to_value(&config)?;

        if let (Some(current_obj), Some(patch_obj)) =
            (current.as_object_mut(), patch.as_object())
        {
            for (key, value) in patch_obj {
                current_obj.insert(key.clone(), value.clone());
            }
        }

        config = serde_json::from_value(current)?;
        self.update(config.clone()).await?;
        Ok(config)
    }

    /// 检查是否为首次运行（无配置文件或无 provider）
    pub fn is_first_run(&self) -> bool {
        if !self.config_path.exists() {
            return true;
        }
        match self.load() {
            Ok(config) => config.models.providers.is_empty(),
            Err(_) => true,
        }
    }

    /// 获取配置文件路径
    pub fn config_path(&self) -> &PathBuf {
        &self.config_path
    }

    fn save_sync(&self, config: &AppConfig) -> Result<(), ConfigError> {
        if let Some(parent) = self.config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(config)?;
        std::fs::write(&self.config_path, content)?;
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("解析错误: {0}")]
    Parse(String),
    #[error("序列化错误: {0}")]
    Serialize(#[from] serde_json::Error),
}
