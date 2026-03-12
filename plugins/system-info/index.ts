/**
 * system-info 插件
 * 提供系统信息查询工具给 AI 使用
 */

import type { PluginAPI } from "../../src/types/plugin";

export default function register(api: PluginAPI) {
  api.registerTool({
    name: "get_system_info",
    description: "获取当前系统信息，包括操作系统、CPU、内存、磁盘使用情况",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["os", "cpu", "memory", "disk", "all"],
          description: "要查询的信息类别",
        },
      },
    },
    handler: async (params: { category?: string }) => {
      // TODO: 通过 Tauri shell 插件获取系统信息
      return {
        category: params.category || "all",
        message: "系统信息查询功能待实现",
      };
    },
  });
}
