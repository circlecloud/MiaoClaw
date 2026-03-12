use serde::{Deserialize, Serialize};

/// 插件 API - 插件可注册的能力
/// 兼容 OpenClaw 的 registerTool / registerHook / registerService / registerRPC

/// 工具定义 - AI 可调用的工具
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    /// JSON Schema 描述参数
    pub parameters: serde_json::Value,
    /// 工具所属插件
    pub plugin_name: String,
}

/// 工具调用结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output: serde_json::Value,
    pub error: Option<String>,
}

/// Hook 定义 - 生命周期钩子
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookDefinition {
    pub name: String,
    pub event: HookEvent,
    pub plugin_name: String,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum HookEvent {
    /// 消息到达前
    BeforeMessage,
    /// 消息处理后
    AfterMessage,
    /// AI 响应前
    BeforeResponse,
    /// AI 响应后
    AfterResponse,
    /// 工具调用前
    BeforeToolCall,
    /// 工具调用后
    AfterToolCall,
    /// 应用启动
    OnStartup,
    /// 应用关闭
    OnShutdown,
    /// 宠物状态变化 (MiaoClaw 独有)
    OnPetStateChange,
}

/// RPC 方法定义 - 暴露给外部调用
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RPCDefinition {
    pub method: String,
    pub description: String,
    pub plugin_name: String,
}

/// 后台服务定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDefinition {
    pub name: String,
    pub description: String,
    pub plugin_name: String,
    /// cron 表达式（可选，定时任务）
    pub cron: Option<String>,
}

/// 宠物交互定义 (MiaoClaw 独有)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetReaction {
    pub trigger: String,
    pub animation: String,
    pub duration_ms: Option<u32>,
}
