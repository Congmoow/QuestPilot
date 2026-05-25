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
│
├── commands/           # Tauri 命令层 — 按域一文件一责
│   ├── mod.rs          # 共享 helper：open_store / main_window / ai_config_from_database
│   ├── window.rs       # window_minimize / maximize / close / is_maximized
│   ├── question_bank.rs  # question_bank_create / get_all / get_by_id / update / delete
│   ├── question.rs     # question_create / batch / get / search / update / delete + PaginatedQuestions
│   ├── stats.rs        # stats_get_dashboard / operation_logs / type_distribution
│   ├── settings.rs     # settings_* / migration_* + PublicApiConfig / mask_api_key
│   ├── ai_cmd.rs       # ai_parse_questions / ai_chat
│   ├── draft.rs        # draft_save / load / clear
│   ├── prompt_chat.rs  # prompt_* / chat_history_*
│   ├── practice.rs     # practice_save_record / get_records / get_all_stats
│   ├── wrong_book.rs   # wrong_book_* + PaginatedWrongBookItems
│   └── csv.rs          # csv_select_file / download_template / parse / import / export
│
└── database/           # 持久化层 — rusqlite + SQLite
    ├── mod.rs          # DatabaseStore 结构体 + open / open_with_legacy_candidates / table_count
    ├── types.rs        # 所有公开数据类型（Question、QuestionBank、ApiConfig 等）
    ├── schema.rs       # DDL 建表 & 迁移引导 + ensure_default_prompt
    ├── migrations.rs   # 版本化迁移执行器
    ├── queries.rs      # 底层 SQL helper（跨 repository 模块共享）
    ├── validation.rs   # 输入校验 helper
    ├── legacy.rs       # Electron → Tauri 数据库迁移逻辑
    ├── question_bank.rs  # impl DatabaseStore { create_bank … delete_bank }
    ├── question.rs     # impl DatabaseStore { create_question … count_questions }
    ├── settings.rs     # impl DatabaseStore { get_theme … clear_draft }
    ├── ai.rs           # impl DatabaseStore { get_all_prompts … delete_chat_history }
    ├── practice.rs     # impl DatabaseStore { save_practice_record … get_all_practice_stats }
    ├── wrong_book.rs   # impl DatabaseStore { get_wrong_book_counts … clear_wrong_book }
    └── stats.rs        # impl DatabaseStore { get_question_count_by_type … get_operation_logs }
```

---

## 架构概览

```
前端 (invoke)
      │
      ▼
commands/<domain>.rs   ← Tauri #[command] 函数（薄层，调用 open_store()）
      │
      ▼
database::DatabaseStore ← 单连接包装器（RefCell<Connection>）
      │
      ├── database/<domain>.rs  ← impl DatabaseStore { 域方法 }
      │
      └── database/queries.rs   ← 共享 SQL helper（map_*、find_*、count_*）
```

**约定**：命令层调用 `open_store()` → `DatabaseStore` 方法 → `queries.rs` helper。命令文件中不允许出现 SQL。

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

两个命令均为 `async`，调用时从数据库读取 API 配置。

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
| `ai_api_key` | `""` | 以明文存储于本地 |
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

在 `update_wrong_book_from_practice` 中，`correct_count >= threshold` 时自动移除。

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

所有公开数据库方法和命令均返回 `Result<T, String>`。`String` 错误会直接转发给前端，作为 `invoke` Promise 的 reject 值。错误信息以中文编写，面向最终用户。

约定：
- **数据库错误**带上下文：`"创建题目失败: {rusqlite 错误}"`。
- **校验错误**为纯消息：`"题目内容不能为空"`。
- **AI 错误**在条件允许时包含 HTTP 状态码或提供商错误文本。
- 命令层**绝不 panic**——`unwrap()` 仅在测试中使用。

---

## 新增命令流程

1. **数据库方法**——在对应 `database/<domain>.rs` 中以 `impl DatabaseStore { ... }` 添加 `pub fn your_method(...)`。
2. **命令函数**——在 `commands/<domain>.rs` 中添加 `#[tauri::command(rename_all = "camelCase")] pub fn your_command(app: AppHandle, ...) -> Result<T, String>`，调用 `open_store(&app)?`。
3. **注册**——在 `lib.rs` 的 `tauri::generate_handler![...]` 中添加 `your_command`。
4. **前端绑定**——在 `src/api/index.ts` 中添加对应的 `invoke` 调用。

对于 `async` 命令（AI 调用、文件对话框）：使用 `pub async fn`，根据需要接收 `AppHandle` / `WebviewWindow` 参数。

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
