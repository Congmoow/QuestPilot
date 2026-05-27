**English** | [中文](./README.zh-CN.md)

# Tauri Backend Source Guide

Rust + Tauri 2.x backend. Exposes SQLite persistence and AI networking to the frontend via `invoke` commands.

---

## Directory Structure

```
src-tauri/src/
├── lib.rs              # Entry point: mod declarations + invoke_handler registration + run()
├── main.rs             # Binary entry: calls lib::run()
├── ai.rs               # AI HTTP client (OpenAI-compatible API, test connection)
├── csv_tools.rs        # CSV parse / generate / export utilities
├── toml_tools.rs       # TOML parse utilities for batch import
│
├── commands/           # Tauri command layer — thin wrappers, one file per domain
│   ├── mod.rs          # Shared helpers: open_store / main_window / ai_config_from_database
│   ├── window.rs       # window_minimize / maximize / close / is_maximized
│   ├── question_bank.rs  # question_bank_create / get_all / get_by_id / update / delete
│   ├── question.rs     # question_create / batch / get / search / update / delete + PaginatedQuestions
│   ├── stats.rs        # stats_get_dashboard / operation_logs / type_distribution
│   ├── settings.rs     # settings_* / migration_* + PublicApiConfig / mask_api_key
│   ├── ai_cmd.rs       # ai_parse_questions / ai_chat / ai_import_questions_direct
│   ├── draft.rs        # draft_save / load / clear
│   ├── prompt_chat.rs  # prompt_* / chat_history_*
│   ├── practice.rs     # practice_save_record / get_records / get_all_stats
│   ├── wrong_book.rs   # wrong_book_* + PaginatedWrongBookItems
│   ├── csv.rs          # csv_select_file / download_template / parse / import / export
│   └── toml.rs         # toml_select_file / parse_file
│
├── services/           # Service layer — business logic, one file per domain
│   ├── mod.rs
│   ├── question_service.rs
│   ├── question_bank_service.rs
│   ├── practice_service.rs
│   ├── wrong_book_service.rs
│   ├── import_service.rs
│   ├── settings_service.rs
│   ├── prompt_service.rs
│   ├── chat_history_service.rs
│   ├── stats_service.rs
│   ├── draft_service.rs
│   └── export_service.rs
│
└── database/           # Persistence layer — SQLite via rusqlite
    ├── mod.rs          # DatabaseStore struct + open / open_with_legacy_candidates / table_count
    ├── types.rs        # All public data types (Question, QuestionBank, ApiConfig, …)
    ├── schema.rs       # DDL migrations bootstrap + ensure_default_prompt
    ├── migrations.rs   # Versioned migration runner
    ├── validation.rs   # Input validation helpers
    ├── legacy.rs       # Electron→Tauri database migration logic
    └── repositories/   # Repository layer — domain-scoped data-access objects (direct SQL via with_connection/with_transaction)
        ├── helpers.rs      # Shared SQL helpers and row mappers (add_operation_log, find_question_by_id, query_questions, …)
        ├── mod.rs
        ├── question_repo.rs
        ├── question_bank_repo.rs
        ├── practice_repo.rs
        ├── wrong_book_repo.rs
        ├── settings_repo.rs
        ├── prompt_repo.rs
        ├── chat_history_repo.rs
        ├── stats_repo.rs
        └── draft_repo.rs
```

---

## Architecture

```
Frontend (invoke)
        │
        ▼
commands/<domain>.rs      ← Tauri #[command] thin wrapper; calls open_store() → ServiceXxx::new(store)
        │
        ▼
services/<domain>_service.rs  ← Business logic, validation, multi-step coordination
        │
        ▼
database/repositories/<domain>_repo.rs  ← Data-access object; executes SQL via with_connection/with_transaction
        │
        ▼
database::DatabaseStore   ← Single connection wrapper (RefCell<Connection>)
                                         holds RefCell<Connection>, provides with_connection/with_transaction
```

**Rules**:
- No SQL in command or service files.
- Business rules (validation, thresholds, limits) live in the Service layer.
- Repositories call `DatabaseStore::with_connection` / `with_transaction` — no direct domain method calls.
- All `DatabaseStore` / Repository / Service instances must be dropped before any `.await` point to satisfy Rust's `!Send` constraint (see _Async Commands_ below).

---

## Command Reference

All commands are registered in `lib.rs` and exposed to the frontend via `src/api/index.ts`.

### Window (`commands/window.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `window_minimize` | — | `()` |
| `window_maximize` | — | `()` (toggles) |
| `window_close` | — | `()` |
| `window_is_maximized` | — | `bool` |

### Question Bank (`commands/question_bank.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `question_bank_create` | `data: CreateQuestionBankInput` | `QuestionBank` |
| `question_bank_get_all` | — | `Vec<QuestionBank>` |
| `question_bank_get_by_id` | `id: i64` | `Option<QuestionBank>` |
| `question_bank_update` | `id: i64`, `data: CreateQuestionBankInput` | `Option<QuestionBank>` |
| `question_bank_delete` | `id: i64` | `()` |

### Question (`commands/question.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `question_create` | `bank_id: i64`, `data: CreateQuestionInput` | `Question` |
| `question_create_batch` | `bank_id: i64`, `questions: Vec<CreateQuestionInput>` | `ImportResult` |
| `question_get_by_bank_id` | `bank_id`, `page?`, `page_size?`, `question_type?` | `PaginatedQuestions` |
| `question_get_random` | `bank_id`, `limit?`, `question_type?` | `Vec<Question>` |
| `question_get_by_id` | `id: i64` | `Option<Question>` |
| `question_update` | `id: i64`, `data: CreateQuestionInput` | `Option<Question>` |
| `question_delete` | `ids: Vec<i64>` | `()` |
| `question_search` | `bank_id`, `keyword`, `page?`, `page_size?`, `question_type?` | `PaginatedQuestions` |

`PaginatedQuestions` shape: `{ data, total, page, pageSize, totalPages }`.

### Stats (`commands/stats.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `stats_get_dashboard` | — | `DashboardStats` |
| `stats_get_operation_logs` | `limit?` | `Vec<OperationLog>` |
| `stats_get_type_distribution` | `bank_id?` | `Vec<TypeDistribution>` |

### Settings & Migration (`commands/settings.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `settings_get_theme` | — | `String` |
| `settings_set_theme` | `theme: String` | `()` |
| `settings_get_wrong_book_threshold` | — | `i64` |
| `settings_set_wrong_book_threshold` | `threshold: i64` | `()` |
| `settings_get_api_config` | — | `PublicApiConfig` |
| `settings_set_api_config` | `config: ApiConfig` | `{ success: true }` |
| `settings_test_api_connection` | — | `{ success, message }` |
| `migration_get_legacy_status` | — | `LegacyDatabaseStatus` |
| `migration_backup_and_replace_from_legacy` | `legacy_path`, `confirmation` | `LegacyDatabaseReplaceResult` |

> `settings_get_api_config` returns `PublicApiConfig` — the full API key is never exposed; only `apiKeyPreview` (masked) and `hasApiKey` are returned.

### AI (`commands/ai_cmd.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `ai_parse_questions` | `content: String` | `serde_json::Value` |
| `ai_chat` | `messages: Vec<AiMessage>`, `prompt_id?` | `serde_json::Value` |
| `ai_import_questions_direct` | `content: String`, `bank_id: i64` | `AiImportResult` |

All three commands are `async`. They follow a two-phase pattern to satisfy Rust's `!Send` constraint: all database access (via `SettingsService`, `PromptService`, etc.) completes and drops before the `.await` network call; any post-call DB writes reopen a fresh store afterward.

### Draft (`commands/draft.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `draft_save` | `data: serde_json::Value` | `{ success: true }` |
| `draft_load` | — | `Option<serde_json::Value>` |
| `draft_clear` | — | `{ success: true }` |

### Prompt & Chat History (`commands/prompt_chat.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `prompt_get_all` | — | `Vec<Prompt>` |
| `prompt_get_by_id` | `id: i64` | `Option<Prompt>` |
| `prompt_create` | `data: CreatePromptInput` | `Prompt` |
| `prompt_update` | `id: i64`, `data: CreatePromptInput` | `Option<Prompt>` |
| `prompt_delete` | `id: i64` | `{ success: true }` |
| `chat_history_save` | `data: ChatHistoryInput` | `ChatHistory` |
| `chat_history_update` | `id: i64`, `messages: Value` | `Option<ChatHistory>` |
| `chat_history_get_all` | `limit?` | `Vec<ChatHistory>` (no messages field) |
| `chat_history_get_by_id` | `id: i64` | `Option<ChatHistory>` (with messages) |
| `chat_history_delete` | `id: i64` | `{ success: true }` |

### Practice (`commands/practice.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `practice_save_record` | `record: PracticeRecordInput` | `{ success: true }` |
| `practice_get_records` | `bank_id: i64`, `limit?` | `Vec<PracticeRecord>` |
| `practice_get_all_stats` | — | `Vec<PracticeStats>` |

### Wrong Book (`commands/wrong_book.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `wrong_book_get_counts_by_bank` | — | `Vec<WrongBookCount>` |
| `wrong_book_get_items` | `bank_id?`, `page?`, `page_size?` | `PaginatedWrongBookItems` |
| `wrong_book_get_random_questions` | `bank_id?`, `limit?` | `Vec<Question>` |
| `wrong_book_update_from_practice` | `results: Vec<WrongBookPracticeResult>`, `threshold?` | `{ success: true }` |
| `wrong_book_remove_item` | `question_id: i64` | `{ success: true }` |
| `wrong_book_clear` | `bank_id?` | `{ success: true }` |

### CSV (`commands/csv.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `csv_select_file` | — | `Option<String>` (file path) |
| `csv_download_template` | — | `{ success, filePath?, cancelled? }` |
| `csv_parse_file` | `file_path: String` | `serde_json::Value` |
| `csv_import` | `bank_id: i64`, `questions` | `ImportResult` |
| `csv_export` | `bank_id: i64` | `{ success, filePath?, count?, cancelled? }` |

### TOML (`commands/toml.rs`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `toml_select_file` | — | `Option<String>` (file path) |
| `toml_parse_file` | `file_path: String` | `serde_json::Value` |

---

## Database Schema

All tables are created and migrated by `database/schema.rs` + `database/migrations.rs`. The database file is `questpilot.db`, stored at `%APPDATA%\com.questpilot.desktop\` on Windows.

### `question_banks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT NOT NULL | Max 100 chars, trimmed |
| `description` | TEXT | Nullable |
| `created_at` | TEXT | `datetime('now')` |
| `updated_at` | TEXT | Updated on every write |

### `questions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `bank_id` | INTEGER FK | → `question_banks.id` |
| `type` | TEXT | `单选题` / `多选题` / `判断题` / `填空题` / `简答题` |
| `content` | TEXT | Question stem |
| `options` | TEXT | JSON array of `{ key, value }` objects; NULL for non-choice types |
| `answer` | TEXT | Single key, `\|`-separated keys, or free text |
| `analysis` | TEXT | Nullable explanation |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `settings`

Key-value store. Known keys:

| Key | Default | Notes |
|-----|---------|-------|
| `theme` | `system` | `light` / `dark` / `system` |
| `wrong_book_threshold` | `3` | Consecutive correct answers before auto-removal |
| `ai_api_key` | `""` | Stored in the system keychain (Windows Credential Manager); the database field holds an empty placeholder |
| `ai_api_url` | `https://api.openai.com` | Base URL, no trailing slash |
| `ai_model_id` | `gpt-3.5-turbo` | Model identifier |
| `ai_provider` | `custom` | Used by frontend for preset display |

### `wrong_book`

| Column | Type | Notes |
|--------|------|-------|
| `question_id` | INTEGER UNIQUE | Composite with `bank_id` |
| `bank_id` | INTEGER | |
| `wrong_count` | INTEGER | Incremented on each wrong answer |
| `correct_count` | INTEGER | Reset to 0 on new wrong answer |
| `added_at` | TEXT | First wrong occurrence |
| `last_wrong_at` | TEXT | Most recent wrong occurrence |

Auto-removal fires when `correct_count >= threshold` after a correct answer in `update_wrong_book_from_practice`. The entire batch update (orphan cleanup + wrong-count upsert + correct-count increment + threshold removal) runs inside a single `rusqlite::Transaction` to guarantee atomicity.

### `practice_records`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `bank_id` | INTEGER | |
| `total` | INTEGER | Questions in the session |
| `correct` | INTEGER | |
| `wrong` | INTEGER | |
| `accuracy` | REAL | 0–100 |
| `created_at` | TEXT | |

### `ai_prompts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT | Display name |
| `content` | TEXT | System prompt body |
| `is_default` | INTEGER | `1` = default, protected from deletion |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `chat_history`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `title` | TEXT | Auto-set from first user message |
| `messages` | TEXT | JSON array of `{ role, content }` |
| `prompt_id` | INTEGER | FK → `ai_prompts.id`, nullable |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `drafts`

Single-row table (`id = 1`). Stores the unsaved manual-entry form state as a JSON blob.

### `operation_logs`

Rolling log of user actions (create/update/delete bank or question, practice completed, settings changed, etc.). Used by the dashboard timeline.

---

## AI Module (`ai.rs`)

The AI module is a thin HTTP client. It supports two request formats:

### OpenAI-compatible (default)

Used for OpenAI, DeepSeek, Qwen, and any other provider that accepts `/v1/chat/completions`. The backend automatically appends `/v1/chat/completions` to the base URL if missing.

```
POST {api_url}/v1/chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json
```

### Claude (`api.anthropic.com`)

Detected by URL prefix. Uses `/v1/messages` with `anthropic-version: 2023-06-01` and `x-api-key` header.

### Gemini (`generativelanguage.googleapis.com`)

Detected by URL prefix. Maps messages to Gemini `contents` format and calls `generateContent`.

### Key Functions

| Function | Purpose |
|----------|---------|
| `test_connection` | Sends a minimal "hello" message; returns `{ success, message }` |
| `parse_questions_with_ai` | Sends content with a structured extraction system prompt; returns raw JSON |
| `chat_with_ai` | Multi-turn chat; uses a custom or default system prompt |

`AiConfig` (passed to all functions):

```rust
pub struct AiConfig {
    pub api_key: String,
    pub api_url: String,
    pub model_id: String,
}
```

---

## Error Handling

Commands return `Result<T, AppError>`. `AppError` is serialised by Tauri and forwarded to the frontend as a rejected `invoke` promise. Error messages are written in Chinese for end-user display.

Conventions:
- **Database errors** include context: `"创建题目失败: {rusqlite error}"`.
- **Validation errors** are plain messages: `"题目内容不能为空"`.
- **AI errors** include HTTP status or provider error text where available.
- Commands **never panic** — all `unwrap()` usage is in tests only.

---

## Adding a New Command

1. **Repository method** — add the SQL logic directly to the relevant `database/repositories/<domain>_repo.rs`, using `self.store.with_connection(|conn| { … })` or `with_transaction`.
2. **Service** — add business logic to `services/<domain>_service.rs`; call the repository.
3. **Command function** — add `#[tauri::command(rename_all = "camelCase")] pub fn your_command(app: AppHandle, ...) -> Result<T, AppError>` to `commands/<domain>.rs`:
   ```rust
   ServiceXxx::new(open_store(&app)?).your_method(params)
   ```
4. **Register** — add `your_command` to `tauri::generate_handler![...]` in `lib.rs`.
5. **Frontend binding** — add the corresponding `invoke` call to `src/api/index.ts`.

### Async Commands (AI calls, file dialogs)

Use `pub async fn`. Because `DatabaseStore` contains `RefCell<Connection>` which is `!Send`, **all** DB access must be complete and dropped before any `.await`:

```rust
pub async fn my_async_command(app: AppHandle, ...) -> Result<T, AppError> {
    // Phase 1: synchronous DB reads — Service drops at end of statement
    let data = MyService::new(open_store(&app)?).read_something()?;
    // Phase 2: async network call — no !Send types alive
    let result = some_async_call(data).await?;
    // Phase 3 (if needed): reopen store for DB writes
    MyService::new(open_store(&app)?).write_something(result)
}
```

---

## Testing

Tests live alongside their module using `#[cfg(test)]` blocks:

| Module | What is tested |
|--------|----------------|
| `database/migrations.rs` | Schema migration run order, idempotency, failure rollback |
| `database/validation.rs` | Input validation edge cases |
| `database/queries.rs` | SQL helper correctness (in-memory SQLite) |
| `ai.rs` | HTTP response parsing, error extraction |
| `commands/settings.rs` | `mask_api_key`, `public_api_config_from_database` |

Run all tests:

```bash
cargo test                     # all
cargo test -- --nocapture      # with println! output
cargo test database::          # only database module
```

---

## Dev Commands

```bash
cargo build          # Compile debug build (from src-tauri/)
cargo build --release  # Release build
cargo test           # Run all tests
cargo clippy         # Lint (treat warnings as errors in CI)
cargo fmt            # Format
```

For the full desktop app run `npm run tauri:dev` from the project root.
