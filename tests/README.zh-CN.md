# 测试目录说明

本目录只收纳前端、契约和端到端测试。Tauri / Rust 测试继续使用 Cargo 约定，放在 `src-tauri/tests`。

## 目录结构

- `unit/api/`：桌面 API 门面、运行时适配器和前端契约测试。
- `unit/features/`：前端功能模块的单元测试，包括 TOML 文本导入解析。
- `e2e/`：Playwright 端到端测试。
- `e2e/helpers/`：端到端测试夹具和 Tauri mock。

## 命令

- `npm test`：运行 `tests/unit` 下的 Vitest 测试。
- `npm run test:api-contract`：仅运行桌面 API 归一化契约测试。
- `npm run test:e2e`：运行 Playwright 端到端测试。
- `npm run test:rust`：运行 `src-tauri/tests` 与 Rust 单元测试。

## 维护边界

Electron 已不再作为维护运行时，Electron legacy 测试不进入正式测试体系。新增测试应优先覆盖 Tauri 主线、React 渲染层和稳定桌面 API 契约。
