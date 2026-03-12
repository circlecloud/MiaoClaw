# MiaoClaw 🐱

桌面宠物 + 个人 AI 助理，兼容 OpenClaw 插件生态。

## 特性

- 🖥️ 跨平台：Windows / macOS / Linux
- 🐱 多风格宠物：像素风、矢量风、Live2D、CSS极简、Minecraft基岩模型、SMD模型
- 🤖 AI 助理：支持 Ollama / OpenAI / Claude / 任意 OpenAI 兼容 API
- 📱 多 Channel：桌面对话 + Telegram / Discord / Slack 等
- 🔌 插件系统：兼容 OpenClaw 插件格式
- 📦 轻量安装：基于 Tauri，安装包 ~5-10MB

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建
npm run tauri build
```

## 项目结构

```
src-tauri/     Rust 后端（AI/Channel/Plugin/Storage）
src/           React 前端（宠物渲染/对话/设置）
plugins/       内置插件
assets/        宠物资源
```

## 插件开发

插件使用 `miaoclaw.plugin.json`（同时兼容 `openclaw.plugin.json`）：

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "entry": "./index.ts",
  "configSchema": {}
}
```

详见 `plugins/` 目录下的示例。

## License

MIT
