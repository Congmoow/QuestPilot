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
  - 主题设置在 Tauri PoC 中暂用 `localStorage`。
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
- `csv_select_file`
- `csv_parse_file`

其中题库、批量创建、随机抽题仍是 PoC 级占位实现，尚未接入真实 SQLite 表结构。

## 当前阻塞

当前机器未安装或未暴露 Rust 工具链：

- `rustc --version` 无法执行。
- `cargo --version` 无法执行。
- `npm run tauri:info` 可识别 Tauri CLI、WebView2 与 Visual Studio 2022，但报告 `rustc`、`Cargo`、`rustup` 均未安装。

因此本阶段只能验证前端构建和配置静态结构，不能验证：

- `cargo check`
- `npm run tauri:dev`
- `npm run tauri:build`
- Tauri 实际窗口启动
- Tauri 安装包体积

## 下一步建议

1. 安装 Rust 工具链，并确认 `rustc`、`cargo` 在当前 PowerShell 会话可用。
2. 执行 `npm run tauri:info`，核对 Tauri CLI、Rust、WebView2 环境。
3. 执行 `npm run tauri:dev`，验证窗口控制、首页空数据兜底和资源路径。
4. 执行 `npm run tauri:build`，记录 Tauri bundle 体积。
5. 若 5B 窗口启动通过，再进入 5C：接入真实 Rust SQLite PoC。

## 验收边界

本阶段如果只完成静态骨架和前端构建，只能标记为 **implemented** 或 **tested**，不能标记为 **verified**。只有在 Rust 工具链可用并完成 Tauri dev/build 后，才能把 5B 标记为完整验证。
