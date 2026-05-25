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

**阶段推进规则：** 阶段 2 起，每个阶段必须完成验证、提交并推送成功后，才允许进入下一阶段。当前阶段 5 已完成并已提交推送；阶段 5.5 已完成准入评估；2026-05-25 起剩余阶段以 Tauri 为开发主线继续推进，Electron 暂停主动修改。

### 阶段 2：Electron 数据层与 IPC 边界加固

**目标：** 阻断 renderer 参数直接进入拼接 SQL 或未校验 IPC handler，先保护当前稳定运行时。

**当前状态：** 已完成并已提交推送。

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
- 提交：`b91ef55 fix(electron): 加固数据库参数边界`。
- 推送：`origin/codex/architecture-stabilization`。

### 阶段 3 后续：数据库迁移机制完善

**目标：** 把当前 `schema_migrations` 基线扩展为可持续维护的迁移执行器。

**当前状态：** 已完成，阶段 4-7 暂停。

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

**已完成记录：**

- Electron 迁移已改为显式 `MIGRATIONS` 列表，迁移项包含 `version`、`name`、`up(database)`。
- Electron `runPendingMigrations` 只执行未记录迁移，并在成功后写入 `schema_migrations`。
- Tauri 已引入 `SCHEMA_MIGRATIONS`，数据库打开时按同一版本语义记录基线迁移。
- 新增 Electron 迁移列表与未执行迁移测试。
- 新增 Tauri 旧库升级测试，覆盖没有 `schema_migrations` 的旧数据库文件。
- `docs/architecture/database-migrations.md` 已补充新增迁移步骤和回滚策略。

**已验证：**

| 命令 | 结果 |
| --- | --- |
| `npm run test:db-migrations` | 通过，3 个迁移测试通过。 |
| `cargo test` | 通过，新增 2 个迁移单元测试、数据库集成测试 13 个通过，Rust 全量测试通过。 |
| `npm run test:api-contract` | 通过，5 个契约测试通过。 |
| `npm run test:electron-db-safety` | 通过，5 个数据边界测试通过。 |
| `npm run build` | 通过，Vite 生产构建成功。 |
| Electron 8 秒启动 smoke | 通过启动观察；Windows 仍有既有 `WSALookupServiceBegin failed with: 10108` 告警，未导致启动退出。 |

### 阶段 4：AI Key 与配置安全收口

**目标：** 在不发布新版本前，先明确 API Key 的短期保护和中期迁移路径，避免继续扩大明文配置面。

**当前状态：** 已完成并已提交推送。

**涉及文件：**

- 新增：`electron/security/apiConfig.cjs`
- 修改：`electron/main.cjs`
- 修改：`package.json`
- 修改：`src/api/index.js`
- 修改：`src-tauri/src/database.rs`
- 修改：`src-tauri/src/lib.rs`
- 修改：`src-tauri/tests/ai_client.rs`
- 修改：`src-tauri/tests/database_store.rs`
- 修改：`src/pages/AiImport.jsx`
- 修改：`src/pages/Settings.jsx`
- 新增：`scripts/__tests__/api-config-secrets.test.mjs`
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

**已完成记录：**

- Electron `settings:getApiConfig` 不再返回完整 Key，改为返回空 `apiKey`、`apiKeyPreview` 和 `hasApiKey`。
- Electron `settings:setApiConfig` 收到空白 Key 时保留已保存 Key，收到非空 Key 时才替换。
- Tauri `settings_get_api_config` 改为返回公开配置结构，不暴露完整 Key。
- Tauri 数据库保存 API 配置时，空白 Key 会保留已有 Key。
- 设置页不再把读取到的完整 Key 写入输入框，只展示脱敏预览；测试连接支持使用已保存 Key。
- AI 导入页改用 `hasApiKey` 判断是否已有配置。
- 新增 `npm run test:api-config-security`，覆盖 Electron 脱敏、空 Key 保留和前端静态边界。

**当前保护级别：**

- 当前 Key 仍保存在本地数据库设置表中，不能视为系统级安全凭据仓库。
- 本阶段只收口展示、读取契约、错误与日志暴露面；后续如要提升保护级别，应评估系统凭据存储。

**已验证：**

| 命令 | 结果 |
| --- | --- |
| `npm run test:api-config-security` | 通过，3 个 Key 脱敏与前端边界测试通过。 |
| `npm run test:api-contract` | 通过，5 个契约测试通过。 |
| `npm run test:electron-db-safety` | 通过，5 个数据边界测试通过。 |
| `npm run test:db-migrations` | 通过，3 个迁移测试通过。 |
| `npm run build` | 通过，Vite 生产构建成功。 |
| `cargo test` | 通过，新增公开配置脱敏测试，Rust 全量测试通过。 |
| `cargo fmt -- --check` | 通过。 |
| `node --check electron/main.cjs`、`node --check electron/security/apiConfig.cjs` | 通过。 |
| `rg -n "sk-\|apiKey\|api_key" dist electron src src-tauri --glob "!src-tauri/target/**"` | 有命中，均为变量名、字段名、UI 占位符或测试夹具；未发现真实完整 Key。 |
| `rg -n "sk-[A-Za-z0-9_-]{12,}\|Bearer\\s+sk-" dist electron src src-tauri --glob "!src-tauri/target/**"` | 无命中。 |
| Electron 设置页 smoke | 通过；Electron shell 中进入 `#/settings`，API Key 输入框值长度为 `0`。Windows 仍有既有 `WSALookupServiceBegin failed with: 10108` 告警，未导致启动退出。 |

### 阶段 5：双运行时真实验收与取舍

**目标：** 明确 Electron 稳定线和 Tauri 迁移线的真实状态，避免两个运行时长期无边界并行。

**当前状态：** 已完成并已提交推送；阶段 5.5 已完成准入评估，阶段 6 暂不开始。

**涉及文件：**

- 新增：`docs/architecture/runtime-acceptance.md`
- 参考：`docs/architecture/desktop-api-contract.md`
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

**已完成记录：**

- 新增 `docs/architecture/runtime-acceptance.md`，固化 Electron 稳定线、Tauri 迁移线、验收矩阵、差异归类和发布前阻塞项。
- Electron CDP smoke 已覆盖公开配置脱敏、设置保存、题库 CRUD、题目 CRUD、随机练习数据、CSV 导入、练习记录、错题本、Prompt、聊天历史和 8 个核心路由。
- Tauri `npm run tauri:dev` 已完成启动 smoke，WebView2 CDP 可见 `QuestPilot` 页面目标，8 个核心路由均可加载根节点内容。
- Tauri WebView2 CDP API smoke 已覆盖 Tauri runtime 识别、无 Electron API、公开配置脱敏、设置保存、题库 CRUD、题目 CRUD、CSV 导入、练习记录、错题本、Prompt 和聊天历史，并清理临时数据。
- 明确 CSV 模板下载、CSV 导出、真实 AI 解析、真实 AI 聊天、Tauri 窗口控制、Electron 到 Tauri 数据迁移和打包产物 smoke 仍是发布前阻塞项或待人工验收项。

**取舍决策：**

- Electron 继续作为当前默认稳定运行时。
- Tauri 继续作为迁移验证线，只做编译、测试、启动和必要 smoke 保活；未清空阻塞项前不得替换 Electron。

**已验证：**

| 命令或 smoke | 结果 |
| --- | --- |
| `npm run tauri:info` | 通过，Windows WebView2、Rust、Node、Tauri CLI 均可用。 |
| `npm run test:api-contract` | 通过，5 个契约测试通过。 |
| `npm run build` | 通过，Vite 生产构建成功。 |
| `cargo test` | 通过，Rust 全量测试通过。 |
| Electron CDP smoke | 通过，核心 API 与 8 个页面路由均通过；真实 AI 网络请求未执行。 |
| Tauri route smoke | 通过，`npm run tauri:dev` 可启动，WebView2 CDP 可见 `QuestPilot` 页面目标，8 个页面路由均加载。 |
| Tauri API smoke | 通过，核心本地 API 均通过并清理临时数据；CSV 保存对话框与真实 AI 未自动触发。 |

### 阶段 5.5：Tauri 主线化准入

**目标：** 判断 Tauri 是否可以从迁移验证线升级为新开发主线，并明确 Electron 是否可以进入维护冻结状态。

**当前状态：** 已完成准入评估；本阶段提交并推送成功前不得进入阶段 6。

**定位：**

- 本阶段不是发布 Tauri。
- 本阶段不是删除 Electron。
- 本阶段不是立刻冻结 Electron 的所有修改。
- 本阶段只做准入验证、小范围补齐和决策记录。

**涉及文件：**

- 修改：`docs/plans/2026-05-24-architecture-stabilization.md`
- 修改：`docs/architecture/runtime-acceptance.md`
- 视结果修改：`src-tauri/capabilities/main.json`
- 视结果修改：`src-tauri/src/lib.rs`
- 修改：`src-tauri/src/database.rs`
- 修改：`src-tauri/tests/database_store.rs`
- 视结果修改：`src/api/index.js`
- 视结果修改：`electron/main.cjs`
- 视结果新增或修改：`docs/architecture/tauri-mainline-readiness.md`

**任务：**

1. 核查 Tauri 能力与权限边界。
   - 检查 `src-tauri/capabilities/main.json` 是否覆盖当前真实使用的对话框能力。
   - 重点验证 CSV 模板下载、CSV 导出、文件选择、取消保存和实际写入路径。
   - 如果需要前端直接调用 Tauri dialog 插件，补齐 `dialog:allow-save` 或等价权限；如果仍由 Rust command 发起保存对话框，必须用真实窗口验收确认。
2. 完成 Tauri 真实窗口验收。
   - 使用 `npm run tauri:dev`。
   - 覆盖题库 CRUD、题目 CRUD、CSV 导入、CSV 模板下载、CSV 导出、随机练习、错题本、设置保存、窗口最小化、最大化、关闭和拖拽。
   - 记录每个流程的通过、失败、阻塞或未覆盖原因，不得把未点击流程写成已验证。
3. 完成真实 AI 路径验收。
   - 使用真实 API Key 验证 AI 解析成功路径、AI 聊天成功路径、连接失败路径和错误脱敏路径。
   - 继续确认前端、Electron、Tauri 的错误信息和日志不泄露完整 Key。
4. 明确数据目录和迁移策略。
   - 对比 Electron 与 Tauri 的应用数据目录。
   - 明确旧 Electron 数据在 Tauri 主线化后的处理方式：自动迁移、手动导入、并行保留或暂不支持。
   - 如果暂不迁移，必须把用户影响和回退路径写入文档。
5. 做主线化取舍决策。
   - 输出三选一结论：`Tauri-first`、`Tauri-continue-validation` 或 `Tauri-freeze`。
   - 若结论为 `Tauri-first`，明确 Electron 维护冻结规则：只接受 P0/P1 修复、安全修复、数据兼容修复和回退线保活。
   - 若结论不是 `Tauri-first`，明确还剩哪些阻塞项以及下一次复查条件。

**验证：**

- `npm run tauri:info`
- `npm run test:api-contract`
- `npm run test:api-config-security`
- `npm run build`
- `cargo test`
- `npm run tauri:dev`
- Tauri 真实窗口验收记录
- 真实 AI Key 验收记录
- Electron smoke，确认稳定回退线未被破坏

**完成标准：**

- Tauri 的 CSV 保存、真实 AI、窗口控制和文件系统路径都有明确验收结论。
- Electron 到 Tauri 的数据目录和迁移策略有明确文档结论。
- `docs/architecture/runtime-acceptance.md` 或新增准入文档中写明是否允许进入 `Tauri-first`。
- 阶段 5.5 完成、验证、提交并推送成功前，不进入阶段 6。

**已完成记录：**

- 新增 `docs/architecture/tauri-mainline-readiness.md`，记录准入证据、阻塞项、数据目录结论和主线化决策。
- 准入结论为 `Tauri-continue-validation`：Tauri 继续作为迁移验证线，暂不替换 Electron，也不冻结 Electron。
- Tauri WebView2 CDP smoke 已覆盖 8 个核心路由、Tauri runtime 识别、无 Electron API、公开配置脱敏、窗口最大化切换、设置保存、题库 CRUD、题目 CRUD、CSV 导入、练习记录和错题本。
- Tauri 本机公开配置显示 `hasSavedApiKey=false`，真实 AI 解析和 AI 聊天未执行，继续作为准入阻塞项。
- CSV 模板下载和题库导出仍需真实保存对话框验收，继续作为准入阻塞项。
- 已补齐 Tauri 旧库候选路径，覆盖当前 Electron `QuestPilot`/`questpilot` 数据目录和 `questpilot.db` 文件名，并新增 Rust 测试。
- 已补齐已有 Tauri 空库迁移策略：目标库无用户数据且 Electron 候选库有用户数据时自动替换空目标库；目标 Tauri 库已有用户数据时不静默覆盖。

**已验证：**

| 命令或 smoke | 结果 |
| --- | --- |
| `npm run tauri:info` | 通过，Windows WebView2、Rust、Node、Tauri CLI 均可用。 |
| `npm run test:api-contract` | 通过，5 个契约测试通过。 |
| `npm run test:api-config-security` | 通过，3 个 API Key 脱敏与前端边界测试通过。 |
| `cargo test --test database_store legacy_database_candidates_include_current_electron_data_dirs` | 先失败后通过，证明并修复当前 Electron 数据目录候选缺口。 |
| `cargo test --test database_store database_store_replaces_empty_target_with_legacy_candidate` | 先失败后通过，证明并修复已有 Tauri 空库不会迁移 Electron 候选库的问题。 |
| `cargo test --test database_store database_store_keeps_target_when_it_has_user_data` | 通过，确认目标 Tauri 库已有用户数据时不会被 Electron 候选库静默覆盖。 |
| `cargo test --test database_store` | 通过，16 个数据库集成测试通过。 |
| `cargo test` | 通过，Rust 全量测试通过。 |
| Tauri WebView2 CDP smoke | 通过可自动验证部分；CSV 保存对话框、真实 AI、最小化/拖拽和打包产物未覆盖。 |

### 阶段 6：模块拆分与维护边界

**目标：** 在安全和迁移边界稳定后，再拆分超大文件，降低后续维护成本。

**当前状态：** 已按 Tauri 主线完成；Electron 相关拆分暂不执行，除非用户后续明确要求。

**涉及文件：**

- 拆分候选：`src-tauri/src/database.rs`
- 新增：`src-tauri/src/database/types.rs`
- 新增：`src-tauri/src/database/validation.rs`
- 新增：`src-tauri/src/database/migrations.rs`
- 新增：`src-tauri/src/database/schema.rs`
- 新增：`src-tauri/src/database/legacy.rs`
- 新增：`src-tauri/src/database/queries.rs`
- 更新测试：`src-tauri/tests/database_store.rs`

**任务：**

1. 先做依赖图盘点，不直接搬代码。
   - 命令：`rg -n "^(pub )?(struct|enum|const|fn) |^impl " src-tauri/src/database.rs`
2. 按领域拆分。
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
- 必要时执行 `npm run tauri:info`、`npm run tauri:dev` 或 Tauri CDP smoke

**完成标准：**

- 大文件拆分后公开 API 不变。
- 每个领域有清晰文件归属。
- 没有为了拆分而改变业务行为。
- 本阶段不主动修改 Electron 源码。

**已完成记录：**

- 已按 Tauri 主线策略完成 `src-tauri/src/database.rs` 依赖图盘点。
- 已新增 `src-tauri/src/database/types.rs`，将数据库公开 DTO 和序列化类型从主数据库实现文件中拆出。
- 已新增 `src-tauri/src/database/validation.rs`，承接题库名称、题目、聊天记录、API 配置默认值和选项序列化等输入校验边界。
- 已新增 `src-tauri/src/database/migrations.rs`，承接 schema migration 版本记录、幂等执行和失败回滚测试。
- 已新增 `src-tauri/src/database/schema.rs`，承接数据库建表、索引、默认 Prompt 和迁移调度。
- 已新增 `src-tauri/src/database/legacy.rs`，承接旧 Electron/Tauri 候选库查找、空目标库替换和已有用户数据保护。
- 已新增 `src-tauri/src/database/queries.rs`，承接共享查询、映射、统计、错题本查询和设置读写辅助函数。
- `src-tauri/src/database.rs` 通过 `pub use types::{...}` 与 `pub use legacy::legacy_database_candidates` 保持 `database::Question`、`database::ApiConfig`、`database::legacy_database_candidates` 等公开路径不变。
- `src-tauri/src/database.rs` 已从阶段前的超大单文件拆到约 1,090 行，业务仓储方法仍留在主文件，后续可按领域继续拆服务方法。
- 本阶段未主动修改 `electron/`、`scripts/` 或前端 `src/` 运行时代码。

**已验证：**

| 命令 | 结果 |
| --- | --- |
| `cargo fmt -- --check` | 通过。 |
| `cargo test --test database_store` | 通过，16 个数据库集成测试通过。 |
| `cargo test` | 通过，Rust 全量测试通过。 |
| `npm run test:api-contract` | 通过，5 个 API 契约测试通过。 |
| `npm run test:db-migrations` | 通过，3 个数据库迁移脚本测试通过。 |
| `npm run build` | 通过。 |

### 阶段 7：发布前架构闸门

**目标：** 在恢复发布前建立最低闸门，避免架构治理未完成时误发新版。

**当前状态：** 已完成阶段 7 文档收口；Tauri 可继续作为开发主线，但发布默认运行时仍未准入。

**涉及文件：**

- 更新：`docs/plans/2026-05-24-architecture-stabilization.md`
- 新增：`docs/architecture/release-gate.md`
- 更新：`docs/architecture/runtime-acceptance.md`
- 更新：`docs/architecture/tauri-mainline-readiness.md`

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
   - Tauri dev 或预览级 smoke
   - Electron smoke 仅在恢复发布或用户明确要求时执行
   - 必要时再执行打包命令。
4. 记录人工验收结论。
   - 未完成的人工验收不得写成已验证。

**完成标准：**

- 发布前必须完成的自动化和手工验证都写入文档。
- 阻塞项未清零前，不更新发布版本。

**已完成记录：**

- 已新增 `docs/architecture/release-gate.md`，固化发布前自动化命令、人工验收清单、P0/P1 阻塞项和当前可发布判断。
- 已明确阶段 7 结论：允许继续 Tauri 主线开发；不允许删除 Electron 回退线；不允许把 Tauri 设为默认发布运行时；不允许在 P0 阻塞项清零前更新发布版本或打正式包。
- 已把真实 AI、CSV 保存对话框、Tauri 打包产物和目标 Tauri 库已有用户数据时的显式处置流程列为 P0 发布阻塞项。
- 已把 Tauri 窗口控制、文件选择真实点击、Electron 最终回退 smoke 和发布命令人工记录列为 P1 或待验收项。
- 已同步 `docs/architecture/runtime-acceptance.md` 和 `docs/architecture/tauri-mainline-readiness.md` 的阶段 7 入口。

**已验证：**

| 命令 | 结果 |
| --- | --- |
| `cargo fmt -- --check` | 通过。 |
| `cargo test --test database_store` | 通过，16 个数据库集成测试通过。 |
| `cargo test` | 通过，Rust 全量测试通过。 |
| `npm run test:api-contract` | 通过，5 个 API 契约测试通过。 |
| `npm run test:api-config-security` | 通过，3 个 API Key 安全测试通过。 |
| `npm run test:db-migrations` | 通过，3 个数据库迁移脚本测试通过。 |
| `npm run build` | 通过。 |
| `git diff --check` | 通过，仅保留 Git 行尾提示。 |
