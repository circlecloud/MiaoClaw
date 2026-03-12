use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

use super::api::*;
use super::manifest::*;

/// 插件引擎 - 加载、管理、执行插件
/// 使用 jiti 运行时加载 TypeScript/JavaScript 插件（与 OpenClaw 一致）
pub struct PluginEngine {
    plugins: Arc<RwLock<HashMap<String, PluginInfo>>>,
    tools: Arc<RwLock<HashMap<String, ToolDefinition>>>,
    hooks: Arc<RwLock<Vec<HookDefinition>>>,
    rpcs: Arc<RwLock<HashMap<String, RPCDefinition>>>,
    services: Arc<RwLock<HashMap<String, ServiceDefinition>>>,
    plugin_dirs: Vec<PathBuf>,
}

impl PluginEngine {
    pub fn new(plugin_dirs: Vec<PathBuf>) -> Self {
        Self {
            plugins: Arc::new(RwLock::new(HashMap::new())),
            tools: Arc::new(RwLock::new(HashMap::new())),
            hooks: Arc::new(RwLock::new(Vec::new())),
            rpcs: Arc::new(RwLock::new(HashMap::new())),
            services: Arc::new(RwLock::new(HashMap::new())),
            plugin_dirs,
        }
    }

    /// 扫描并加载所有插件目录
    pub async fn discover_and_load(&self) -> Vec<(String, Result<(), PluginError>)> {
        let mut results = Vec::new();

        for dir in &self.plugin_dirs {
            if !dir.exists() {
                continue;
            }

            let entries = match std::fs::read_dir(dir) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }

                let result = self.load_plugin(&path).await;
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                results.push((name, result));
            }
        }

        results
    }

    /// 加载单个插件
    pub async fn load_plugin(&self, path: &Path) -> Result<(), PluginError> {
        let (manifest, source) = PluginManifest::load_from_dir(path)?;
        let name = manifest.name.clone();

        let info = PluginInfo {
            manifest,
            path: path.to_path_buf(),
            enabled: true,
            loaded: true,
            source,
        };

        self.plugins.write().await.insert(name, info);

        // TODO: 通过 jiti 加载 entry 文件，执行插件注册逻辑
        // 插件调用 registerTool / registerHook / registerRPC / registerService

        Ok(())
    }

    /// 注册工具（供插件调用）
    pub async fn register_tool(&self, tool: ToolDefinition) {
        self.tools
            .write()
            .await
            .insert(tool.name.clone(), tool);
    }

    /// 注册 Hook
    pub async fn register_hook(&self, hook: HookDefinition) {
        let mut hooks = self.hooks.write().await;
        hooks.push(hook);
        hooks.sort_by_key(|h| h.priority);
    }

    /// 注册 RPC 方法
    pub async fn register_rpc(&self, rpc: RPCDefinition) {
        self.rpcs
            .write()
            .await
            .insert(rpc.method.clone(), rpc);
    }

    /// 注册后台服务
    pub async fn register_service(&self, service: ServiceDefinition) {
        self.services
            .write()
            .await
            .insert(service.name.clone(), service);
    }

    /// 获取所有已注册的工具（供 AI 使用）
    pub async fn get_tools(&self) -> Vec<ToolDefinition> {
        self.tools.read().await.values().cloned().collect()
    }

    /// 执行工具调用
    pub async fn call_tool(
        &self,
        tool_name: &str,
        params: serde_json::Value,
    ) -> Result<ToolResult, PluginError> {
        let tools = self.tools.read().await;
        if !tools.contains_key(tool_name) {
            return Err(PluginError::RuntimeError(format!(
                "工具 '{}' 未注册",
                tool_name
            )));
        }

        // TODO: 通过 jiti 运行时调用插件中的工具处理函数
        Ok(ToolResult {
            success: true,
            output: serde_json::json!({"message": "tool executed", "params": params}),
            error: None,
        })
    }

    /// 触发 Hook
    pub async fn trigger_hook(
        &self,
        event: HookEvent,
        context: serde_json::Value,
    ) -> serde_json::Value {
        let hooks = self.hooks.read().await;
        let ctx = context;

        for hook in hooks.iter().filter(|h| h.event == event) {
            // TODO: 通过 jiti 运行时执行 hook 处理函数
            let _ = &hook.plugin_name;
            // ctx 可被 hook 修改后传递给下一个
        }

        ctx
    }

    /// 列出所有已加载的插件
    pub async fn list_plugins(&self) -> Vec<PluginInfo> {
        self.plugins.read().await.values().cloned().collect()
    }
}
