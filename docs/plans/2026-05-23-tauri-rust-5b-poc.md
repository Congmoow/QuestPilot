# Tauri + Rust 5B 最小 PoC 实施记录

## 目标

阶段 5B 的目标是建立 Tauri + Rust 最小壳，并验证现有 React/Vite 前端是否可以通过适配层同时保留 Electron 与 Tauri 两条运行路径。

本阶段不做正式迁移，不删除 Electron，不迁移完整 IPC，不迁移 AI 能力。

## 已纳入 PoC 的范围

- 新增 `src-tauri/` 最小工程骨架。
- 新增 Tauri 运行脚本：
  - `npm run tauri:dev`
  - `npm run tauri:build`
  - `npm run tauri:info`
- 新增前端运行时适配层：
  - Electron 环境继续使用 `window.electronAPI`。
  - Tauri 环境使用 `@tauri-apps/api/core` 的 `invoke`。
  - 普通浏览器环境返回明确的桌面 API 不可用错误。
- 将自定义标题栏窗口控制改为共享适配层调用。
- 让首页启动关键路径具备 Tauri PoC 兜底：
  - 题库列表返回 Rust command 结果。
  - 仪表盘统计、操作日志、练习统计先返回空数据。
  - 主题设置在 5C 中已接入 Rust SQLite settings 表。
- 为 CSV 文件选择和 CSV 行数读取预留 Rust command。

## Rust command 范围

阶段 5B 只注册以下命令：

- `window_minimize`
- `window_maximize`
- `window_close`
- `window_is_maximized`
- `question_bank_get_all`
- `question_create_batch`
- `question_get_random`
- `settings_get_theme`
- `settings_set_theme`
- `csv_select_file`
- `csv_parse_file`

其中题库创建、题库列表、批量创建、随机抽题和主题设置已在 5C 中接入真实 SQLite PoC。

## 验证状态

Rust 工具链已迁到 D 盘路径：

- `CARGO_HOME=D:\Rust\.cargo`
- `RUSTUP_HOME=D:\Rust\.rustup`
- 当前会话通过 `D:\Rust\.cargo\bin` 和 `D:\Rust\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin` 运行 Rust。

已完成验证：

- `npm run tauri:info` 可识别 `rustc 1.95.0`、`cargo 1.95.0`、WebView2 与 Visual Studio 2022。
- `cd src-tauri && cargo check` 通过。
- `npm run tauri:build` 通过。
- Tauri 生产 exe 短时启动 smoke 通过：进程启动并保持运行 8 秒后手动结束。

当前体积：

- `src-tauri/target/release/questpilot-tauri.exe`：约 12.05 MB。
- `src-tauri/target/release/bundle/nsis/QuestPilot_1.5.6_x64-setup.exe`：约 4.19 MB。
- 对照当前 Electron `release/win-unpacked/QuestPilot.exe`：约 180.07 MB。

## 下一步建议

1. 用 Playwright 或手动方式补充 Tauri UI 交互 smoke：窗口控制、题库创建、批量导入、随机抽题。
2. 继续补齐 Rust command：题库更新 / 删除、题目分页 / 搜索、统计、练习记录。
3. 设计旧 Electron `questpilot.db` 到 Tauri app data 目录的迁移策略。

## 验收边界

5B 壳和生产构建已完成可用性验证；5C SQLite PoC 仍需进一步做 UI 层交互验证与旧数据迁移验证。
