[English](./README.md) | **中文**

# Tauri 后端源码说明

Rust + Tauri 2.x 后端，通过 `invoke` 命令向前端暴露 SQLite 持久化与 AI 网络能力。

---

## 目录结构

```
src-tauri/src/
├── lib.rs              # 入口：模块声明 + invoke_handler 注册 + run()
├── main.rs             # 二进制入口：调用 lib::run()
├── ai.rs               # AI HTTP 客户端（OpenAI 兼容接口、测试连接）
├── csv_tools.rs        # CSV 解析 / 生成 / 导出工具
├── toml_tools.rs       # TOML 批量导入解析工具
│
├── commands/           # Tauri 命令层 — 薄层包装，按域一文件一责
│   ├── mod.rs          # 共享 helper：open_store / main_window / ai_config_from_database
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
├── services/           # Service 层 — 业务逻辑，按域一文件一责
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
└── database/           # 持久化层 — rusqlite + SQLite
    ├── mod.rs          # DatabaseStore 结构体 + open / open_with_legacy_candidates / table_count
    ├── types.rs        # 所有公开数据类型（Question、QuestionBank、ApiConfig 等）
    ├── schema.rs       # DDL 建表 & 迁移引导 + ensure_default_prompt
    ├── migrations.rs   # 版本化迁移执行器
    ├── validation.rs   # 输入校验 helper
    ├── legacy.rs       # Electron → Tauri 数据库迁移逻辑
    └── repositories/   # Repository 层 — 域级数据访问对象（直接通过 with_connection/with_transaction 执行 SQL）
        ├── helpers.rs      # 共享 SQL helper 和 row mapper（add_operation_log、find_question_by_id、query_questions 等）
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

## 架构概览

```
前端 (invoke)
        │
        ▼
commands/<domain>.rs          ← Tauri #[command] 薄层，调用 open_store() → ServiceXxx::new(store)
        │
        ▼
services/<domain>_service.rs  ← 业务逻辑、校验、多步编排
        │
        ▼
database/repositories/<domain>_repo.rs  ← 数据访问对象，通过 with_connection/with_transaction 直接执行 SQL
        │
        ▼
database::DatabaseStore       ← 单连接包装器（RefCell<Connection>）
                                  提供 with_connection / with_transaction，管理连接生命周期
```

**约定**：
- 命令层和 Service 层不允许出现 SQL。
- 业务规则（校验、阈值、限制）居于 Service 层。
- Repository 通过 `with_connection` / `with_transaction` 访问数据库，不调用 DatabaseStore 领域方法。
- 所有 `DatabaseStore` / Repository / Service 实例必须在任意 `.await` 点前析构，以满足 Rust `!Send` 约束（见下方《Async 命令》）。

---

## 命令参考

所有命令在 `lib.rs` 中注册，通过前端 `src/api/index.ts` 暴露。

### 窗口（`commands/window.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `window_minimize` | — | `()` |
| `window_maximize` | — | `()`（自动切换最大化/还原） |
| `window_close` | — | `()` |
| `window_is_maximized` | — | `bool` |

### 题库（`commands/question_bank.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `question_bank_create` | `data: CreateQuestionBankInput` | `QuestionBank` |
| `question_bank_get_all` | — | `Vec<QuestionBank>` |
| `question_bank_get_by_id` | `id: i64` | `Option<QuestionBank>` |
| `question_bank_update` | `id: i64`, `data: CreateQuestionBankInput` | `Option<QuestionBank>` |
| `question_bank_delete` | `id: i64` | `()` |

### 题目（`commands/question.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `question_create` | `bank_id: i64`, `data: CreateQuestionInput` | `Question` |
| `question_create_batch` | `bank_id: i64`, `questions: Vec<CreateQuestionInput>` | `ImportResult` |
| `question_get_by_bank_id` | `bank_id`、`page?`、`page_size?`、`question_type?` | `PaginatedQuestions` |
| `question_get_random` | `bank_id`、`limit?`、`question_type?` | `Vec<Question>` |
| `question_get_by_id` | `id: i64` | `Option<Question>` |
| `question_update` | `id: i64`, `data: CreateQuestionInput` | `Option<Question>` |
| `question_delete` | `ids: Vec<i64>` | `()` |
| `question_search` | `bank_id`、`keyword`、`page?`、`page_size?`、`question_type?` | `PaginatedQuestions` |

`PaginatedQuestions` 结构：`{ data, total, page, pageSize, totalPages }`。

### 统计（`commands/stats.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `stats_get_dashboard` | — | `DashboardStats` |
| `stats_get_operation_logs` | `limit?` | `Vec<OperationLog>` |
| `stats_get_type_distribution` | `bank_id?` | `Vec<TypeDistribution>` |

### 设置与迁移（`commands/settings.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `settings_get_theme` | — | `String` |
| `settings_set_theme` | `theme: String` | `()` |
| `settings_get_wrong_book_threshold` | — | `i64` |
| `settings_set_wrong_book_threshold` | `threshold: i64` | `()` |
| `settings_get_api_config` | — | `PublicApiConfig` |
| `settings_set_api_config` | `config: ApiConfig` | `{ success: true }` |
| `settings_test_api_connection` | — | `{ success, message }` |
| `migration_get_legacy_status` | — | `LegacyDatabaseStatus` |
| `migration_backup_and_replace_from_legacy` | `legacy_path`、`confirmation` | `LegacyDatabaseReplaceResult` |

> `settings_get_api_config` 返回 `PublicApiConfig`——完整 API Key 不会暴露，仅返回 `apiKeyPreview`（脱敏）和 `hasApiKey`。

### AI（`commands/ai_cmd.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `ai_parse_questions` | `content: String` | `serde_json::Value` |
| `ai_chat` | `messages: Vec<AiMessage>`, `prompt_id?` | `serde_json::Value` |
| `ai_import_questions_direct` | `content: String`, `bank_id: i64` | `AiImportResult` |

三个命令均为 `async`，采用两阶段模式：所有数据库访问（通过 `SettingsService`、`PromptService` 等）在 `.await` 网络调用前完成并析构；如需写库则在 await 后重新打开 store。

### 草稿（`commands/draft.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `draft_save` | `data: serde_json::Value` | `{ success: true }` |
| `draft_load` | — | `Option<serde_json::Value>` |
| `draft_clear` | — | `{ success: true }` |

### Prompt 与聊天记录（`commands/prompt_chat.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `prompt_get_all` | — | `Vec<Prompt>` |
| `prompt_get_by_id` | `id: i64` | `Option<Prompt>` |
| `prompt_create` | `data: CreatePromptInput` | `Prompt` |
| `prompt_update` | `id: i64`, `data: CreatePromptInput` | `Option<Prompt>` |
| `prompt_delete` | `id: i64` | `{ success: true }` |
| `chat_history_save` | `data: ChatHistoryInput` | `ChatHistory` |
| `chat_history_update` | `id: i64`, `messages: Value` | `Option<ChatHistory>` |
| `chat_history_get_all` | `limit?` | `Vec<ChatHistory>`（不含 messages 字段） |
| `chat_history_get_by_id` | `id: i64` | `Option<ChatHistory>`（含 messages） |
| `chat_history_delete` | `id: i64` | `{ success: true }` |

### 练习（`commands/practice.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `practice_save_record` | `record: PracticeRecordInput` | `{ success: true }` |
| `practice_get_records` | `bank_id: i64`, `limit?` | `Vec<PracticeRecord>` |
| `practice_get_all_stats` | — | `Vec<PracticeStats>` |

### 错题本（`commands/wrong_book.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `wrong_book_get_counts_by_bank` | — | `Vec<WrongBookCount>` |
| `wrong_book_get_items` | `bank_id?`、`page?`、`page_size?` | `PaginatedWrongBookItems` |
| `wrong_book_get_random_questions` | `bank_id?`、`limit?` | `Vec<Question>` |
| `wrong_book_update_from_practice` | `results: Vec<WrongBookPracticeResult>`, `threshold?` | `{ success: true }` |
| `wrong_book_remove_item` | `question_id: i64` | `{ success: true }` |
| `wrong_book_clear` | `bank_id?` | `{ success: true }` |

### CSV（`commands/csv.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `csv_select_file` | — | `Option<String>`（文件路径） |
| `csv_download_template` | — | `{ success, filePath?, cancelled? }` |
| `csv_parse_file` | `file_path: String` | `serde_json::Value` |
| `csv_import` | `bank_id: i64`, `questions` | `ImportResult` |
| `csv_export` | `bank_id: i64` | `{ success, filePath?, count?, cancelled? }` |

### TOML（`commands/toml.rs`）

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `toml_select_file` | — | `Option<String>`（文件路径） |
| `toml_parse_file` | `file_path: String` | `serde_json::Value` |

---

## 数据库表结构

所有表由 `database/schema.rs` + `database/migrations.rs` 创建与迁移。数据库文件 `questpilot.db` 在 Windows 上位于 `%APPDATA%\com.questpilot.desktop\`。

### `question_banks`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK | 自增 |
| `name` | TEXT NOT NULL | 最长 100 字符，自动 trim |
| `description` | TEXT | 可为空 |
| `created_at` | TEXT | `datetime('now')` |
| `updated_at` | TEXT | 每次写操作更新 |

### `questions`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK | |
| `bank_id` | INTEGER FK | → `question_banks.id` |
| `type` | TEXT | `单选题` / `多选题` / `判断题` / `填空题` / `简答题` |
| `content` | TEXT | 题干 |
| `options` | TEXT | JSON 数组，元素为 `{ key, value }`；非选择题为 NULL |
| `answer` | TEXT | 单个选项字母、`\|` 分隔的多个字母或自由文本 |
| `analysis` | TEXT | 解析，可为空 |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `settings`

键值对存储。已知键：

| 键 | 默认值 | 说明 |
|----|--------|------|
| `theme` | `system` | `light` / `dark` / `system` |
| `wrong_book_threshold` | `3` | 连续答对次数达到阈值后自动移除错题 |
| `ai_api_key` | `""` | 存储于系统密钥管理器（Windows Credential Manager），数据库字段仅存空占位符 |
| `ai_api_url` | `https://api.openai.com` | Base URL，不含尾部斜杠 |
| `ai_model_id` | `gpt-3.5-turbo` | 模型标识符 |
| `ai_provider` | `custom` | 前端用于预设显示 |

### `wrong_book`

| 列 | 类型 | 说明 |
|----|------|------|
| `question_id` | INTEGER UNIQUE | |
| `bank_id` | INTEGER | |
| `wrong_count` | INTEGER | 每次答错加一 |
| `correct_count` | INTEGER | 新的答错时重置为 0 |
| `added_at` | TEXT | 首次答错时间 |
| `last_wrong_at` | TEXT | 最近答错时间 |

在 `update_wrong_book_from_practice` 中，`correct_count >= threshold` 时自动移除。整个批量更新（孤儿记录清理 + 错误次数更新 + 正确次数增加 + 阈值移除）在单个 `rusqlite::Transaction` 内完成，任意步骤失败则自动回滚。

### `practice_records`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK | |
| `bank_id` | INTEGER | |
| `total` | INTEGER | 本次练习题目总数 |
| `correct` | INTEGER | |
| `wrong` | INTEGER | |
| `accuracy` | REAL | 0–100 |
| `created_at` | TEXT | |

### `ai_prompts`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK | |
| `name` | TEXT | 显示名称 |
| `content` | TEXT | 系统提示词正文 |
| `is_default` | INTEGER | `1` = 默认，不可删除 |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `chat_history`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK | |
| `title` | TEXT | 自动从第一条用户消息生成 |
| `messages` | TEXT | JSON 数组，元素为 `{ role, content }` |
| `prompt_id` | INTEGER | FK → `ai_prompts.id`，可为空 |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `drafts`

单行表（`id = 1`），以 JSON blob 存储手动录入页面的未保存表单状态。

### `operation_logs`

用户操作的滚动日志（创建/更新/删除题库或题目、完成练习、修改设置等），用于仪表盘时间线展示。

---

## AI 模块（`ai.rs`）

AI 模块是一个薄层 HTTP 客户端，支持三种请求格式。

### OpenAI 兼容格式（默认）

适用于 OpenAI、DeepSeek、通义千问等支持 `/v1/chat/completions` 的提供商。后端会在 Base URL 末尾缺失路径时自动补全。

```
POST {api_url}/v1/chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json
```

### Claude（`api.anthropic.com`）

通过 URL 前缀自动识别。使用 `/v1/messages`，请求头包含 `anthropic-version: 2023-06-01` 和 `x-api-key`。

### Gemini（`generativelanguage.googleapis.com`）

通过 URL 前缀自动识别。将消息映射为 Gemini `contents` 格式，调用 `generateContent`。

### 核心函数

| 函数 | 用途 |
|------|------|
| `test_connection` | 发送最小"hello"消息验证配置；返回 `{ success, message }` |
| `parse_questions_with_ai` | 携带结构化提取系统提示发送内容；返回原始 JSON |
| `chat_with_ai` | 多轮对话；使用自定义或默认系统提示 |

传入所有函数的 `AiConfig`：

```rust
pub struct AiConfig {
    pub api_key: String,
    pub api_url: String,
    pub model_id: String,
}
```

---

## 错误处理

命令返回 `Result<T, AppError>`。`AppError` 由 Tauri 序列化后转发给前端，作为 `invoke` Promise 的 reject 值。错误信息以中文编写，面向最终用户。

约定：
- **数据库错误**带上下文：`"创建题目失败: {rusqlite 错误}"`。
- **校验错误**为纯消息：`"题目内容不能为空"`。
- **AI 错误**在条件允许时包含 HTTP 状态码或提供商错误文本。
- 命令层**绝不 panic**——`unwrap()` 仅在测试中使用。

---

## 新增命令流程

1. **Repository 方法**——在 `database/repositories/<domain>_repo.rs` 中直接写 SQL，使用 `self.store.with_connection(|conn| { … })` 或 `with_transaction`。
2. **Service**——在 `services/<domain>_service.rs` 中添加业务逻辑，调用 Repository。
3. **命令函数**——在 `commands/<domain>.rs` 中添加命令，调用如下：
   ```rust
   ServiceXxx::new(open_store(&app)?).your_method(params)
   ```
4. **注册**——在 `lib.rs` 的 `tauri::generate_handler![...]` 中添加 `your_command`。
5. **前端绑定**——在 `src/api/index.ts` 中添加对应的 `invoke` 调用。

### Async 命令（AI 调用、文件对话框）

使用 `pub async fn`。因 `DatabaseStore` 内含 `RefCell<Connection>`（`!Send`），所有数据库访问必须在 `.await` 前完成并析构：

```rust
pub async fn my_async_command(app: AppHandle, ...) -> Result<T, AppError> {
    // 阶段1：同步读取数据——Service 在语句末析构
    let data = MyService::new(open_store(&app)?).read_something()?;
    // 阶段2：await 网络调用——无 !Send 类型存活
    let result = some_async_call(data).await?;
    // 阶段3（如需）：重新打开 store 写库
    MyService::new(open_store(&app)?).write_something(result)
}
```

---

## 测试

测试通过 `#[cfg(test)]` 块与模块并置：

| 模块 | 测试内容 |
|------|---------|
| `database/migrations.rs` | 迁移执行顺序、幂等性、失败回滚 |
| `database/validation.rs` | 输入校验边界情况 |
| `database/queries.rs` | SQL helper 正确性（内存 SQLite） |
| `ai.rs` | HTTP 响应解析、错误提取 |
| `commands/settings.rs` | `mask_api_key`、`public_api_config_from_database` |

运行测试：

```bash
cargo test                     # 全部
cargo test -- --nocapture      # 显示 println! 输出
cargo test database::          # 仅数据库模块
```

---

## 开发命令

```bash
cargo build            # 编译 debug 版本（在 src-tauri/ 目录下运行）
cargo build --release  # 编译 release 版本
cargo test             # 运行全部测试
cargo clippy           # Lint 检查（CI 中视警告为错误）
cargo fmt              # 代码格式化
```

完整桌面应用开发请在项目根目录运行 `npm run tauri:dev`。
