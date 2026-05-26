# QuestPilot 后端架构说明

## 1. 分层结构

```
Frontend (React/TypeScript)
        │  invoke(command_name, params)
        ▼
┌─────────────────────────────────┐
│        Command 层                │  src-tauri/src/commands/
│  接收前端参数，调用 Service       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│        Service 层                │  src-tauri/src/services/
│  业务逻辑编排，调用 Repository   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│       Repository 层              │  src-tauri/src/database/repositories/
│  数据访问封装，委托 DatabaseStore │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│       DatabaseStore              │  src-tauri/src/database/
│  rusqlite Connection 持有者      │
└────────────┬────────────────────┘
             │
             ▼
           SQLite
```

## 2. 各层职责

### Command 层
- **文件**：`src/commands/`
- **职责**：接收 Tauri invoke 参数 → 创建 Service → 调用 service 方法 → 返回结果
- **不负责**：SQL 操作、业务规则、数据校验
- **约束**：保持 command 名称/参数/返回结构稳定，前端 invoke 接口不得随意变更
- **调用入口**：`open_store(&app)? → ServiceXxx::new(store) → service.method()`

### Service 层
- **文件**：`src/services/`
- **职责**：业务规则（如删除校验、阈值计算、分页协调）、多 Repository 协调
- **不负责**：直接执行 SQL、持有 Connection
- **构造约定**：`pub fn new(store: DatabaseStore) -> Self`（内部创建 Repository）

### Repository 层
- **文件**：`src/database/repositories/`
- **职责**：数据库读写接口封装，每个 Repository 对应一个领域（题库、题目、错题本等）
- **当前实现**：Phase 1 持有 `DatabaseStore`，委托其方法
- **不负责**：业务规则判断

### DatabaseStore
- **文件**：`src/database/`（`mod.rs` + 各 `impl` 文件）
- **职责**：持有 `RefCell<Connection>`，提供原子 SQL 操作和事务接口
- **兼容入口**：旧 `DatabaseStore` 方法全部保留，供 Repository 委托调用

## 3. Repository 迁移进度

### Phase 1（其余 Repository 当前状态）

采用**零侵入委托模式**：

```
Repository.method() → store.method()
```

### Phase 2 已完成的 Repository

- **`WrongBookRepository`**（首个试点）：含事务，使用 `with_connection` + `with_transaction`
- **`PracticeRepository`**（第二个）：纯 `with_connection`，无事务需求
- **`QuestionBankRepository`**（第三个）：`create/list_all/find_by_id/update` 用 `with_connection`；`delete` 先 `with_transaction`（原子删除题目+题库）再 `with_connection`（写日志，与原行为一致）

三者均已迁移为**通过 `DatabaseStore::with_connection` / `with_transaction` 直接访问
`rusqlite::Connection` / `Transaction`**，不再委托 `DatabaseStore` 的领域方法：

```
Repository.read_method()
  → DatabaseStore::with_connection(|conn| { /* 直接 SQL */ })
  → rusqlite::Connection
```

```
Repository.atomic_batch_method()                  // 仅事务场景使用
  → DatabaseStore::with_transaction(|tx| { /* 直接 SQL，单事务 */ })
  → rusqlite::Transaction
```

#### with_connection / with_transaction 设计说明

```rust
// DatabaseStore 新增的受控访问入口（pub(crate)）
impl DatabaseStore {
    pub(crate) fn with_connection<T, F>(&self, f: F) -> Result<T, String>
    where F: FnOnce(&Connection) -> Result<T, String>

    pub(crate) fn with_transaction<T, F>(&self, f: F) -> Result<T, String>
    where F: FnOnce(&rusqlite::Transaction<'_>) -> Result<T, String>
}
```

- `with_connection`：borrow 不可变引用，适合读操作和单条写操作。
- `with_transaction`：borrow 可变引用，开启 rusqlite 事务，闭包成功则 commit，失败或 panic 则自动 rollback。
- 闭包内**不得**再调用任何会重新 borrow `self.connection` 的 `DatabaseStore` 方法（RefCell 重复借用 panic）。
- `Transaction` 实现 `Deref<Target=Connection>`，私有 SQL helper 统一接收 `&Connection`，对事务闭包透明适用。

#### DatabaseStore 旧方法处理

`database/wrong_book.rs` 与 `database/practice.rs` 中所有旧 `DatabaseStore` 方法**全部保留**，
注释统一标明"兼容入口保留；新主路径由 XxxRepository 直接访问 Connection"。
确认无调用后，后续可在独立 PR 中按模块逐个删除。

### 后续迁移建议

其余 Repository 可按 `WrongBookRepository` 模式逐步迁移：
1. 在 Repository 方法中改调 `self.store.with_connection(...)` / `with_transaction(...)`
2. 将 SQL 逻辑内联到 Repository 文件私有函数
3. `DatabaseStore` 旧领域方法注释为兼容入口，暂不删除

## 4. 迁移优先级建议（参考）

| Repository | 迁移难度 | 建议顺序 |
|---|---|---|
| `WrongBookRepository` | ✅ 已完成 | — |
| `PracticeRepository` | ✅ 已完成 | — |
| `QuestionBankRepository` | ✅ 已完成 | — |
| `SettingsRepository` | 低 | 次优先 |
| `StatsRepository` | 低（只读多） | 第三 |
| `QuestionRepository` | 中（有分页/批量） | 第四 |
| 其余 | 低 | 按需 |

## 5. async Command 的 !Send 两阶段处理原则

`DatabaseStore` 含 `RefCell<Connection>`，不实现 `Send`。Tauri async command 要求 future 为 `Send`。
**解决原则：所有 `!Send` 类型（DatabaseStore / Repository / Service）必须在 `.await` 前析构。**

### 标准两阶段模式

```rust
// ✅ 正确：Service 临时值在 await 前析构
pub async fn some_command(app: AppHandle, ...) -> Result<_, AppError> {
    // Phase 1：同步读取所需数据，Service 在语句末析构
    let config = SettingsService::new(open_store(&app)?).get_api_config()?;
    let custom_prompt = match prompt_id {
        Some(pid) => PromptService::new(open_store(&app)?).get_by_id(pid).ok().flatten()...,
        None => None,
    };
    // Phase 2：await，此时无 !Send 类型存活
    some_async_call(...).await...
}

// ✅ 正确：await 后重新 open store
let result = some_async_call().await?;
let output = SomeService::new(open_store(&app)?).write(result)?;
```

```rust
// ❌ 错误：Service/store 跨越 await
let service = SomeService::new(open_store(&app)?);
let data = service.get_something()?;
some_async_call().await?;  // service 仍存活 → !Send → 编译失败
```

## 6. wrong_book 事务化更新

`WrongBookService::update_from_practice` 是唯一涉及批量写入的方法，通过 `DatabaseStore::update_wrong_book_from_practice_tx` 保证原子性：

- 孤儿记录清理
- 答错：`INSERT OR UPDATE wrong_count`  
- 答对：`UPDATE correct_count + 1`，达阈值则 `DELETE`

所有操作在单个 `rusqlite::Transaction` 内完成，任一步骤失败则自动回滚。

## 7. 前端 invoke 接口稳定原则

- **命令名称不得重命名**：前端所有 `invoke('command_name', ...)` 调用均基于 Tauri command 名称
- **参数和返回结构不得变更**：serde 的 `rename_all = "camelCase"` 设置已固定序列化格式
- **新增 command 不影响旧命令**：如 `ai_import_questions_direct` 是新增，不替换 `ai_parse_questions`
- **错误格式保持一致**：`AppError` 序列化为 `{ "kind": "Database" | "Ai" | "Config", "message": "..." }`

## 8. Service 覆盖状态（当前）

| 模块 | Repository | Service | Command 状态 |
|------|-----------|---------|-------------|
| question | `QuestionRepository` | `QuestionService` | ✅ 全覆盖 |
| question_bank | `QuestionBankRepository` | `QuestionBankService` | ✅ 全覆盖 |
| practice | `PracticeRepository` | `PracticeService` | ✅ 全覆盖 |
| wrong_book | `WrongBookRepository` | `WrongBookService` | ✅ 全覆盖 |
| import | `QuestionRepository` | `ImportService` | ✅ 全覆盖 |
| settings | `SettingsRepository` | `SettingsService` | ✅ 全覆盖 |
| prompt | `PromptRepository` | `PromptService` | ✅ 全覆盖 |
| chat_history | `ChatHistoryRepository` | `ChatHistoryService` | ✅ 全覆盖 |
| stats | `StatsRepository` | `StatsService` | ✅ 全覆盖 |
| draft | `DraftRepository` | `DraftService` | ✅ 全覆盖 |
| export (csv) | _(直接持有 store)_ | `ExportService` | ✅ 全覆盖 |
| ai import | `QuestionRepository` | `ImportService` | ✅ 全覆盖 |
| window | — | — | 无 DB 操作 |
| migration | — | — | 使用 legacy 自由函数 |
