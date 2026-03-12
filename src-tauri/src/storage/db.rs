use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 本地存储管理
pub struct Storage {
    data_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationRecord {
    pub id: String,
    pub channel_type: String,
    pub messages: Vec<StoredMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetState {
    pub current_style: String,
    pub current_animation: String,
    pub position_x: f64,
    pub position_y: f64,
    pub mood: f32,
}

impl Storage {
    pub fn new(data_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&data_dir).ok();
        Self { data_dir }
    }

    pub fn config_path(&self) -> PathBuf {
        self.data_dir.join("config.json")
    }

    pub fn soul_path(&self) -> PathBuf {
        self.data_dir.join("SOUL.md")
    }

    pub fn plugins_dir(&self) -> PathBuf {
        self.data_dir.join("plugins")
    }

    pub fn load_config<T: serde::de::DeserializeOwned>(&self) -> Option<T> {
        let path = self.config_path();
        let content = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn save_config<T: Serialize>(&self, config: &T) -> Result<(), std::io::Error> {
        let path = self.config_path();
        let content = serde_json::to_string_pretty(config)?;
        std::fs::write(path, content)
    }

    pub fn load_pet_state(&self) -> Option<PetState> {
        let path = self.data_dir.join("pet_state.json");
        let content = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn save_pet_state(&self, state: &PetState) -> Result<(), std::io::Error> {
        let path = self.data_dir.join("pet_state.json");
        let content = serde_json::to_string_pretty(state)?;
        std::fs::write(path, content)
    }
}
