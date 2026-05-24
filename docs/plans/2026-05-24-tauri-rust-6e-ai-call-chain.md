# Tauri + Rust 6E AI 调用链实施记录

## 目标

阶段 6E 的目标是在 6D 本地 AI 状态能力的基础上，补齐 Tauri 路线中的 AI 调用链，让 Tauri 可以使用本地保存的 API 配置完成连接测试、AI 问答和 AI 题目解析。

本阶段继续保留 Electron 稳定线，前端仍优先使用 Electron API；只有运行在 Tauri 环境时才走 Rust command。

## 已完成内容

- 新增 Rust AI 模块 `src-tauri/src/ai.rs`：
  - OpenAI 兼容请求构造
  - Claude / Anthropic 请求构造
  - Gemini 请求构造
  - API 响应内容抽取
  - AI 返回 JSON 提取
  - Markdown 分块
  - AI 解析结果归一化
  - 连接测试
  - AI 问答
  - AI 题目解析
- 新增 Tauri command：
  - `settings_test_api_connection`
  - `ai_parse_questions`
  - `ai_chat`
- 扩展前端 `src/api/index.js`：
  - `settings.testApiConnection` 支持 Tauri
  - `ai.parseQuestions` 支持 Tauri
  - 新增统一 `ai.chat`
- 更新 `AiChat.jsx`：
  - AI 对话发送改为走统一 `api.ai.chat`
- 更新 Rust 依赖：
  - `reqwest`
  - `url`

## 测试覆盖

新增 Rust AI 测试覆盖：

- OpenAI 兼容聊天请求构造
- Gemini 题目解析请求构造
- 围栏 JSON 提取
- 题目类型、选项和答案归一化
- Markdown 分块
- 聊天响应解析
- API 错误响应处理

## 行为对齐

- Tauri AI 调用会读取 6D 中保存的 API 配置。
- `ai_chat` 会根据 `promptId` 读取自定义 Prompt，并注入 system prompt。
- `ai_parse_questions` 会按 Markdown 分块逐块解析，并汇总 `questions / chunkErrors / chunks`。
- OpenAI 兼容 API 默认补齐 `/v1/chat/completions`。
- Claude 使用 `/v1/messages` 和 `x-api-key`。
- Gemini 使用 `/v1beta/models/{model}:generateContent` 和 `x-goog-api-key`。
- 前端错误展示仍沿用现有页面逻辑。

## 未完成内容

- 未使用真实用户 API Key 做联网验收。
- 尚未补 Electron/Tauri 双运行时 UI 自动化测试。
- 尚未迁移 CSV 导出、模板下载等剩余非 AI 能力。
- 尚未决定是否让 Tauri 替代 Electron 作为默认发布链路。

## 下一步建议

阶段 6F 建议做收尾核对：对齐 Electron/Tauri API 清单、补 CSV 剩余能力、做真实 Tauri UI smoke、统计包体积，并形成是否继续双轨或准备合并的最终建议。
