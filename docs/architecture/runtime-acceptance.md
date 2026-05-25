# 双运行时验收记录

记录日期：2026-05-24<br>
分支：`codex/architecture-stabilization`

## 结论

- Electron 继续作为当前稳定运行时。
- 阶段 5.5 的 Tauri 主线化准入结论是 `Tauri-continue-validation`：Tauri 继续作为迁移验证线，暂不替换 Electron，也不进入发布默认运行时。
- 2026-05-25 起，剩余阶段以 Tauri 作为开发主线推进，Electron 暂停修改并仅保留为回退参考；该决策不代表 Tauri 已满足发布默认运行时准入。
- 阶段 7 已新增发布前架构闸门：`docs/architecture/release-gate.md`。阶段 7.1 已补齐 Tauri 数据冲突显式处置和打包产物构建启动证据；真实 AI 与 CSV 保存对话框 P0 清零前，不更新发布版本，也不建议把 Tauri 设为默认发布运行时。
- 阶段 5 的目标是把真实状态、差异类别和发布前阻塞项固化到文档中；未完成的人工验收不会写成已验证。
- 阶段 5.5 的详细记录见 `docs/architecture/tauri-mainline-readiness.md`。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| 已验证 | 已有自动化测试或运行时 smoke 证据覆盖。 |
| 待人工验收 | 需要真实窗口点击、文件对话框或真实 AI Key 才能确认。 |
| 发布阻塞 | 在恢复发布或切换默认运行时前必须解决。 |
| 不适用 | 当前运行时或当前阶段不要求覆盖。 |

## 本轮证据

| 范围 | 证据 | 结果 |
| --- | --- | --- |
| Electron 契约 | `npm run test:api-contract` | 通过，5 个契约测试通过。 |
| Electron 构建 | `npm run build` | 通过，Vite 生产构建成功。 |
| Electron 运行时 smoke | Electron CDP smoke | 通过：公开配置不返回完整 Key，设置保存、题库 CRUD、题目 CRUD、随机练习数据、CSV 导入、练习记录、错题本、Prompt、聊天历史和 8 个页面路由均通过。 |
| Electron AI | Electron CDP smoke | 未执行真实 AI 网络请求；本机已有 Key 时记录为 `skipped-existing-key`。 |
| Tauri 环境 | `npm run tauri:info` | 通过，Windows WebView2、Rust、Node、Tauri CLI 均可用。 |
| Tauri Rust | `cargo test` | 通过，Rust 全量测试通过。 |
| Tauri 启动 | `npm run tauri:dev` | 通过，Vite 与 `questpilot-tauri.exe` 正常启动；WebView2 CDP 可见 `QuestPilot` 页面目标。 |
| Tauri 路由 | WebView2 CDP route smoke | 通过：`#/dashboard`、`#/manual-entry`、`#/csv-import`、`#/practice`、`#/wrong-book`、`#/ai-import`、`#/ai-chat`、`#/settings` 均能加载根节点内容。 |
| Tauri API | WebView2 CDP API smoke | 通过：Tauri runtime 识别、无 Electron API、公开配置不返回完整 Key、设置保存、题库 CRUD、题目 CRUD、CSV 导入、练习记录、错题本、Prompt、聊天历史均通过，并清理临时数据。 |
| Tauri 主线化准入 | 阶段 5.5 smoke、阶段 7.1 数据冲突处置与打包产物验证 | 未进入 `Tauri-first`；Tauri 本地 API、路由、最大化切换、已有 Tauri 空库迁移、目标库已有用户数据时的显式备份替换、`npm run tauri:build` 和 release exe 启动 smoke 通过；真实 AI 与 CSV 保存对话框仍是 P0 阻塞项。 |

说明：Tauri smoke 结束时通过 `Ctrl+C` 正常中断 dev 进程，控制台返回 `STATUS_CONTROL_C_EXIT` 属于本次受控退出的预期结果。Electron smoke 中仍可见既有 Windows 网络状态告警 `WSALookupServiceBegin failed with: 10108`，未导致运行时退出。

## 核心流程验收矩阵

| 核心流程 | Electron 状态 | Tauri 状态 | 差异类别 | 说明 |
| --- | --- | --- | --- | --- |
| 题库 CRUD | 已验证 | 已验证 | 无阻塞契约差异 | 两端 smoke 均覆盖创建、更新、读取和删除临时题库。 |
| 题目 CRUD | 已验证 | 已验证 | 无阻塞契约差异 | 两端 smoke 均覆盖创建、更新、读取、列表和搜索。 |
| 随机练习数据 | 已验证 | 已验证 | 无阻塞契约差异 | Electron 覆盖随机题获取；Tauri 覆盖随机题获取和练习记录保存读取。 |
| CSV 导入 | 已验证 | 已验证 | 无阻塞契约差异 | 两端均导入 1 道临时单选题，结果为成功 1、失败 0。 |
| CSV 模板下载 | 待人工验收 | 待人工验收 | 权限差异、文件系统差异 | 需要真实保存对话框，未在自动 smoke 中触发。Tauri 已补齐 `dialog:allow-save`，发布前仍需人工验证保存路径和取消路径。 |
| CSV 导出 | 待人工验收 | 待人工验收 | 权限差异、文件系统差异 | 需要真实保存对话框，未在自动 smoke 中触发。Tauri 已补齐 `dialog:allow-save`，发布前仍需人工验证保存路径、导出数量和文件内容。 |
| 错题本 | 已验证 | 已验证 | 无阻塞契约差异 | 两端均覆盖从练习结果写入错题本并读取。 |
| Prompt | 已验证 | 已验证 | 无阻塞契约差异 | 两端均覆盖 Prompt 列表或临时 Prompt 创建读取。 |
| 聊天历史 | 已验证 | 已验证 | 无阻塞契约差异 | 两端均覆盖聊天历史保存读取删除。 |
| 设置保存 | 已验证 | 已验证 | 无阻塞契约差异 | 两端均验证公开配置不返回完整 Key；Tauri 额外验证主题设置保存读取。 |
| AI 解析 | 待人工验收 | 待人工验收 | 外部服务差异 | 未使用真实 AI Key 执行联网解析。恢复发布前必须用真实 Key 覆盖成功、失败和错误脱敏路径。 |
| AI 聊天 | 待人工验收 | 待人工验收 | 外部服务差异 | 未使用真实 AI Key 执行联网聊天。当前仅验证聊天历史本地存储。 |
| 页面路由 | 已验证 | 已验证 | 窗口差异 | Electron 和 Tauri 均覆盖 8 个核心 hash 路由加载。Tauri 仍需真实窗口尺寸、拖拽和系统窗口按钮人工验收。 |

## 差异归类

### 契约差异

- 本轮覆盖到的题库、题目、CSV 导入、练习记录、错题本、Prompt、聊天历史和设置读取保存没有发现阻塞级契约漂移。
- CSV 模板下载和 CSV 导出仍缺真实保存对话框验收，不能写成已验证。

### 权限差异

- Tauri capability 当前显式列出 `dialog:allow-open` 和 `dialog:allow-save`；CSV 保存流程目前由 Rust command 内部调用保存对话框，自动 smoke 未触发保存对话框。
- 发布前必须在 Tauri 窗口中人工验证模板下载、题库导出、取消保存和实际写入路径。
- 如果后续改为前端直接调用 Tauri dialog 插件，必须补充 `dialog:allow-save` 或 `dialog:default` 并重新验收。

### 窗口和文件系统差异

- Electron 和 Tauri 使用不同运行时、窗口壳和应用数据目录。阶段 5 只验证临时数据在各自运行时内可用；阶段 5.5 已补齐目标 Tauri 库缺失或为空时的 Electron 候选库迁移，并保护已有用户数据的 Tauri 目标库不被静默覆盖。阶段 7.1 已补充 Tauri 设置页的显式备份替换流程。
- Tauri 的透明无边框窗口、拖拽区域、最小化、最大化和关闭按钮需要真实窗口人工点击验收。

### 未实现或未完成验收

- 真实 AI 解析与 AI 聊天未联网验收。
- Tauri 已执行 `npm run tauri:build` 并完成 release exe 8 秒启动 smoke；安装包安装后核心流程仍需人工验收。
- Tauri 不能作为发布默认运行时，除非替换阻塞项全部清零。

## 运行时取舍

短期取舍：

- Tauri 作为后续架构治理和模块拆分的开发主线，继续通过 `cargo test`、`npm run tauri:info`、`npm run tauri:dev` 和必要的 CDP smoke 保活。
- Electron 暂停主动修改，仅作为回退参考；恢复发布前是否补 Electron smoke 由发布闸门单独判断。

Tauri 替换 Electron 前的阻塞项：

1. 完成 Tauri 真实窗口人工验收：CSV 模板下载、CSV 导出、文件选择、窗口控制、取消路径和异常路径。
2. 完成真实 AI Key 下的解析与聊天验收，并确认错误和日志不泄露完整 Key。
3. 人工点击目标 Tauri 库已有用户数据时的显式备份替换流程，并确认备份、替换和重启后数据状态。
4. 对安装包或 release exe 完成核心本地流程人工验收。
5. 更新发布闸门，明确未通过上述阻塞项前不得把 Tauri 设为默认发布运行时。

## 发布前验收清单

完整闸门见 `docs/architecture/release-gate.md`。本节仅保留运行时验收入口。

- `npm run test:api-contract`
- `npm run test:api-config-security`
- `npm run test:electron-db-safety`
- `npm run test:db-migrations`
- `npm run build`
- `cargo test`
- Electron shell 真实窗口验收
- Tauri dev 或预览真实窗口验收
- 真实 AI Key 验收
- CSV 保存对话框验收
- 安装包或 release exe 核心流程人工验收
