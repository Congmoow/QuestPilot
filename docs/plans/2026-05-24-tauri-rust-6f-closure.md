# Tauri + Rust 6F 收尾记录

## 目标

阶段 6F 用于收尾核对 Tauri + Rust 正式迁移准备分支，重点确认 Electron/Tauri 双轨 API 差异、补齐剩余高频能力、重新验证构建链，并给出后续合并前的剩余风险。

## 已完成内容

- 核对 Electron `preload` 与前端 `src/api/index.js` 的运行时适配状态。
- 补齐 Tauri 路线剩余 CSV 能力：
  - CSV 模板下载。
  - CSV 文件解析。
  - CSV 批量导入。
  - 题库 CSV 导出。
- 新增 Rust CSV 纯逻辑模块 `src-tauri/src/csv_tools.rs`。
- 新增 CSV 行为测试 `src-tauri/tests/csv_tools.rs`。
- 前端 CSV API 保持 Electron 优先，Tauri 环境走 Rust command。

## 当前 API 对齐状态

- 题库、题目、统计、练习记录、错题本、草稿、API 配置、Prompt、聊天历史、AI 调用链均已有 Tauri command。
- CSV 的模板下载、选择文件、解析、导入、导出已补齐 Tauri command。
- Electron 稳定线仍保留，前端运行时优先使用 `window.electronAPI`。

## 验证重点

- Rust CSV 模板、解析、导出测试覆盖中文表头、有效/无效行、选项和答案导出。
- 数据库测试继续覆盖题库、题目、练习、错题、Prompt、聊天历史和设置。
- AI 测试继续覆盖多供应商请求构造、JSON 提取、题目归一化和聊天响应解析。
- 生产构建同时验证 Tauri 与 Electron 双轨。

## 本轮验证结果

- `cargo fmt -- --check` 通过。
- `cargo test --test csv_tools` 通过，3 个测试通过。
- `cargo test --test ai_client` 通过，5 个测试通过。
- `cargo test --test database_store` 通过，11 个测试通过。
- `cargo check` 通过。
- `git diff --check` 仅有行尾提示，无尾随空白错误。
- 新增文档和 Rust 文件 UTF-8 无 BOM 检查通过。
- `npm run build` 通过。
- `npm run tauri:build` 通过。
- `npm run electron:pack` 通过。
- 前端调用的 52 个 Tauri command 均能在 `generate_handler` 中找到注册项。
- Tauri 生产 exe 8 秒启动 smoke 通过。
- Electron 打包版 exe 8 秒启动 smoke 通过。

## 当前体积

- Tauri release exe 约 16.80 MB。
- Tauri NSIS 安装包约 5.69 MB。
- Electron exe 约 180.07 MB。
- Electron 解包目录约 271.71 MB。
- 前端 `dist` 约 2.83 MB。

## 剩余风险

- 未使用真实用户 API Key 做联网 AI 验收。
- 未用人工点击方式完整跑 Tauri UI 的 CSV 下载/导出保存对话框。
- Tauri 仍处在迁移分支，尚未建议替换 Electron 稳定发布线。

## 建议

短期继续保留 Electron/Tauri 双轨。合并前建议开 PR 做一次独立 review，并在真实 Tauri 窗口中手动 smoke：创建题库、CSV 导入、随机练习、错题本、AI 配置保存、AI 问答和 CSV 导出。
