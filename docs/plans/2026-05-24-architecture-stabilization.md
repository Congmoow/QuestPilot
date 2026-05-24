# 架构治理阶段 0-1 记录

## 背景

项目暂时不发布新版，优先处理架构问题。当前策略是先稳定 Electron/Tauri 双运行时契约，再继续做数据层、安全和模块拆分。

## 阶段 0：基线冻结

### 当前分支

- 架构治理分支：`codex/architecture-stabilization`
- 主线定位：Electron 是稳定运行时，Tauri 是迁移验证线。

### 已执行基线验证

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run build` | 通过 | Vite 生产构建成功。 |
| `cargo test` | 通过 | Rust 侧 5 个 AI 测试、3 个 CSV 测试、11 个数据库测试通过。 |
| Electron 8 秒启动 smoke | 通过启动观察 | 使用 `node_modules/.bin/electron.cmd .` 启动，8 秒后仍在运行；主动结束进程。Windows 网络状态查询出现 `WSALookupServiceBegin failed with: 10108` 告警，但未导致启动退出。 |

### 未完成的人工验收

- 未用真实 AI Key 做联网 AI 验收。
- 未人工点击完整 Electron UI 流程。
- 未人工点击完整 Tauri UI 流程。
- 未执行发布打包，本轮按“不发布”处理。

## 阶段 1：API 契约统一

### 已完成

- 新增桌面 API 契约文档：`docs/architecture/desktop-api-contract.md`。
- 新增前端运行时返回值适配器：`src/api/runtimeAdapters.js`。
- 修正 CSV 相关返回值漂移：
  - Tauri 文件选择 `string | null` 归一化为 `{ success, canceled, filePath }`。
  - Tauri 保存对话框 `cancelled` 归一化为 `canceled`。
  - Electron 缺省 `canceled` 字段时在前端出口补齐。
- 新增契约测试：`scripts/__tests__/runtime-adapters.test.mjs`。
- 新增脚本：`npm run test:api-contract`。

### 已验证

| 命令 | 结果 |
| --- | --- |
| `node --test scripts/__tests__/runtime-adapters.test.mjs` | 初次失败，原因是适配器未实现。 |
| `npm run test:api-contract` | 通过，5 个契约测试通过。 |

## 下一阶段建议

阶段 2 应先处理 Electron 数据层与 IPC 边界：

- 把 `electron/database/index.cjs` 中由 renderer 参数参与的拼接 SQL 改为 prepared statement。
- 为 IPC handler 增加统一入参校验。
- 明确 AI Key 的短期保护策略和中期系统凭据迁移路径。
