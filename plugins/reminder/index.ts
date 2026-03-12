/**
 * reminder 插件
 * 提供日程提醒和定时任务能力
 */

import type { PluginAPI } from "../../src/types/plugin";

export default function register(api: PluginAPI) {
  api.registerTool({
    name: "set_reminder",
    description: "设置一个提醒，到时间后通过宠物和 Channel 通知用户",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "提醒内容",
        },
        time: {
          type: "string",
          description: "提醒时间（ISO 8601 格式或自然语言）",
        },
        repeat: {
          type: "string",
          enum: ["once", "daily", "weekly"],
          default: "once",
        },
      },
      required: ["message", "time"],
    },
    handler: async (params: { message: string; time: string; repeat?: string }) => {
      // TODO: 实现提醒调度
      return {
        scheduled: true,
        message: params.message,
        time: params.time,
        info: "提醒功能待实现",
      };
    },
  });

  // 注册后台服务（定时检查提醒）
  api.registerService({
    name: "reminder-checker",
    description: "定时检查到期的提醒",
    cron: "* * * * *", // 每分钟检查
    handler: async () => {
      // TODO: 检查到期提醒，触发通知
    },
  });
}
