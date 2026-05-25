# 发布前架构闸门

记录日期：2026-05-25<br>
分支：`codex/architecture-stabilization`

## 结论

Tauri 已作为后续开发主线推进，并已完成阶段 2-6 的架构治理、测试补强、数据迁移保护和模块拆分。

当前结论是：**允许继续 Tauri 主线开发；真实 AI 与 CSV 保存 P0 已由用户人工验收通过，Tauri 可以进入默认发布运行时的发布收口。**

恢复发布或切换默认运行时前，必须先清零本文档中的发布阻塞项。未完成的真实窗口、安装包核心流程或数据迁移点击验收不得写成已验证。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| 已验证 | 已有本轮或阶段记录中的自动化测试、构建或运行时 smoke 证据。 |
| 待验收 | 需要真实窗口、真实文件对话框、真实 API Key 或打包产物才能确认。 |
| 发布阻塞 | 恢复发布或切换默认运行时前必须完成。 |
| 暂缓 | 当前不主动处理，除非用户明确要求或出现 P0/P1 问题。 |

## 阶段 2-6 结果汇总

| 阶段 | 结果 | 证据 |
| --- | --- | --- |
| 阶段 2：Electron 数据库安全边界 | 已验证 | `npm run test:electron-db-safety` 曾覆盖 Electron 查询参数守卫和 SQL 安全测试。 |
| 阶段 3：数据库迁移基线 | 已验证 | `npm run test:db-migrations`、`cargo test` 覆盖 Electron/Tauri 迁移版本语义和 Tauri 旧库升级。 |
| 阶段 4：API Key 展示边界 | 已验证 | `npm run test:api-config-security` 覆盖 Electron/Tauri API Key 脱敏契约。 |
| 阶段 5：双运行时验收记录 | 已验证到开发准入 | `docs/architecture/runtime-acceptance.md` 固化双运行时差异、已测流程和未测流程。 |
| 阶段 5.5：Tauri 主线化准入 | 已验证到继续推进 | `docs/architecture/tauri-mainline-readiness.md` 曾记录 `Tauri-continue-validation`；阶段 7.2 已补记用户人工验收并清零发布 P0。 |
| 阶段 6：模块拆分与维护边界 | 已验证 | `src-tauri/src/database/*.rs` 已按类型、校验、迁移、schema、旧库迁移和查询辅助拆分；`cargo test` 与 `npm run build` 通过。 |

## 发布阻塞项

### P0 阻塞

截至 2026-05-25，当前 P0 已清零。

| 原阻塞项 | 当前状态 | 解除证据 |
| --- | --- | --- |
| 真实 AI 解析和聊天未验收 | 用户人工验收通过 | 用户在 Tauri 真实窗口中完成 API 接入测试，反馈“人工测下来没有问题”。 |
| CSV 保存对话框未验收 | 用户人工验收通过 | 用户在 Tauri 真实窗口中完成 CSV 保存测试，反馈“人工测下来没有问题”。 |

### P1 阻塞

| 阻塞项 | 当前状态 | 解除条件 |
| --- | --- | --- |
| Tauri 窗口控制缺少完整人工验收 | 待验收 | 覆盖拖拽、最小化、最大化、关闭、窗口尺寸和异常退出路径。 |
| 文件选择真实点击缺少人工验收 | 待验收 | 覆盖文件选择成功、取消和非法文件路径。 |
| 目标 Tauri 库已有用户数据时的重置流程缺少人工点击验收 | 待验收 | 在设置页触发“备份并使用旧库替换”，确认备份文件、替换结果和重启后数据状态。 |
| 打包产物核心流程未人工验收 | 待验收 | 安装包或 release exe 启动后，人工覆盖题库、题目、设置、CSV 导入和错题本核心流程。 |
| Electron 回退线未做最终 smoke | 暂缓 | 恢复发布前补一次 Electron smoke；平时 Electron 暂停主动修改。 |
| 发布命令缺少一次完整人工记录 | 待验收 | 发布前在本文档或发布记录中写入执行日期、命令、结果和人工验收人。 |

## 发布前命令清单

恢复发布或切换默认运行时前，至少执行：

| 命令 | 目的 | 当前阶段 7 状态 |
| --- | --- | --- |
| `npm run test:api-contract` | 验证前端桌面 API 归一化契约。 | 已作为阶段 6/7 自动化验证项。 |
| `npm run test:api-config-security` | 验证 API Key 不被完整暴露到页面契约。 | 阶段 4 已覆盖，发布前仍必须重跑。 |
| `npm run test:electron-db-safety` | 验证 Electron 回退线数据库参数守卫。 | 阶段 2 已覆盖，发布前恢复 Electron smoke 时重跑。 |
| `npm run test:db-migrations` | 验证迁移版本语义。 | 已作为阶段 6/7 自动化验证项。 |
| `cargo fmt -- --check` | 验证 Tauri Rust 格式。 | 已作为阶段 6/7 自动化验证项。 |
| `cargo test` | 验证 Tauri Rust 单元和集成测试。 | 已作为阶段 6/7 自动化验证项。 |
| `npm run build` | 验证前端生产构建。 | 已作为阶段 6/7 自动化验证项。 |
| `npm run tauri:info` | 记录 Tauri 环境。 | 发布前建议重跑；若命令不退出，记录为环境输出而非完整通过。 |
| `npm run tauri:dev` 或预览级 smoke | 验证 Tauri 真实窗口核心流程。 | 待人工/运行时验收。 |
| `npm run tauri:build` | 验证 Tauri 打包产物。 | 2026-05-25 通过，生成 `QuestPilot_1.6.7_x64-setup.exe` 和 release exe。 |
| GitHub Actions `Build and Release` | 验证 tag 或手动发布使用 Tauri 打包链路。 | 已切换为 `npm run tauri:build`，上传 `src-tauri/target/release/bundle/nsis/*.exe`。 |

## 阶段 7.1 P0 收口记录

记录日期：2026-05-25

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 目标 Tauri 库已有用户数据时缺少显式处置流程 | 已验证到代码和契约层 | 新增 `migration_get_legacy_status` 和 `migration_backup_and_replace_from_legacy` Tauri 命令；设置页仅在 Tauri 中显示数据迁移卡片；替换前要求确认，替换时先移动当前库为备份，再用旧库替换；`cargo test` 覆盖状态、备份替换、错误确认短语和非候选路径拒绝。 |
| Tauri 保存对话框权限 | 已补齐配置 | `src-tauri/capabilities/main.json` 增加 `dialog:allow-save`；仍需真实窗口点击保存对话框。 |
| 打包产物 | 已验证到构建和启动层 | `npm run tauri:build` 通过，产物为 `src-tauri/target/release/questpilot-tauri.exe` 和 `src-tauri/target/release/bundle/nsis/QuestPilot_1.6.7_x64-setup.exe`；release exe 启动 8 秒后仍存活，随后主动结束进程。 |
| GitHub Release 工作流 | 已切到 Tauri 主线 | `.github/workflows/release.yml` 使用 Rust stable 与 `npm run tauri:build` 构建，并只上传 Tauri NSIS 安装包。 |
| 真实 AI | 已由用户人工验收通过 | 用户在 Tauri 真实窗口中测试 API 接入，反馈人工测试没有问题。 |
| CSV 保存对话框 | 已由用户人工验收通过 | 用户在 Tauri 真实窗口中测试 CSV 保存，反馈人工测试没有问题。 |

## 阶段 7.2 人工验收记录

记录日期：2026-05-25

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 真实 API 接入 | 用户人工验收通过 | 用户反馈 Tauri 线 API 接入人工测试没有问题。 |
| CSV 保存 | 用户人工验收通过 | 用户反馈 Tauri 线 CSV 保存人工测试没有问题。 |

## 人工验收清单

发布前必须在真实 Tauri 窗口中记录以下结果：

- CSV 文件选择：成功选择、取消、非法路径。
- CSV 模板下载：取消保存、实际写入、写入后文件内容可打开。
- CSV 题库导出：取消保存、实际写入、导出数量和文件内容正确。
- AI 连接测试：真实 Key 成功、错误 Key 失败、错误信息不泄露完整 Key。
- AI 解析：真实请求成功生成题目；服务异常或格式异常时页面可恢复。
- AI 聊天：真实请求成功、失败提示稳定、聊天历史保存读取正常。
- 窗口控制：拖拽、最小化、最大化、关闭、重新打开。
- 数据迁移：目标库缺失、目标库为空、目标库已有用户数据三种路径均按预期处理。
- 打包产物：安装包或可执行产物启动后完成题库、题目、设置、CSV 导入和错题本核心流程。

## 当前可发布判断

| 判断项 | 结论 |
| --- | --- |
| 是否允许继续 Tauri 主线开发 | 是。 |
| 是否允许删除 Electron 回退线 | 否。 |
| 是否允许把 Tauri 设为默认发布运行时 | 可以进入发布收口；真实 AI 与 CSV 保存 P0 已由用户人工验收通过。 |
| 是否允许更新发布版本或打正式包 | 可以进入正式发布收口；发布前仍建议补记安装包或 release exe 核心流程人工验收。 |

## 维护规则

- 新增发布阻塞项时，必须写明解除条件。
- 完成一项人工验收时，必须记录日期、运行时、命令或操作路径、结果和遗留风险。
- 任何文档不得把未执行的安装包核心流程、窗口点击或数据迁移点击写成已验证。
- Electron 继续作为回退参考；除用户明确要求或 P0/P1 问题外，不主动修改 Electron 代码。
