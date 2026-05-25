# Tauri 主线化准入记录

记录日期：2026-05-24<br>
分支：`codex/architecture-stabilization`

## 结论

阶段 5.5 的准入结论是：`Tauri-continue-validation`。

Tauri 可以继续作为主线化候选方向推进，但当前不能升级为产品默认主线，也不能冻结 Electron。Electron 仍是当前稳定运行时和回退线；Tauri 继续承担迁移验证、补齐和准入复查。

2026-05-25 更新：根据用户决策，后续架构治理和剩余阶段以 Tauri 作为开发主线继续推进，Electron 暂停修改并仅保留为回退参考。该决策不等同于发布准入；真实 AI 和 CSV 保存对话框仍是发布前 P0 闸门。

阶段 7.1 更新：发布前架构闸门已固化到 `docs/architecture/release-gate.md`。Tauri 打包产物已完成构建和 release exe 启动 smoke；目标 Tauri 库已有用户数据时已补充设置页显式备份替换流程。真实 AI 和 CSV 保存对话框 P0 清零前，不建议把 Tauri 设为默认发布运行时。

## 判断依据

| 准入项 | 状态 | 证据或原因 |
| --- | --- | --- |
| Tauri 环境 | 通过 | `npm run tauri:info` 通过，Windows WebView2、Rust、Node、Tauri CLI 均可用。 |
| 前端契约 | 通过 | `npm run test:api-contract` 通过，CSV 返回值归一化契约仍稳定。 |
| API Key 展示边界 | 通过 | `npm run test:api-config-security` 通过；Tauri smoke 中 `getApiConfig` 仍不返回完整 Key。 |
| Tauri 路由加载 | 通过 | WebView2 CDP 覆盖 8 个核心 hash 路由，均能加载根节点内容。 |
| Tauri 本地 API | 通过 | CDP smoke 覆盖题库 CRUD、题目 CRUD、CSV 导入、练习记录、错题本、设置保存。 |
| Tauri 窗口控制 | 部分通过 | CDP smoke 验证最大化切换；最小化、拖拽和真实窗口点击仍需人工验收。 |
| CSV 文件保存 | 未通过准入 | 已补齐 `dialog:allow-save` 权限；CSV 模板下载和题库导出仍需要真实保存对话框人工点击验收取消路径和写入路径。 |
| 真实 AI 路径 | 阻塞 | Tauri 本机配置布尔检查显示 `hasSavedApiKey=false`，没有真实 API Key，未执行真实 AI 解析和 AI 聊天联网验收。 |
| 数据目录迁移 | 代码与契约层已补齐 | 已补充 Tauri 旧库候选和设置页显式备份替换流程；Rust 测试覆盖目标库缺失、已有 Tauri 空库替换、目标库已有用户数据时不覆盖、确认短语错误和非候选路径拒绝。 |
| 打包产物 | 构建与启动通过 | `npm run tauri:build` 通过，生成 `QuestPilot_1.6.7_x64-setup.exe`；release exe 启动 8 秒后仍存活，随后主动结束。 |

## 本轮补齐

- Tauri 旧库候选现在包含当前 Electron 数据目录：`QuestPilot`、`questpilot`。
- Tauri 旧库候选现在同时包含 `questpilot.db` 和旧版 `question-bank.db`。
- 新增 Rust 测试覆盖当前 Electron 数据目录候选，避免 Tauri 主线化时漏迁当前 Electron 数据。
- 已补齐已有 Tauri 空库场景：当目标库没有用户数据且候选旧库有用户数据时，启动时会用候选旧库替换空目标库。
- 已补齐覆盖保护：当目标 Tauri 库已有题库、设置、草稿、聊天、练习、错题、操作日志或用户自建 Prompt 等用户数据时，不会自动覆盖目标库。
- 已补齐显式处置流程：设置页在 Tauri 运行时显示“数据迁移”卡片，可查询旧库候选状态，并通过“备份并使用旧库替换”执行用户确认后的备份替换。
- 已补齐 Tauri 保存对话框权限：`src-tauri/capabilities/main.json` 增加 `dialog:allow-save`。

相关文件：

- `src-tauri/src/database.rs`
- `src-tauri/src/database/legacy.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/tests/database_store.rs`
- `src/api/index.js`
- `src/pages/Settings.jsx`

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
- 窗口拖拽、最小化和安装包安装后人工流程。

## 数据目录结论

当前本机观察到的数据目录：

| 运行时 | 路径 | 状态 |
| --- | --- | --- |
| Electron | `%APPDATA%\\QuestPilot\\questpilot.db` | 存在。 |
| Electron | `%APPDATA%\\questpilot\\questpilot.db` | 存在。 |
| Tauri | `%APPDATA%\\com.questpilot.desktop\\questpilot.db` | 存在。 |

Tauri 使用独立的应用数据目录，不能假设会自动读取 Electron 当前目录。阶段 5.5 已补齐新安装、目标库缺失和目标库为空时的候选迁移路径；如果目标 Tauri 库已有用户数据，则不会自动覆盖。阶段 7.1 已在设置页补充用户确认的备份替换流程；完整合并仍可作为后续增强，但不再需要静默覆盖或手工改库才能处置冲突。

## 决策

本轮不进入 `Tauri-first`，原因如下：

1. 真实 AI 解析和 AI 聊天没有 API Key，无法完成准入验收。
2. CSV 模板下载和 CSV 导出还没有真实保存对话框验收。
3. Tauri 打包产物已经完成构建和 release exe 启动 smoke，但安装包安装后核心流程仍需人工记录。

允许继续做的事：

- 优先补齐 Tauri 准入阻塞项。
- 后续阶段优先拆分、验证和固化 Tauri 链路。
- 新增跨运行时契约时先以 Tauri 能力为准，但必须保持 Electron 回退线不破坏。
- Electron 暂停主动修改；如后续必须修 Electron，只接受用户明确要求的 P0/P1 修复、安全修复、数据兼容修复和回退线保活。

不允许做的事：

- 不把 Tauri 设为默认发布运行时。
- 不在本阶段主动修改 Electron IPC 或数据库路径。
- 不删除 Electron IPC 或数据库路径。
- 不把 Tauri 开发主线决策写成发布准入已完成。

## 下次复查条件

进入 `Tauri-first` 前必须完成：

1. 在 Tauri 真实窗口中完成 CSV 文件选择、模板下载、题库导出、取消保存和实际写入路径验收。
2. 配置真实 API Key 后完成 AI 解析、AI 聊天、连接失败和错误脱敏验收。
3. 在设置页人工点击数据迁移备份替换流程，确认备份文件、替换结果和重启后数据状态。
4. 对安装包或 release exe 完成核心本地流程人工验收。
5. 保留一次 Electron smoke，确认稳定回退线未被破坏。

详细发布阻塞项、自动化命令和人工验收清单见 `docs/architecture/release-gate.md`。
