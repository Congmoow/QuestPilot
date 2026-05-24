# Tauri 主线化准入记录

记录日期：2026-05-24<br>
分支：`codex/architecture-stabilization`

## 结论

阶段 5.5 的准入结论是：`Tauri-continue-validation`。

Tauri 可以继续作为主线化候选方向推进，但当前不能升级为产品默认主线，也不能冻结 Electron。Electron 仍是当前稳定运行时和回退线；Tauri 继续承担迁移验证、补齐和准入复查。

## 判断依据

| 准入项 | 状态 | 证据或原因 |
| --- | --- | --- |
| Tauri 环境 | 通过 | `npm run tauri:info` 通过，Windows WebView2、Rust、Node、Tauri CLI 均可用。 |
| 前端契约 | 通过 | `npm run test:api-contract` 通过，CSV 返回值归一化契约仍稳定。 |
| API Key 展示边界 | 通过 | `npm run test:api-config-security` 通过；Tauri smoke 中 `getApiConfig` 仍不返回完整 Key。 |
| Tauri 路由加载 | 通过 | WebView2 CDP 覆盖 8 个核心 hash 路由，均能加载根节点内容。 |
| Tauri 本地 API | 通过 | CDP smoke 覆盖题库 CRUD、题目 CRUD、CSV 导入、练习记录、错题本、设置保存。 |
| Tauri 窗口控制 | 部分通过 | CDP smoke 验证最大化切换；最小化、拖拽和真实窗口点击仍需人工验收。 |
| CSV 文件保存 | 未通过准入 | CSV 模板下载和题库导出需要真实保存对话框；本轮未自动触发，仍需人工点击验收取消路径和写入路径。 |
| 真实 AI 路径 | 阻塞 | Tauri 本机配置中没有已保存 API Key，未执行真实 AI 解析和 AI 聊天联网验收。 |
| 数据目录迁移 | 部分补齐 | 已补充 Tauri 旧库候选，覆盖当前 Electron `QuestPilot`/`questpilot` 数据目录；已用 Rust 测试验证候选路径。已有 Tauri 空库时仍需人工迁移或重置策略。 |
| 打包产物 | 未验收 | 本轮只跑 dev smoke，没有执行 `npm run tauri:build` 或安装包级 smoke。 |

## 本轮补齐

- Tauri 旧库候选现在包含当前 Electron 数据目录：`QuestPilot`、`questpilot`。
- Tauri 旧库候选现在同时包含 `questpilot.db` 和旧版 `question-bank.db`。
- 新增 Rust 测试覆盖当前 Electron 数据目录候选，避免 Tauri 主线化时漏迁当前 Electron 数据。

相关文件：

- `src-tauri/src/database.rs`
- `src-tauri/tests/database_store.rs`

## 运行时准入 smoke

Tauri WebView2 CDP smoke 覆盖结果：

| 项目 | 结果 |
| --- | --- |
| Runtime 识别 | 通过，前端识别为 Tauri。 |
| Electron API 隔离 | 通过，Tauri 页面没有 `window.electronAPI`。 |
| API 配置公开边界 | 通过，公开配置不返回完整 Key。 |
| 保存的 API Key | 未配置，`hasSavedApiKey=false`。 |
| 路由加载 | 通过，8 个核心路由均有根节点内容。 |
| 窗口最大化切换 | 通过。 |
| 设置保存 | 通过。 |
| 题库 CRUD | 通过。 |
| 题目 CRUD | 通过。 |
| CSV 导入 | 通过。 |
| 练习记录 | 通过。 |
| 错题本 | 通过。 |

未覆盖：

- CSV 保存对话框真实点击。
- 文件选择对话框真实点击。
- AI 解析与 AI 聊天真实联网请求。
- 窗口拖拽、最小化和打包产物。

## 数据目录结论

当前本机观察到的数据目录：

| 运行时 | 路径 | 状态 |
| --- | --- | --- |
| Electron | `%APPDATA%\\QuestPilot\\questpilot.db` | 存在。 |
| Electron | `%APPDATA%\\questpilot\\questpilot.db` | 存在。 |
| Tauri | `%APPDATA%\\com.questpilot.desktop\\questpilot.db` | 存在。 |

Tauri 使用独立的应用数据目录，不能假设会自动读取 Electron 当前目录。阶段 5.5 已补齐新安装或目标库缺失时的候选迁移路径；如果用户已经启动过 Tauri 并生成空库，仍需要明确人工迁移、导入或重置策略。

## 决策

本轮不进入 `Tauri-first`，原因如下：

1. 真实 AI 解析和 AI 聊天没有 API Key，无法完成准入验收。
2. CSV 模板下载和 CSV 导出还没有真实保存对话框验收。
3. Tauri 打包产物未验收。
4. 已存在 Tauri 空库时的数据迁移策略仍需明确。

允许继续做的事：

- 优先补齐 Tauri 准入阻塞项。
- 新增跨运行时契约时先以 Tauri 能力为准，但必须保持 Electron 回退线不破坏。
- Electron 继续接受 P0/P1 修复、安全修复、数据兼容修复和回退线保活。

不允许做的事：

- 不把 Tauri 设为默认发布运行时。
- 不冻结 Electron 到完全不改。
- 不删除 Electron IPC 或数据库路径。
- 不开始阶段 6，直到阶段 5.5 提交并推送完成。

## 下次复查条件

进入 `Tauri-first` 前必须完成：

1. 在 Tauri 真实窗口中完成 CSV 文件选择、模板下载、题库导出、取消保存和实际写入路径验收。
2. 配置真实 API Key 后完成 AI 解析、AI 聊天、连接失败和错误脱敏验收。
3. 明确已有 Tauri 空库场景下的 Electron 数据迁移策略。
4. 执行 Tauri 打包或预览级 smoke。
5. 保留一次 Electron smoke，确认稳定回退线未被破坏。
