/**
 * MiaoClaw 插件 API 类型定义
 * 兼容 OpenClaw 的 registerTool / registerHook / registerService / registerRPC
 */

export interface PluginAPI {
  /** 注册 AI 可调用的工具 */
  registerTool(tool: ToolRegistration): void;

  /** 注册生命周期钩子 */
  registerHook(hook: HookRegistration): void;

  /** 注册后台服务 */
  registerService(service: ServiceRegistration): void;

  /** 注册 RPC 方法（供外部调用） */
  registerRPC(rpc: RPCRegistration): void;

  /** MiaoClaw 独有：注册宠物交互反应 */
  registerPetReaction?(reaction: PetReactionRegistration): void;

  /** 获取插件配置 */
  getConfig<T = unknown>(): T;

  /** 日志 */
  log: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
}

export interface ToolRegistration {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface HookRegistration {
  event:
    | "before_message"
    | "after_message"
    | "before_response"
    | "after_response"
    | "before_tool_call"
    | "after_tool_call"
    | "on_startup"
    | "on_shutdown"
    | "on_pet_state_change";
  priority?: number;
  handler: (context: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface ServiceRegistration {
  name: string;
  description: string;
  cron?: string;
  handler: () => Promise<void>;
}

export interface RPCRegistration {
  method: string;
  description: string;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface PetReactionRegistration {
  trigger: string;
  animation: string;
  durationMs?: number;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema & { description?: string; default?: unknown; enum?: unknown[] }>;
  required?: string[];
  [key: string]: unknown;
}
