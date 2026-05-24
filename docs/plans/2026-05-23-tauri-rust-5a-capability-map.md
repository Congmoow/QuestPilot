# Tauri + Rust 5A 能力映射预研报告

## 目标

阶段 5A 只做迁移预研，不引入 Tauri 依赖，不替换 Electron，不修改运行时代码。目标是确认 QuestPilot 当前 Electron 能力面是否能映射到 Tauri + Rust，并为阶段 5B 最小 PoC 给出明确边界。

## 当前基线

- 当前桌面壳：Electron 33 + React 18 + Vite 5。
- 当前本地数据库：`sql.js` + `sql-wasm.wasm`，数据库文件名为 `questpilot.db`。
- 当前打包工具：`electron-builder`。
- 当前 `release/win-unpacked` 体积：约 271.71 MB。
- 当前前端入口：`src/api/index.js` 统一包装 `window.electronAPI`。
- 当前 Electron IPC 数量：56 个。
- 当前 preload API 分组：12 组。

## 现有能力分组

| 分组 | IPC 数量 | 当前职责 | Tauri 映射方式 | 迁移难度 |
| --- | ---: | --- | --- | --- |
| `window` | 4 | 最小化、最大化、关闭、最大化状态 | Tauri window API / Rust command | 低 |
| `settings` | 7 | 主题、AI 配置、错题阈值 | Rust command + SQLite/settings 表 | 中 |
| `questionBank` | 5 | 题库 CRUD | Rust command + SQLite | 中 |
| `question` | 8 | 题目 CRUD、批量创建、随机抽题、搜索 | Rust command + SQLite + 事务 | 中高 |
| `csv` | 5 | 模板下载、文件选择、解析、导入、导出 | Tauri dialog plugin + Rust fs/csv crate | 中高 |
| `stats` | 3 | 仪表盘统计、日志、题型分布 | Rust command + SQLite 聚合查询 | 中 |
| `draft` | 3 | 草稿保存、读取、清除 | Rust command + SQLite | 低中 |
| `ai` | 2 | AI 解析、AI 聊天 | Rust command 或保留前端 fetch 适配 | 高 |
| `chatHistory` | 5 | 聊天记录 CRUD | Rust command + SQLite/JSON | 中 |
| `prompt` | 5 | Prompt CRUD | Rust command + SQLite | 中 |
| `practice` | 3 | 练习记录保存与统计 | Rust command + SQLite | 中 |
| `wrongBook` | 6 | 错题统计、列表、随机练习、同步、清理 | Rust command + SQLite + 事务 | 中高 |

## 推荐技术映射

### 桌面壳

- Electron `BrowserWindow` 对应 Tauri 主窗口配置。
- 当前无边框窗口和自定义标题栏可以保留前端 UI，由 Tauri 窗口 API 实现最小化、最大化、关闭。
- `src/components/TitleBar.jsx` 应继续只依赖业务 API 适配层，不应直接到处调用 Tauri API。

### 前端 API 适配

阶段 5B 不建议把页面改成直接调用 `@tauri-apps/api`。建议新增一个运行时适配层：

- Electron 环境：继续使用 `window.electronAPI`。
- Tauri 环境：使用 `invoke(...)` 调用 Rust command。
- 页面代码：继续通过 `src/api/index.js` 使用业务 API。

这样可以让 Electron 和 Tauri 在预研期并行存在，避免一次性切断稳定发布链路。

### 数据库

正式迁移时建议用 Rust `rusqlite` 替换 `sql.js`：

- 题库、题目、错题本、练习记录、Prompt、聊天历史都适合迁入 Rust SQLite 层。
- 批量导入应使用事务。
- 随机抽题、错题同步、统计聚合应放在 Rust 后端，减少前端数据搬运。
- 需要保留当前 `questpilot.db` 文件名和旧数据库迁移逻辑。

### 文件与 CSV

- 文件选择和保存建议用 Tauri dialog plugin。
- CSV 解析短期可以继续由前端/PapaParse 完成，也可以在 Rust PoC 中使用 `csv` crate 验证替代可行性。
- CSV 导入最终应走 Rust 批量写库，避免前端逐条调用。

### AI 能力

AI 模块迁移成本最高，不建议放进 5B 最小 PoC：

- 当前 AI 解析已有 Markdown 分块、JSON 归一化、错误合并等逻辑。
- 可先保留 Electron 稳定线，Tauri PoC 只验证 settings + command + 网络请求能力。
- 正式迁移时再决定 AI 请求由 Rust 发起，还是前端发起、Rust 只负责存储。

## 5B PoC 最小范围

阶段 5B 应只验证最小闭环：

1. 新增 `src-tauri/`，让 Tauri 能加载现有 Vite 前端。
2. 实现窗口控制命令：`window:minimize`、`window:maximize`、`window:close`、`window:isMaximized`。
3. 实现 3 个数据库命令：
   - `questionBank:getAll`
   - `question:createBatch`
   - `question:getRandom`
4. 实现 2 个 CSV/文件命令：
   - `csv:selectFile`
   - `csv:parseFile`
5. 在 `src/api/index.js` 增加运行时分支，保持页面调用方式不变。
6. 记录 Tauri dev、build、bundle 结果和体积。

## 5B 不做事项

- 不删除 Electron。
- 不替换 `electron/` 目录。
- 不迁移全部 56 个 IPC。
- 不迁移 AI 聊天和 AI 解析。
- 不重构前端页面。
- 不把 Electron 构建脚本改坏。
- 不做跨平台发布承诺，只先验证 Windows。

## 风险清单

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| Tauri API 与 Electron preload 模型不同 | 前端调用层需要适配 | 保持 `src/api/index.js` 作为统一门面 |
| Rust SQLite 与当前 `sql.js` 行为差异 | 数据读写可能不兼容 | 先复用当前表结构，PoC 只读写测试库 |
| 文件路径和用户数据目录差异 | 数据迁移风险 | 单独验证 app data 路径和旧库迁移 |
| AI 模块迁移复杂 | PoC 容易膨胀 | 5B 暂不迁移 AI |
| 打包配置变化大 | 发布链路不稳定 | Electron 构建保持原样，Tauri 走独立脚本 |
| Windows WebView2 依赖 | 用户环境可能缺运行时 | 在决策报告中记录依赖和安装体验 |

## 验收标准

阶段 5A 完成标准：

- 已列出当前 Electron IPC 分组和迁移难度。
- 已明确 5B PoC 做什么、不做什么。
- 已给出 Tauri + Rust 技术映射。
- 已保留 Electron 稳定发布线。
- 已形成可提交的预研报告。

阶段 5B 进入标准：

- 当前工作树干净。
- 新建独立分支，例如 `codex/tauri-rust-poc`。
- 先确认本机 Rust、Cargo、Tauri CLI 环境。
- 先跑通当前 Electron `npm run build` 或 `npm run electron:pack` 作为迁移前基线。

## 决策出口

5B 完成后再决定是否进入正式迁移。建议使用以下条件：

- Tauri Windows 包体显著低于 Electron 当前 271.71 MB。
- 现有 React/Vite 前端无需大面积重写。
- Rust SQLite 能稳定完成批量写入和随机抽题。
- 文件选择、CSV 读取、用户数据目录、窗口控制均可用。
- Electron 分支仍可正常构建和发布。

如果以上条件不能同时满足，应继续优化 Electron，而不是强行迁移。
