# 双运行时验收记录

记录日期：2026-05-24<br>
分支：`codex/architecture-stabilization`

## 结论

- 本文前半部分保留阶段 5 的双运行时历史验收记录。
- 2026-05-25 起，远端发布线切换为 Tauri-only；Electron 代码仅在本地未跟踪文件中保留，不再作为远端发布或 CI 对象。
- 阶段 7 已新增发布前架构闸门：`docs/architecture/release-gate.md`。阶段 7.1 已补齐 Tauri 数据冲突显式处置和打包产物构建启动证据；阶段 7.2 用户已完成人工 API 接入和 CSV 保存验收，发布 P0 已清零。
- 阶段 5 的目标是把真实状态、差异类别和发布前阻塞项固化到文档中；未完成的人工验收不会写成已验证。
- 阶段 5.5 的详细记录见 `docs/architecture/tauri-mainline-readiness.md`。

## 状态定义

| 状态       | 含义                                                 |
| ---------- | ---------------------------------------------------- |
| 已验证     | 已有自动化测试或运行时 smoke 证据覆盖。              |
| 待人工验收 | 需要真实窗口点击、文件对话框或真实 AI Key 才能确认。 |
| 发布阻塞   | 在恢复发布或切换默认运行时前必须解决。               |
| 不适用     | 当前运行时或当前阶段不要求覆盖。                     |

## 当前正式测试入口

- `npm test`：运行 `tests/unit` 下的 Vitest 单元测试与前端契约测试。
- `npm run test:api-contract`：仅运行桌面 API 归一化契约测试。
- `npm run test:e2e`：运行 `tests/e2e` 下的 Playwright 端到端测试。
- `npm run test:rust`：运行 Tauri / Rust 测试；Rust 集成测试继续放在 `src-tauri/tests`。

Electron 已不再作为维护运行时，Electron legacy 测试不进入正式测试体系。

## 本轮证据

| 范围                  | 证据                                                                       | 结果                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron 契约         | `npm run test:api-contract`                                                | 通过，5 个契约测试通过。                                                                                                                                                                                                           |
| Electron 构建         | `npm run build`                                                            | 通过，Vite 生产构建成功。                                                                                                                                                                                                          |
| Electron 运行时 smoke | Electron CDP smoke                                                         | 通过：公开配置不返回完整 Key，设置保存、题库 CRUD、题目 CRUD、随机练习数据、CSV 导入、练习记录、错题本、Prompt、聊天历史和 8 个页面路由均通过。                                                                                    |
| Electron AI           | Electron CDP smoke                                                         | 未执行真实 AI 网络请求；本机已有 Key 时记录为 `skipped-existing-key`。                                                                                                                                                             |
| Tauri 环境            | `npm run tauri:info`                                                       | 通过，Windows WebView2、Rust、Node、Tauri CLI 均可用。                                                                                                                                                                             |
| Tauri Rust            | `cargo test`                                                               | 通过，Rust 全量测试通过。                                                                                                                                                                                                          |
| Tauri 启动            | `npm run tauri:dev`                                                        | 通过，Vite 与 `questpilot-tauri.exe` 正常启动；WebView2 CDP 可见 `QuestPilot` 页面目标。                                                                                                                                           |
| Tauri 路由            | WebView2 CDP route smoke                                                   | 通过：`#/dashboard`、`#/manual-entry`、`#/csv-import`、`#/practice`、`#/wrong-book`、`#/ai-import`、`#/ai-chat`、`#/settings` 均能加载根节点内容。                                                                                 |
| Tauri API             | WebView2 CDP API smoke                                                     | 通过：Tauri runtime 识别、无 Electron API、公开配置不返回完整 Key、设置保存、题库 CRUD、题目 CRUD、CSV 导入、练习记录、错题本、Prompt、聊天历史均通过，并清理临时数据。                                                            |
| Tauri 主线化准入      | 阶段 5.5 smoke、阶段 7.1 数据冲突处置与打包产物验证、阶段 7.2 用户人工验收 | 可以进入 `Tauri-first` 发布收口；Tauri 本地 API、路由、最大化切换、已有 Tauri 空库迁移、目标库已有用户数据时的显式备份替换、`npm run tauri:build` 和 release exe 启动 smoke 通过；用户已确认 API 接入和 CSV 保存人工测试没有问题。 |

说明：Tauri smoke 结束时通过 `Ctrl+C` 正常中断 dev 进程，控制台返回 `STATUS_CONTROL_C_EXIT` 属于本次受控退出的预期结果。Electron smoke 中仍可见既有 Windows 网络状态告警 `WSALookupServiceBegin failed with: 10108`，未导致运行时退出。

## 核心流程验收矩阵

| 核心流程     | Electron 状态 | Tauri 状态       | 差异类别               | 说明                                                                                                  |
| ------------ | ------------- | ---------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| 题库 CRUD    | 已验证        | 已验证           | 无阻塞契约差异         | 两端 smoke 均覆盖创建、更新、读取和删除临时题库。                                                     |
| 题目 CRUD    | 已验证        | 已验证           | 无阻塞契约差异         | 两端 smoke 均覆盖创建、更新、读取、列表和搜索。                                                       |
| 随机练习数据 | 已验证        | 已验证           | 无阻塞契约差异         | Electron 覆盖随机题获取；Tauri 覆盖随机题获取和练习记录保存读取。                                     |
| CSV 导入     | 已验证        | 已验证           | 无阻塞契约差异         | 两端均导入 1 道临时单选题，结果为成功 1、失败 0。                                                     |
| CSV 模板下载 | 待人工验收    | 用户人工验收通过 | 权限差异、文件系统差异 | Tauri 已补齐 `dialog:allow-save`；用户反馈 Tauri 线 CSV 保存人工测试没有问题。                        |
| CSV 导出     | 待人工验收    | 用户人工验收通过 | 权限差异、文件系统差异 | Tauri 已补齐 `dialog:allow-save`；用户反馈 Tauri 线 CSV 保存人工测试没有问题。                        |
| 错题本       | 已验证        | 已验证           | 无阻塞契约差异         | 两端均覆盖从练习结果写入错题本并读取。                                                                |
| Prompt       | 已验证        | 已验证           | 无阻塞契约差异         | 两端均覆盖 Prompt 列表或临时 Prompt 创建读取。                                                        |
| 聊天历史     | 已验证        | 已验证           | 无阻塞契约差异         | 两端均覆盖聊天历史保存读取删除。                                                                      |
| 设置保存     | 已验证        | 已验证           | 无阻塞契约差异         | 两端均验证公开配置不返回完整 Key；Tauri 额外验证主题设置保存读取。                                    |
| AI 解析      | 待人工验收    | 用户人工验收通过 | 外部服务差异           | 用户反馈 Tauri 线 API 接入人工测试没有问题。                                                          |
| AI 聊天      | 待人工验收    | 用户人工验收通过 | 外部服务差异           | 用户反馈 Tauri 线 API 接入人工测试没有问题；聊天历史本地存储已有自动化 smoke 证据。                   |
| 页面路由     | 已验证        | 已验证           | 窗口差异               | Electron 和 Tauri 均覆盖 8 个核心 hash 路由加载。Tauri 仍需真实窗口尺寸、拖拽和系统窗口按钮人工验收。 |

## 差异归类

### 契约差异

- 本轮覆盖到的题库、题目、CSV 导入、练习记录、错题本、Prompt、聊天历史和设置读取保存没有发现阻塞级契约漂移。
- Tauri CSV 模板下载和 CSV 导出已由用户人工验收通过；Electron 侧不在当前发布主线范围内。

### 权限差异

- Tauri capability 当前显式列出 `dialog:allow-open` 和 `dialog:allow-save`；CSV 保存流程目前由 Rust command 内部调用保存对话框，自动 smoke 未触发保存对话框。
- Tauri 窗口中的 CSV 保存已由用户人工验收通过；后续若改动保存链路，必须重新覆盖模板下载、题库导出、取消保存和实际写入路径。
- 如果后续改为前端直接调用 Tauri dialog 插件，必须补充 `dialog:allow-save` 或 `dialog:default` 并重新验收。

### 窗口和文件系统差异

- Electron 和 Tauri 使用不同运行时、窗口壳和应用数据目录。阶段 5 只验证临时数据在各自运行时内可用；阶段 5.5 已补齐目标 Tauri 库缺失或为空时的 Electron 候选库迁移，并保护已有用户数据的 Tauri 目标库不被静默覆盖。阶段 7.1 已补充 Tauri 设置页的显式备份替换流程。
- Tauri 的透明无边框窗口、拖拽区域、最小化、最大化和关闭按钮需要真实窗口人工点击验收。

### 未实现或未完成验收

- Tauri 真实 API 接入已由用户人工验收通过；Electron 真实 AI 仍不在当前发布主线范围内。
- Tauri 已执行 `npm run tauri:build` 并完成 release exe 8 秒启动 smoke；安装包安装后核心流程仍需人工验收。
- Tauri 可以进入发布默认运行时收口；安装包核心流程、窗口控制和数据迁移点击仍建议补记。

## 运行时取舍

短期取舍：

- Tauri 作为后续架构治理和模块拆分的开发主线，继续通过 `cargo test`、`npm run tauri:info`、`npm run tauri:dev` 和必要的 CDP smoke 保活。
- Electron 代码仅本地保留，不再作为远端发布或 CI 对象。

Tauri 替换 Electron 前的剩余收口项：

1. 人工点击目标 Tauri 库已有用户数据时的显式备份替换流程，并确认备份、替换和重启后数据状态。
2. 对安装包或 release exe 完成核心本地流程人工验收。
3. 覆盖窗口控制、文件选择取消路径和异常路径。
4. 更新正式发布记录，明确发布版本、产物路径和人工验收人。

## 发布前验收清单

完整闸门见 `docs/architecture/release-gate.md`。本节仅保留运行时验收入口。

- `npm run test:api-contract`
- `npm test`
- `npm run test:e2e`
- `npm run build`
- `npm run test:rust`
- Tauri dev 或预览真实窗口验收
- 真实 API 接入验收（Tauri 已由用户人工通过）
- CSV 保存对话框验收（Tauri 已由用户人工通过）
- 安装包或 release exe 核心流程人工验收
