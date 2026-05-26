# QuestPilot Backend Architecture

## 1. Layer Structure

```
Frontend (React/TypeScript)
        │  invoke(command_name, params)
        ▼
┌─────────────────────────────────┐
│        Command layer             │  src-tauri/src/commands/
│  Parse invoke params, call Service│
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│        Service layer             │  src-tauri/src/services/
│  Business logic, call Repository │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│       Repository layer           │  src-tauri/src/database/repositories/
│  Data access via with_connection │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│       DatabaseStore              │  src-tauri/src/database/
│  Holds rusqlite Connection       │
└────────────┬────────────────────┘
             │
             ▼
           SQLite
```

## 2. Layer Responsibilities

### Command layer
- **Location**: `src/commands/`
- **Responsibility**: receive Tauri invoke params → create Service → call service method → return result
- **Not responsible for**: SQL, business rules, input validation
- **Constraint**: command names, params, and return shapes must remain stable; the frontend invoke interface must not change arbitrarily
- **Entry pattern**: `open_store(&app)? → ServiceXxx::new(store) → service.method()`

### Service layer
- **Location**: `src/services/`
- **Responsibility**: business rules (delete guards, threshold calculation, pagination), multi-repository coordination
- **Not responsible for**: executing SQL directly, holding a Connection
- **Constructor convention**: `pub fn new(store: DatabaseStore) -> Self` (creates Repository internally)

### Repository layer
- **Location**: `src/database/repositories/`
- **Responsibility**: database read/write encapsulation; one Repository per domain (question banks, questions, wrong book, etc.)
- **Current implementation**: holds `DatabaseStore`, executes SQL directly via `with_connection` / `with_transaction`
- **Shared helpers**: `repositories/helpers.rs` provides SQL helpers and row mappers reused across repositories
- **Not responsible for**: business rule decisions

### DatabaseStore
- **Location**: `src/database/mod.rs`
- **Responsibility**: holds `RefCell<Connection>`, manages connection lifecycle, provides `with_connection` / `with_transaction`, initialises schema and runs migrations
- **Removed**: all old domain methods (`create_bank`, `save_practice_record`, etc.) were deleted in the Phase 3 clean-up branch

### Phase 3 Clean-up (`feature/remove-legacy-databasestore-methods`)

Completed:
1. Deleted all `impl DatabaseStore` domain methods from `database/{settings,question,question_bank,practice,wrong_book,ai,stats}.rs`
2. Created `repositories/helpers.rs` to centralise SQL helpers and row mappers shared by `PromptRepository`, `ChatHistoryRepository`, and `QuestionRepository` (formerly in `queries.rs`)
3. `SettingsRepository` and `QuestionBankRepository` now use public functions from `validation.rs`, removing inline duplicates
4. `ExportService` migrated to `with_connection` direct SQL
5. `tests/database_store.rs` fully rewritten to call through the Repository layer (`open_store_at` pattern)
6. Deleted `database/queries.rs` (content migrated) and removed `mod` declarations for the 7 now-empty domain files

## 3. Repository Migration Status (all complete)

### Repositories migrated in Phase 2

- **`WrongBookRepository`** (first pilot): uses both `with_connection` and `with_transaction`
- **`PracticeRepository`** (second): `with_connection` only, no transaction needed
- **`QuestionBankRepository`** (third): `create/list_all/find_by_id/update` use `with_connection`; `delete` uses `with_transaction` (atomic delete of questions + bank) followed by `with_connection` (operation log)
- **`SettingsRepository`**: `with_connection` throughout; inlines keychain helpers, preserves keychain read/write/migration logic
- **`DraftRepository`**: `with_connection` throughout; simple single-row persistence
- **`StatsRepository`**: `with_connection` throughout; inlines aggregation query helpers
- **`PromptRepository`**: `with_connection` throughout; accesses shared helpers via `super::helpers`
- **`ChatHistoryRepository`**: same as above
- **`QuestionRepository`**: `create/list_by_bank/get_random/find_by_id/update/search/count` use `with_connection`; `create_batch/delete_batch` use `with_transaction` followed by `with_connection` (log), preserving original behaviour

All repositories now access `rusqlite::Connection` / `Transaction` directly through `DatabaseStore::with_connection` / `with_transaction` — no domain method delegation:

```
Repository.read_method()
  → DatabaseStore::with_connection(|conn| { /* direct SQL */ })
  → rusqlite::Connection
```

```
Repository.atomic_batch_method()          // transaction path only
  → DatabaseStore::with_transaction(|tx| { /* direct SQL, single transaction */ })
  → rusqlite::Transaction
```

#### `with_connection` / `with_transaction` design

```rust
// pub(crate) controlled access on DatabaseStore
impl DatabaseStore {
    pub(crate) fn with_connection<T, F>(&self, f: F) -> Result<T, String>
    where F: FnOnce(&Connection) -> Result<T, String>

    pub(crate) fn with_transaction<T, F>(&self, f: F) -> Result<T, String>
    where F: FnOnce(&rusqlite::Transaction<'_>) -> Result<T, String>
}
```

- `with_connection`: borrows immutably; suitable for reads and single writes.
- `with_transaction`: borrows mutably, opens a rusqlite transaction; commits on closure success, auto-rolls back on failure or panic.
- The closure **must not** call any `DatabaseStore` method that would re-borrow `self.connection` (double-borrow RefCell panic).
- `Transaction` implements `Deref<Target=Connection>`, so private SQL helpers that accept `&Connection` work transparently inside a transaction closure.

#### Old DatabaseStore domain methods (already removed)

All domain methods and helpers in `database/{settings,question,question_bank,practice,wrong_book,ai,stats}.rs` and `queries.rs` were **fully deleted** in the Phase 3 clean-up branch; the corresponding `.rs` files were also removed.

## 4. Repository Migration Reference

| Repository | Status |
|---|---|
| `WrongBookRepository` | ✅ complete |
| `PracticeRepository` | ✅ complete |
| `QuestionBankRepository` | ✅ complete |
| `SettingsRepository` | ✅ complete |
| `DraftRepository` | ✅ complete |
| `StatsRepository` | ✅ complete |
| `PromptRepository` | ✅ complete |
| `ChatHistoryRepository` | ✅ complete |
| `QuestionRepository` | ✅ complete |

## 5. Async Commands — `!Send` Two-Phase Rule

`DatabaseStore` contains `RefCell<Connection>` and therefore does not implement `Send`. Tauri async commands require their futures to be `Send`.

**Rule: all `!Send` types (DatabaseStore / Repository / Service) must be dropped before any `.await` point.**

### Standard two-phase pattern

```rust
// ✅ Correct: Service temporary value dropped before await
pub async fn some_command(app: AppHandle, ...) -> Result<_, AppError> {
    // Phase 1: synchronous — all DB access completes, Service dropped at statement end
    let config = SettingsService::new(open_store(&app)?).get_api_config()?;
    let custom_prompt = match prompt_id {
        Some(pid) => PromptService::new(open_store(&app)?).get_by_id(pid).ok().flatten()...,
        None => None,
    };
    // Phase 2: await — no !Send types alive
    some_async_call(...).await...
}

// ✅ Correct: reopen store after await
let result = some_async_call().await?;
let output = SomeService::new(open_store(&app)?).write(result)?;
```

```rust
// ❌ Wrong: Service / store alive across await
let service = SomeService::new(open_store(&app)?);
let data = service.get_something()?;
some_async_call().await?;  // service still alive → !Send → compile error
```

## 6. Wrong-Book Transactional Update

`WrongBookService::update_from_practice` is the only method involving a batch write. It delegates to `WrongBookRepository::update_from_practice_tx` for atomicity:

- Clean up orphan records
- Wrong answer: `INSERT OR UPDATE wrong_count`
- Correct answer: `UPDATE correct_count + 1`; delete when threshold reached

All operations run inside a single `rusqlite::Transaction`; any failure auto-rolls back the entire batch.

## 7. Frontend Invoke Contract

- **Command names are immutable**: all frontend `invoke('command_name', ...)` calls depend on exact Tauri command names
- **Params and return shapes must not change**: `serde rename_all = "camelCase"` fixes the serialisation format
- **Adding a command does not affect existing ones**: e.g. `ai_import_questions_direct` is additive and does not replace `ai_parse_questions`
- **Error format is stable**: `AppError` serialises to `{ "kind": "Database" | "Ai" | "Config", "message": "..." }`

## 8. Service Coverage (current)

| Domain | Repository | Service | Command coverage |
|---|---|---|---|
| question | `QuestionRepository` | `QuestionService` | ✅ full |
| question_bank | `QuestionBankRepository` | `QuestionBankService` | ✅ full |
| practice | `PracticeRepository` | `PracticeService` | ✅ full |
| wrong_book | `WrongBookRepository` | `WrongBookService` | ✅ full |
| import | `QuestionRepository` | `ImportService` | ✅ full |
| settings | `SettingsRepository` | `SettingsService` | ✅ full |
| prompt | `PromptRepository` | `PromptService` | ✅ full |
| chat_history | `ChatHistoryRepository` | `ChatHistoryService` | ✅ full |
| stats | `StatsRepository` | `StatsService` | ✅ full |
| draft | `DraftRepository` | `DraftService` | ✅ full |
| export (csv) | _(direct store hold)_ | `ExportService` | ✅ full |
| ai import | `QuestionRepository` | `ImportService` | ✅ full |
| window | — | — | no DB ops |
| migration | — | — | legacy free functions |
