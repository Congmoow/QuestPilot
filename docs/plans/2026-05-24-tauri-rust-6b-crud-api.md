# Tauri + Rust 6B 题库与题目 CRUD 实施记录

## 目标

阶段 6B 的目标是在 6A 数据库底座之上，补齐 Tauri + Rust 路线中题库和题目的常用 CRUD 能力，并让前端 `src/api/index.js` 可以在 Electron 与 Tauri 运行时之间复用同一组业务 API。

本阶段不删除 Electron 稳定线，不切换默认发布链路，也不迁移 AI、错题本、统计、聊天历史等更高层业务。

## 已完成内容

- 扩展 `DatabaseStore` 的题库能力：
  - 按 ID 读取题库
  - 更新题库
  - 删除题库及其题目
- 扩展 `DatabaseStore` 的题目能力：
  - 创建单题
  - 分页读取题库题目
  - 按 ID 读取题目
  - 更新题目
  - 批量删除题目
  - 搜索题目
  - 按条件统计题目数量
- 新增 Tauri command：
  - `question_bank_get_by_id`
  - `question_bank_update`
  - `question_bank_delete`
  - `question_create`
  - `question_get_by_bank_id`
  - `question_get_by_id`
  - `question_update`
  - `question_delete`
  - `question_search`
- 扩展前端 API 适配层：
  - Electron 运行时继续优先走 `window.electronAPI`
  - Tauri 运行时走 `invoke(...)`
  - 页面和 Context 层继续使用现有 `src/api/index.js` 暴露的函数
- 补充 Rust 集成测试，覆盖题库更新/读取/删除、题目创建/分页/筛选/搜索/更新/删除。

## 对齐原则

- 返回字段继续使用前端已有的 camelCase 结构，例如 `bankId`、`createdAt`、`updatedAt`、`pageSize`、`totalPages`。
- 分页结构对齐 Electron 侧 `question:getByBankId` 和 `question:search` 的返回形状。
- 删除、搜索、题型筛选等边界行为尽量保持与 Electron 现有实现一致。
- Rust 数据库层优先使用参数化 SQL，避免把前端输入直接拼进 SQL。

## 已验证内容

- `cargo test --test database_store`
- `cargo fmt -- --check`
- `cargo check`
- `npm run build`
- `git diff --check`
- `npm run tauri:build`
- `npm run electron:pack`

## 未完成内容

- 尚未迁移错题本、练习记录、统计、Prompt、AI 配置与聊天历史。
- 尚未建立 Electron/Tauri 双运行时端到端 UI 自动化回归。
- 尚未将 Tauri 作为默认发布链路。

## 下一步建议

阶段 6C 建议继续迁移错题本、练习记录与统计相关 Rust command，并补充与现有 Electron 数据结构对齐的数据库测试。
