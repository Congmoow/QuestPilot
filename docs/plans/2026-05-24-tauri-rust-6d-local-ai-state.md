# Tauri + Rust 6D 本地 AI 状态实施记录

## 目标

阶段 6D 的目标是在 6C 练习、错题本与统计能力的基础上，迁移与 AI 页面相关的本地状态能力，包括草稿、API 配置、Prompt 管理和聊天历史。

本阶段继续保留 Electron 稳定线，不迁移实际 AI 网络调用、AI 解析、AI 问答和 API 连接测试。

## 已完成内容

- 扩展 Rust 数据库初始化：
  - `ai_prompts`
  - `chat_history`
  - `idx_chat_history_updated`
- 扩展 `DatabaseStore`：
  - 保存、读取和清除手动录入草稿
  - 获取和保存 AI API 配置
  - 初始化默认 Prompt
  - Prompt 列表、按 ID 查询、创建、更新和删除
  - 阻止删除默认 Prompt
  - 聊天历史保存、更新、列表、按 ID 查询和删除
- 新增 Tauri command：
  - `settings_get_api_config`
  - `settings_set_api_config`
  - `draft_save`
  - `draft_load`
  - `draft_clear`
  - `prompt_get_all`
  - `prompt_get_by_id`
  - `prompt_create`
  - `prompt_update`
  - `prompt_delete`
  - `chat_history_save`
  - `chat_history_update`
  - `chat_history_get_all`
  - `chat_history_get_by_id`
  - `chat_history_delete`
- 扩展前端 `src/api/index.js`：
  - 草稿 API 支持 Tauri `invoke(...)`
  - API 配置读写支持 Tauri `invoke(...)`
  - 新增统一 `prompt` API
  - 新增统一 `chatHistory` API
- 更新页面调用：
  - `Settings.jsx` 的 Prompt 管理改为走统一 API
  - `AiChat.jsx` 的 Prompt 和聊天历史改为走统一 API

## 测试覆盖

新增 Rust 数据库测试覆盖：

- 草稿保存、读取、清除
- API 配置默认值与持久化
- 默认 Prompt 初始化
- Prompt 创建、更新、按 ID 查询和删除
- 默认 Prompt 删除保护
- 聊天历史保存、更新、列表、按 ID 查询和删除

## 行为对齐

- API 配置默认值对齐 Electron：
  - `apiUrl`: `https://api.openai.com`
  - `modelId`: `gpt-3.5-turbo`
  - `provider`: `custom`
  - `apiKey`: 空字符串
- 草稿读取会补充 `savedAt` 字段，保持前端使用方式不变。
- Prompt 字段继续使用 `isDefault / createdAt / updatedAt` 的 camelCase 序列化。
- 聊天历史列表不返回完整 `messages`，详情和保存/更新结果返回完整 `messages`。
- Tauri 命令需要返回成功状态的地方继续返回 `{ success: true }`。

## 未完成内容

- 尚未迁移 `settings:testApiConnection`。
- 尚未迁移 `ai:parseQuestions`。
- 尚未迁移 `ai:chat`。
- 尚未将 Tauri 作为默认发布链路。

## 下一步建议

阶段 6E 建议单独迁移 AI 调用链或先做 AI 调用适配层设计，重点处理模型配置、网络错误、分块解析、Prompt 注入和聊天历史保存之间的边界。
