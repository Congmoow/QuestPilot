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

## 阶段 3：数据库迁移基础（已完成第一块）

### 已启动

- 新增数据库迁移机制文档：`docs/architecture/database-migrations.md`。
- Electron 初始化数据库时创建 `schema_migrations` 并写入 `001_initial_schema`。
- Tauri 初始化数据库时创建同名元数据表并写入同一版本。
- 新增 Electron 迁移幂等测试：`scripts/__tests__/electron-database-migrations.test.mjs`。
- 扩展 Tauri 数据库测试，验证迁移版本只记录一次。
- 新增脚本：`npm run test:db-migrations`。

## 剩余工作计划

后续执行本计划时应按小步提交推进。每个阶段完成后至少执行对应验证命令，并把结果补回本文件。

### 阶段 2：Electron 数据层与 IPC 边界加固

**目标：** 阻断 renderer 参数直接进入拼接 SQL 或未校验 IPC handler，先保护当前稳定运行时。

**当前状态：** 已完成并等待提交推送后进入阶段 3。

**涉及文件：**

- 修改：`electron/database/index.cjs`
- 修改：`electron/main.cjs`
- 视情况修改：`electron/preload.cjs`
- 新增或修改测试：`scripts/__tests__/electron-database-*.test.mjs`
- 更新文档：`docs/architecture/desktop-api-contract.md`

**任务：**

1. 盘点风险 SQL 与 IPC 参数入口。
   - 命令：`rg -n "db\\.(exec|run)\\(\\`|WHERE .*\\$\\{|LIMIT .*\\$\\{|ORDER BY .*\\$\\{|ipcMain\\.handle" electron`
   - 产出：把需要修复的函数分为 P0/P1 两组，先处理题库、题目、搜索、删除、分页相关路径。
2. 为高风险路径补失败测试。
   - 覆盖：非法 `id`、非法 `bankId`、搜索关键字含引号、分页参数越界、批量删除混入非数字。
   - 期望：修复前测试能失败，失败原因指向 SQL 拼接或参数未校验。
3. 将查询和写入改为 prepared statement。
   - 规则：值参数使用 `prepare().run()` 或参数数组；分页、排序字段必须白名单化，不能直接拼接 renderer 输入。
   - 保留现有返回结构，不借机重构业务行为。
4. 为 IPC handler 增加统一入参校验。
   - 规则：数字 ID 统一转为正整数；字符串字段 trim 后校验长度；数组参数逐项校验。
   - 错误信息面向用户时使用中文。
5. 更新契约文档。
   - 在 `docs/architecture/desktop-api-contract.md` 增加 IPC 入参边界说明。

**验证：**

- `npm run test:api-contract`
- 新增的 Electron 数据层测试命令
- `npm run build`
- Electron 8 秒启动 smoke

**完成标准：**

- 题库、题目、搜索、删除、分页路径不再由 renderer 输入直接拼接 SQL。
- IPC 参数非法时返回稳定中文错误，不触发底层 SQL 异常。
- 工作树中没有未解释的测试跳过或死代码。

**已完成记录：**

- 新增 `electron/database/queryGuards.cjs`，统一处理正整数 ID、分页、题型、搜索关键字和批量 ID。
- 新增 `scripts/__tests__/electron-query-guards.test.mjs`。
- 新增 `scripts/__tests__/electron-sql-safety.test.mjs`。
- 新增脚本：`npm run test:electron-db-safety`。
- Electron 题库、题目、搜索、删除、分页相关核心路径已切到归一化参数或 prepared statement。
- `docs/architecture/desktop-api-contract.md` 已补充 IPC 与数据层边界。

### 阶段 3 后续：数据库迁移机制完善

**目标：** 把当前 `schema_migrations` 基线扩展为可持续维护的迁移执行器。

**涉及文件：**

- 修改：`electron/database/migrations.cjs`
- 修改：`electron/database/index.cjs`
- 修改：`src-tauri/src/database.rs`
- 修改：`src-tauri/tests/database_store.rs`
- 新增或修改测试：`scripts/__tests__/electron-database-migrations.test.mjs`
- 更新文档：`docs/architecture/database-migrations.md`

**任务：**

1. 将 Electron 迁移改为显式迁移列表。
   - 迁移项包含 `version`、`name`、`up(database)`。
   - 初始化时只执行未记录的迁移，成功后再写入 `schema_migrations`。
2. 将 Tauri 迁移改为同等语义的迁移执行函数。
   - 当前表初始化保留为基线，但后续结构变更必须进入迁移函数。
   - 版本记录必须在迁移成功后写入。
3. 增加旧库升级测试。
   - Electron：构造没有 `schema_migrations` 的内存库，执行迁移后应补齐版本记录。
   - Tauri：构造旧文件库，重复打开后版本记录仍只保留一条。
4. 明确未来迁移模板。
   - 在 `docs/architecture/database-migrations.md` 增加“新增迁移步骤”和“回滚策略说明”。

**验证：**

- `npm run test:db-migrations`
- `cargo test --test database_store database_store_records_current_schema_migration_once`
- `cargo test`
- Electron 8 秒启动 smoke

**完成标准：**

- Electron 与 Tauri 使用同一版本号、同一迁移名称。
- 重复启动不会重复写入迁移记录。
- 新增结构变更有明确测试和文档入口。

### 阶段 4：AI Key 与配置安全收口

**目标：** 在不发布新版本前，先明确 API Key 的短期保护和中期迁移路径，避免继续扩大明文配置面。

**涉及文件：**

- 修改：`electron/database/index.cjs`
- 修改：`electron/main.cjs`
- 修改：`src-tauri/src/database.rs`
- 修改：`src-tauri/src/lib.rs`
- 修改：`src/pages/Settings.jsx`
- 更新文档：`docs/architecture/desktop-api-contract.md`

**任务：**

1. 盘点 API Key 读写路径。
   - 命令：`rg -n "apiKey|api_key|setApiConfig|getApiConfig|testApiConnection" src electron src-tauri`
   - 产出：记录 Electron、Tauri、前端各自的配置流向。
2. 短期加固。
   - UI 展示必须脱敏。
   - 日志、错误、测试输出不得包含完整 Key。
   - 导出或调试信息不得包含完整 Key。
3. 中期方案设计。
   - 评估是否引入系统凭据存储。
   - 未完成迁移前，文档中明确“当前仍是本地库配置，不能视为安全凭据仓库”。
4. 补充测试。
   - 配置保存后读取仍能正常用于连接测试。
   - 错误路径不泄露完整 Key。

**验证：**

- `rg -n "sk-|apiKey|api_key" dist electron src src-tauri`
- `npm run build`
- `cargo test`
- Electron 真实设置页 smoke，必须在 Electron shell 中验证。

**完成标准：**

- 前端、Electron、Tauri 对 API Key 的展示和错误路径都有脱敏边界。
- 文档清楚标注当前保护级别和下一步迁移路径。

### 阶段 5：双运行时真实验收与取舍

**目标：** 明确 Electron 稳定线和 Tauri 迁移线的真实状态，避免两个运行时长期无边界并行。

**涉及文件：**

- 修改：`docs/architecture/desktop-api-contract.md`
- 修改：`docs/plans/2026-05-24-architecture-stabilization.md`
- 视结果修改：`src/api/index.js`
- 视结果修改：`src-tauri/src/lib.rs`
- 视结果修改：`electron/main.cjs`

**任务：**

1. 建立手工验收清单。
   - 覆盖：题库 CRUD、题目 CRUD、CSV 导入导出、随机练习、错题本、AI 解析、AI 聊天、设置保存。
2. 分别跑 Electron 与 Tauri。
   - Electron 必须使用 `npm run electron:dev` 或 `npm run electron:preview`。
   - Tauri 使用 `npm run tauri:dev`。
3. 标记差异。
   - 差异必须归类为：契约差异、权限差异、窗口/文件系统差异、未实现功能。
4. 做取舍决策。
   - 如果 Tauri 继续作为迁移线，列出替换 Electron 前的阻塞项。
   - 如果短期冻结 Tauri，明确哪些 Tauri 改动只做编译和测试保活。

**验证：**

- `npm run test:api-contract`
- `npm run build`
- `cargo test`
- Electron 手工验收记录
- Tauri 手工验收记录

**完成标准：**

- 运行时定位不再只停留在口头说明。
- 每个核心流程都有 Electron/Tauri 状态标记。
- 发布前阻塞项清楚可查。

### 阶段 6：模块拆分与维护边界

**目标：** 在安全和迁移边界稳定后，再拆分超大文件，降低后续维护成本。

**涉及文件：**

- 拆分候选：`electron/database/index.cjs`
- 拆分候选：`src-tauri/src/database.rs`
- 更新测试：`scripts/__tests__/*.test.mjs`
- 更新测试：`src-tauri/tests/*.rs`

**任务：**

1. 先做依赖图盘点，不直接搬代码。
   - 命令：`rg -n "function |module\\.exports|pub fn|fn " electron/database/index.cjs src-tauri/src/database.rs`
2. 按领域拆分。
   - Electron 候选：题库、题目、设置、练习、错题本、AI Prompt、聊天历史。
   - Tauri 候选：类型定义、校验、仓储方法、迁移、查询辅助函数。
3. 每次只拆一个领域。
   - 拆分前后必须保持公开 API 不变。
   - 每次拆分都单独提交。
4. 删除死代码和重复初始化。
   - 删除前必须有测试覆盖或明确无引用证据。

**验证：**

- `npm run test:api-contract`
- `npm run test:db-migrations`
- `npm run build`
- `cargo test`
- Electron 8 秒启动 smoke

**完成标准：**

- 大文件拆分后公开 API 不变。
- 每个领域有清晰文件归属。
- 没有为了拆分而改变业务行为。

### 阶段 7：发布前架构闸门

**目标：** 在恢复发布前建立最低闸门，避免架构治理未完成时误发新版。

**涉及文件：**

- 更新：`docs/plans/2026-05-24-architecture-stabilization.md`
- 视情况新增：`docs/architecture/release-gate.md`
- 视情况修改：`README.md`

**任务：**

1. 汇总阶段 2-6 的验证结果。
2. 明确发布阻塞项。
   - P0：数据损坏、Key 泄露、核心流程不可用。
   - P1：运行时契约漂移、迁移缺测试、手工验收缺失。
3. 建立发布前命令清单。
   - `npm run test:api-contract`
   - `npm run test:db-migrations`
   - `npm run build`
   - `cargo test`
   - Electron smoke
   - 必要时再执行打包命令。
4. 记录人工验收结论。
   - 未完成的人工验收不得写成已验证。

**完成标准：**

- 发布前必须完成的自动化和手工验证都写入文档。
- 阻塞项未清零前，不更新发布版本。
