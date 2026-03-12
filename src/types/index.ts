/// 宠物渲染风格
export type PetStyle =
  | "pixel"    // PixiJS 精灵帧动画
  | "lottie"   // Lottie 矢量动画
  | "live2d"   // Live2D 模型
  | "css"      // CSS + SVG 极简风
  | "bedrock"  // Minecraft 基岩版模型
  | "smd"      // SMD (Source Engine) 模型

/// 宠物动画状态
export type PetAnimation =
  | "idle"
  | "walk"
  | "talk"
  | "sleep"
  | "happy"
  | "sad"
  | "think"
  | "wave"
  | "eat"
  | "custom"

/// 宠物渲染器接口 - 所有风格必须实现
export interface PetRendererProps {
  style: PetStyle;
  animation: PetAnimation;
  width: number;
  height: number;
  onAnimationEnd?: () => void;
  customData?: Record<string, unknown>;
}

/// 宠物状态
export interface PetState {
  currentStyle: PetStyle;
  currentAnimation: PetAnimation;
  positionX: number;
  positionY: number;
  mood: number; // 0-1
}

/// AI Provider 配置
export interface ProviderConfig {
  id: string;
  providerType: "ollama" | "openai_compat";
  displayName: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  enabled: boolean;
}

/// 对话消息
export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
  channelType?: string;
}

/// Channel 状态
export interface ChannelStatus {
  id: string;
  channelType: string;
  displayName: string;
  running: boolean;
}

/// 插件信息
export interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  loaded: boolean;
  source: "builtin" | "user" | "openclaw";
}

/// 应用配置
export interface AppConfig {
  providers: ProviderConfig[];
  defaultProvider?: string;
  petStyle: PetStyle;
  alwaysOnTop: boolean;
  autoStart: boolean;
  globalShortcut: string;
  language: "zh-CN" | "en-US";
}
