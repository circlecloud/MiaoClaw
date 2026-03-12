/**
 * web-search 插件
 * 提供网页搜索能力给 AI
 */

import type { PluginAPI } from "../../src/types/plugin";

export default function register(api: PluginAPI) {
  api.registerTool({
    name: "web_search",
    description: "搜索互联网获取最新信息",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词",
        },
        maxResults: {
          type: "number",
          description: "最大返回结果数",
          default: 5,
        },
      },
      required: ["query"],
    },
    handler: async (params: { query: string; maxResults?: number }) => {
      // TODO: 实现搜索引擎 API 调用
      return {
        query: params.query,
        results: [],
        message: "搜索功能待实现",
      };
    },
  });
}
