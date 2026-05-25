use std::cell::RefCell;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};

mod legacy;
mod migrations;
mod queries;
mod schema;
mod types;
mod validation;

pub use legacy::{
    legacy_database_candidates, legacy_database_status, replace_target_with_legacy_candidate,
    LegacyDatabaseCandidate, LegacyDatabaseReplaceResult, LegacyDatabaseStatus,
};
pub use types::{
    ApiConfig, ChatHistory, ChatHistoryInput, CreatePromptInput, CreateQuestionBankInput,
    CreateQuestionInput, DashboardStats, ImportError, ImportResult, OperationLog, PracticeRecord,
    PracticeRecordInput, PracticeStats, Prompt, Question, QuestionBank, TypeDistribution,
    WrongBookCount, WrongBookItem, WrongBookPracticeResult,
};

use legacy::migrate_legacy_database;
use queries::{
    add_operation_log, bank_exists, cleanup_wrong_book_orphans, count_all_questions,
    count_questions, count_recent_questions, count_wrong_book_items, find_chat_history_by_id,
    find_prompt_by_id, find_question_by_id, get_bank_by_id, get_question_count_by_type,
    get_setting, map_chat_history, map_operation_log, map_practice_record, map_practice_stats,
    map_prompt, map_question, map_question_bank, query_questions, query_random_wrong_questions,
    query_wrong_book_items, select_question_bank_ids, set_setting, validate_practice_record,
};
use schema::{ensure_default_prompt, initialize_database_schema};
use validation::{
    default_if_blank, normalize_description, options_to_json, validate_bank_name,
    validate_messages, validate_non_blank, validate_question,
};

pub const DATABASE_FILE_NAME: &str = "questpilot.db";

pub struct DatabaseStore {
    connection: RefCell<Connection>,
}

impl DatabaseStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        open_database_at(path.as_ref())
    }

    pub fn open_with_legacy_candidates(
        target_path: impl AsRef<Path>,
        legacy_candidates: &[PathBuf],
    ) -> Result<Self, String> {
        let target_path = target_path.as_ref();
        migrate_legacy_database(target_path, legacy_candidates)?;
        open_database_at(target_path)
    }

    pub fn table_count(&self, table_names: &[&str]) -> Result<usize, String> {
        let connection = self.connection.borrow();
        let mut count = 0;

        for table_name in table_names {
            let exists = connection
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
                    params![table_name],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|error| format!("检查数据表失败: {error}"))?;
            if exists == 1 {
                count += 1;
            }
        }

        Ok(count)
    }

    pub fn create_bank(&self, data: CreateQuestionBankInput) -> Result<QuestionBank, String> {
        let connection = self.connection.borrow();
        let name = validate_bank_name(&data.name)?;
        let description = normalize_description(data.description);

        connection
            .execute(
                "
                INSERT INTO question_banks (name, description, created_at, updated_at)
                VALUES (?1, ?2, datetime('now'), datetime('now'))
                ",
                params![name.as_str(), description.as_deref()],
            )
            .map_err(|error| format!("创建题库失败: {error}"))?;

        let id = connection.last_insert_rowid();
        add_operation_log(&connection, "创建题库", format!("创建题库: {name}"))?;

        get_bank_by_id(&connection, id)?.ok_or_else(|| "创建题库后读取失败".to_string())
    }

    pub fn get_all_banks(&self) -> Result<Vec<QuestionBank>, String> {
        let connection = self.connection.borrow();
        let mut statement = connection
            .prepare(
                "
                SELECT qb.id, qb.name, qb.description, qb.created_at, qb.updated_at, COUNT(q.id) AS question_count
                FROM question_banks qb
                LEFT JOIN questions q ON qb.id = q.bank_id
                GROUP BY qb.id
                ORDER BY qb.updated_at DESC
                ",
            )
            .map_err(|error| format!("准备题库查询失败: {error}"))?;

        let rows = statement
            .query_map([], map_question_bank)
            .map_err(|error| format!("查询题库失败: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取题库结果失败: {error}"))
    }

    pub fn get_bank_by_id(&self, id: i64) -> Result<Option<QuestionBank>, String> {
        let connection = self.connection.borrow();
        get_bank_by_id(&connection, id)
    }

    pub fn update_bank(
        &self,
        id: i64,
        data: CreateQuestionBankInput,
    ) -> Result<Option<QuestionBank>, String> {
        let connection = self.connection.borrow();
        let name = validate_bank_name(&data.name)?;
        let description = normalize_description(data.description);

        connection
            .execute(
                "
                UPDATE question_banks
                SET name = ?1, description = ?2, updated_at = datetime('now')
                WHERE id = ?3
                ",
                params![name.as_str(), description.as_deref(), id],
            )
            .map_err(|error| format!("更新题库失败: {error}"))?;

        add_operation_log(&connection, "更新题库", format!("更新题库: {name}"))?;
        get_bank_by_id(&connection, id)
    }

    pub fn delete_bank(&self, id: i64) -> Result<(), String> {
        let mut connection = self.connection.borrow_mut();
        let tx = connection
            .transaction()
            .map_err(|error| format!("开启删除题库事务失败: {error}"))?;

        tx.execute("DELETE FROM questions WHERE bank_id = ?1", params![id])
            .map_err(|error| format!("删除题库题目失败: {error}"))?;
        tx.execute("DELETE FROM question_banks WHERE id = ?1", params![id])
            .map_err(|error| format!("删除题库失败: {error}"))?;
        tx.commit()
            .map_err(|error| format!("提交删除题库事务失败: {error}"))?;

        add_operation_log(&connection, "删除题库", format!("删除题库 ID: {id}"))?;
        Ok(())
    }

    pub fn create_question(
        &self,
        bank_id: i64,
        question: CreateQuestionInput,
    ) -> Result<Question, String> {
        if bank_id <= 0 {
            return Err("题库不存在".to_string());
        }

        validate_question(&question)?;

        let connection = self.connection.borrow();
        if !bank_exists(&connection, bank_id)? {
            return Err("题库不存在".to_string());
        }

        connection
            .execute(
                "
                INSERT INTO questions (bank_id, type, content, options, answer, analysis, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))
                ",
                params![
                    bank_id,
                    question.r#type.as_str(),
                    question.content.as_str(),
                    options_to_json(&question.options)?,
                    question.answer.as_str(),
                    question.analysis.as_deref(),
                ],
            )
            .map_err(|error| format!("创建题目失败: {error}"))?;

        let id = connection.last_insert_rowid();
        connection
            .execute(
                "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                params![bank_id],
            )
            .map_err(|error| format!("更新题库时间失败: {error}"))?;
        add_operation_log(&connection, "添加题目", "添加题目到题库")?;

        find_question_by_id(&connection, id)?.ok_or_else(|| "创建题目后读取失败".to_string())
    }

    pub fn create_questions_batch(
        &self,
        bank_id: i64,
        questions: Vec<CreateQuestionInput>,
    ) -> Result<ImportResult, String> {
        if bank_id <= 0 {
            return Err("题库不存在".to_string());
        }

        if questions.is_empty() {
            return Err("没有可导入的题目".to_string());
        }

        let mut connection = self.connection.borrow_mut();
        if !bank_exists(&connection, bank_id)? {
            return Err("题库不存在".to_string());
        }

        let mut errors = Vec::new();
        let mut valid_questions = Vec::new();
        for (index, question) in questions.into_iter().enumerate() {
            match validate_question(&question) {
                Ok(()) => valid_questions.push(question),
                Err(message) => errors.push(ImportError { index, message }),
            }
        }

        if valid_questions.is_empty() {
            return Ok(ImportResult {
                success: 0,
                failed: errors.len(),
                errors,
            });
        }

        let tx = connection
            .transaction()
            .map_err(|error| format!("开启批量导入事务失败: {error}"))?;

        {
            let mut statement = tx
                .prepare(
                    "
                    INSERT INTO questions (bank_id, type, content, options, answer, analysis, created_at, updated_at)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))
                    ",
                )
                .map_err(|error| format!("准备题目写入失败: {error}"))?;

            for question in &valid_questions {
                statement
                    .execute(params![
                        bank_id,
                        question.r#type.as_str(),
                        question.content.as_str(),
                        options_to_json(&question.options)?,
                        question.answer.as_str(),
                        question.analysis.as_deref(),
                    ])
                    .map_err(|error| format!("写入题目失败: {error}"))?;
            }
        }

        tx.execute(
            "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
            params![bank_id],
        )
        .map_err(|error| format!("更新题库时间失败: {error}"))?;
        tx.commit()
            .map_err(|error| format!("提交批量导入事务失败: {error}"))?;

        add_operation_log(
            &connection,
            "批量添加题目",
            format!("添加 {} 道题目到题库", valid_questions.len()),
        )?;

        Ok(ImportResult {
            success: valid_questions.len(),
            failed: errors.len(),
            errors,
        })
    }

    pub fn get_random_questions(
        &self,
        bank_id: i64,
        limit: Option<u32>,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, String> {
        if bank_id <= 0 {
            return Ok(Vec::new());
        }

        let safe_limit = i64::from(limit.unwrap_or(20).clamp(1, 1000));
        let connection = self.connection.borrow();
        let mut questions = Vec::new();

        if let Some(question_type) = question_type.filter(|value| !value.trim().is_empty()) {
            let mut statement = connection
                .prepare(
                    "
                    SELECT id, bank_id, type, content, options, answer, analysis, created_at, updated_at
                    FROM questions
                    WHERE bank_id = ?1 AND type = ?2
                    ORDER BY RANDOM()
                    LIMIT ?3
                    ",
                )
                .map_err(|error| format!("准备随机抽题查询失败: {error}"))?;

            let rows = statement
                .query_map(params![bank_id, question_type, safe_limit], map_question)
                .map_err(|error| format!("随机抽题失败: {error}"))?;

            for row in rows {
                questions.push(row.map_err(|error| format!("读取随机题目失败: {error}"))?);
            }
        } else {
            let mut statement = connection
                .prepare(
                    "
                    SELECT id, bank_id, type, content, options, answer, analysis, created_at, updated_at
                    FROM questions
                    WHERE bank_id = ?1
                    ORDER BY RANDOM()
                    LIMIT ?2
                    ",
                )
                .map_err(|error| format!("准备随机抽题查询失败: {error}"))?;

            let rows = statement
                .query_map(params![bank_id, safe_limit], map_question)
                .map_err(|error| format!("随机抽题失败: {error}"))?;

            for row in rows {
                questions.push(row.map_err(|error| format!("读取随机题目失败: {error}"))?);
            }
        }

        Ok(questions)
    }

    pub fn get_questions_by_bank_id(
        &self,
        bank_id: i64,
        offset: u32,
        limit: u32,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, String> {
        let connection = self.connection.borrow();
        query_questions(
            &connection,
            bank_id,
            "",
            question_type.as_deref(),
            offset,
            limit,
        )
    }

    pub fn get_question_by_id(&self, id: i64) -> Result<Option<Question>, String> {
        let connection = self.connection.borrow();
        find_question_by_id(&connection, id)
    }

    pub fn update_question(
        &self,
        id: i64,
        question: CreateQuestionInput,
    ) -> Result<Option<Question>, String> {
        validate_question(&question)?;

        let connection = self.connection.borrow();
        let existing = find_question_by_id(&connection, id)?;
        if existing.is_none() {
            return Ok(None);
        }

        connection
            .execute(
                "
                UPDATE questions
                SET type = ?1, content = ?2, options = ?3, answer = ?4, analysis = ?5, updated_at = datetime('now')
                WHERE id = ?6
                ",
                params![
                    question.r#type.as_str(),
                    question.content.as_str(),
                    options_to_json(&question.options)?,
                    question.answer.as_str(),
                    question.analysis.as_deref(),
                    id,
                ],
            )
            .map_err(|error| format!("更新题目失败: {error}"))?;

        if let Some(existing) = existing {
            connection
                .execute(
                    "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                    params![existing.bank_id],
                )
                .map_err(|error| format!("更新题库时间失败: {error}"))?;
        }
        add_operation_log(&connection, "更新题目", "更新题目")?;

        find_question_by_id(&connection, id)
    }

    pub fn delete_questions(&self, ids: &[i64]) -> Result<(), String> {
        if ids.is_empty() {
            return Ok(());
        }

        let mut connection = self.connection.borrow_mut();
        let tx = connection
            .transaction()
            .map_err(|error| format!("开启删除题目事务失败: {error}"))?;

        let bank_ids = select_question_bank_ids(&tx, ids)?;
        for id in ids {
            tx.execute("DELETE FROM questions WHERE id = ?1", params![id])
                .map_err(|error| format!("删除题目失败: {error}"))?;
        }

        for bank_id in bank_ids {
            tx.execute(
                "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                params![bank_id],
            )
            .map_err(|error| format!("更新题库时间失败: {error}"))?;
        }

        tx.commit()
            .map_err(|error| format!("提交删除题目事务失败: {error}"))?;
        add_operation_log(
            &connection,
            "删除题目",
            format!("删除 {} 道题目", ids.len()),
        )?;
        Ok(())
    }

    pub fn search_questions(
        &self,
        bank_id: i64,
        keyword: String,
        question_type: Option<String>,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Question>, String> {
        let connection = self.connection.borrow();
        query_questions(
            &connection,
            bank_id,
            keyword.as_str(),
            question_type.as_deref(),
            offset,
            limit,
        )
    }

    pub fn count_questions(
        &self,
        bank_id: i64,
        keyword: String,
        question_type: Option<String>,
    ) -> Result<i64, String> {
        let connection = self.connection.borrow();
        count_questions(
            &connection,
            bank_id,
            keyword.as_str(),
            question_type.as_deref(),
        )
    }

    pub fn get_theme(&self) -> Result<String, String> {
        let connection = self.connection.borrow();
        let theme = connection
            .query_row(
                "SELECT value FROM settings WHERE key = 'theme'",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("读取主题设置失败: {error}"))?;

        if matches!(theme.as_deref(), Some("light" | "dark" | "system")) {
            Ok(theme.unwrap())
        } else {
            Ok("system".to_string())
        }
    }

    pub fn set_theme(&self, theme: String) -> Result<(), String> {
        if !matches!(theme.as_str(), "light" | "dark" | "system") {
            return Err("无效的主题设置".to_string());
        }

        let connection = self.connection.borrow();
        connection
            .execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?1)",
                params![theme.as_str()],
            )
            .map_err(|error| format!("保存主题设置失败: {error}"))?;
        Ok(())
    }

    pub fn get_wrong_book_threshold(&self) -> Result<i64, String> {
        let connection = self.connection.borrow();
        get_setting(&connection, "wrong_book_threshold")?
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0)
            .map_or(Ok(3), Ok)
    }

    pub fn set_wrong_book_threshold(&self, threshold: i64) -> Result<(), String> {
        let safe_threshold = if threshold > 0 { threshold } else { 3 };
        let connection = self.connection.borrow();
        set_setting(
            &connection,
            "wrong_book_threshold",
            safe_threshold.to_string().as_str(),
        )?;
        add_operation_log(
            &connection,
            "更改设置",
            format!("错题移除阈值设置为 {safe_threshold}"),
        )
    }

    pub fn save_draft(&self, data: serde_json::Value) -> Result<(), String> {
        if !data.is_object() {
            return Err("草稿数据无效".to_string());
        }

        let connection = self.connection.borrow();
        connection
            .execute(
                "
                INSERT OR REPLACE INTO drafts (id, data, saved_at)
                VALUES (1, ?1, datetime('now'))
                ",
                params![data.to_string()],
            )
            .map_err(|error| format!("保存草稿失败: {error}"))?;
        Ok(())
    }

    pub fn load_draft(&self) -> Result<Option<serde_json::Value>, String> {
        let connection = self.connection.borrow();
        let row = connection
            .query_row(
                "SELECT data, saved_at FROM drafts WHERE id = 1",
                [],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|error| format!("读取草稿失败: {error}"))?;

        let Some((data, saved_at)) = row else {
            return Ok(None);
        };

        let mut value = serde_json::from_str::<serde_json::Value>(&data)
            .map_err(|error| format!("解析草稿失败: {error}"))?;
        if let Some(object) = value.as_object_mut() {
            object.insert("savedAt".to_string(), serde_json::Value::String(saved_at));
        }
        Ok(Some(value))
    }

    pub fn clear_draft(&self) -> Result<(), String> {
        let connection = self.connection.borrow();
        connection
            .execute("DELETE FROM drafts WHERE id = 1", [])
            .map_err(|error| format!("清除草稿失败: {error}"))?;
        Ok(())
    }

    pub fn get_api_config(&self) -> Result<ApiConfig, String> {
        let connection = self.connection.borrow();
        Ok(ApiConfig {
            api_key: get_setting(&connection, "ai_api_key")?.unwrap_or_default(),
            api_url: get_setting(&connection, "ai_api_url")?
                .unwrap_or_else(|| "https://api.openai.com".to_string()),
            model_id: get_setting(&connection, "ai_model_id")?
                .unwrap_or_else(|| "gpt-3.5-turbo".to_string()),
            provider: get_setting(&connection, "ai_provider")?
                .unwrap_or_else(|| "custom".to_string()),
        })
    }

    pub fn set_api_config(&self, config: ApiConfig) -> Result<(), String> {
        let connection = self.connection.borrow();
        let next_api_key = if config.api_key.trim().is_empty() {
            get_setting(&connection, "ai_api_key")?.unwrap_or_default()
        } else {
            config.api_key.trim().to_string()
        };
        set_setting(&connection, "ai_api_key", next_api_key.as_str())?;
        set_setting(
            &connection,
            "ai_api_url",
            default_if_blank(config.api_url.as_str(), "https://api.openai.com").as_str(),
        )?;
        set_setting(
            &connection,
            "ai_model_id",
            default_if_blank(config.model_id.as_str(), "gpt-3.5-turbo").as_str(),
        )?;
        set_setting(
            &connection,
            "ai_provider",
            default_if_blank(config.provider.as_str(), "custom").as_str(),
        )?;
        add_operation_log(&connection, "更改设置", "更新 AI API 配置")
    }

    pub fn get_all_prompts(&self) -> Result<Vec<Prompt>, String> {
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        let mut statement = connection
            .prepare(
                "
                SELECT id, name, content, is_default, created_at, updated_at
                FROM ai_prompts
                ORDER BY is_default DESC, created_at DESC, id DESC
                ",
            )
            .map_err(|error| format!("准备 Prompt 列表查询失败: {error}"))?;
        let rows = statement
            .query_map([], map_prompt)
            .map_err(|error| format!("查询 Prompt 列表失败: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取 Prompt 列表失败: {error}"))
    }

    pub fn get_prompt_by_id(&self, id: i64) -> Result<Option<Prompt>, String> {
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        connection
            .query_row(
                "
                SELECT id, name, content, is_default, created_at, updated_at
                FROM ai_prompts
                WHERE id = ?1
                ",
                params![id],
                map_prompt,
            )
            .optional()
            .map_err(|error| format!("读取 Prompt 失败: {error}"))
    }

    pub fn create_prompt(&self, data: CreatePromptInput) -> Result<Prompt, String> {
        let name = validate_non_blank(data.name.as_str(), "名称不能为空")?;
        let content = validate_non_blank(data.content.as_str(), "内容不能为空")?;
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        connection
            .execute(
                "
                INSERT INTO ai_prompts (name, content, is_default, created_at, updated_at)
                VALUES (?1, ?2, 0, datetime('now'), datetime('now'))
                ",
                params![name.as_str(), content.as_str()],
            )
            .map_err(|error| format!("创建 Prompt 失败: {error}"))?;
        let id = connection.last_insert_rowid();
        add_operation_log(&connection, "创建 Prompt", format!("创建 Prompt: {name}"))?;
        find_prompt_by_id(&connection, id)?.ok_or_else(|| "Prompt 创建后不存在".to_string())
    }

    pub fn update_prompt(
        &self,
        id: i64,
        data: CreatePromptInput,
    ) -> Result<Option<Prompt>, String> {
        let name = validate_non_blank(data.name.as_str(), "名称不能为空")?;
        let content = validate_non_blank(data.content.as_str(), "内容不能为空")?;
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        connection
            .execute(
                "
                UPDATE ai_prompts
                SET name = ?1, content = ?2, updated_at = datetime('now')
                WHERE id = ?3
                ",
                params![name.as_str(), content.as_str(), id],
            )
            .map_err(|error| format!("更新 Prompt 失败: {error}"))?;
        add_operation_log(&connection, "更新 Prompt", format!("更新 Prompt: {name}"))?;
        find_prompt_by_id(&connection, id)
    }

    pub fn delete_prompt(&self, id: i64) -> Result<(), String> {
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        let Some(prompt) = find_prompt_by_id(&connection, id)? else {
            return Ok(());
        };
        if prompt.is_default {
            return Err("不能删除默认 Prompt".to_string());
        }

        connection
            .execute("DELETE FROM ai_prompts WHERE id = ?1", params![id])
            .map_err(|error| format!("删除 Prompt 失败: {error}"))?;
        add_operation_log(&connection, "删除 Prompt", format!("删除 Prompt ID: {id}"))
    }

    pub fn save_chat_history(&self, data: ChatHistoryInput) -> Result<ChatHistory, String> {
        validate_messages(&data.messages)?;
        let title = data
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("新对话")
            .to_string();
        let connection = self.connection.borrow();
        connection
            .execute(
                "
                INSERT INTO chat_history (title, messages, prompt_id, created_at, updated_at)
                VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))
                ",
                params![title.as_str(), data.messages.to_string(), data.prompt_id],
            )
            .map_err(|error| format!("保存聊天记录失败: {error}"))?;
        let id = connection.last_insert_rowid();
        find_chat_history_by_id(&connection, id, true)?
            .ok_or_else(|| "聊天记录保存后不存在".to_string())
    }

    pub fn update_chat_history(
        &self,
        id: i64,
        messages: serde_json::Value,
    ) -> Result<Option<ChatHistory>, String> {
        validate_messages(&messages)?;
        let connection = self.connection.borrow();
        connection
            .execute(
                "
                UPDATE chat_history
                SET messages = ?1, updated_at = datetime('now')
                WHERE id = ?2
                ",
                params![messages.to_string(), id],
            )
            .map_err(|error| format!("更新聊天记录失败: {error}"))?;
        find_chat_history_by_id(&connection, id, true)
    }

    pub fn get_all_chat_history(&self, limit: Option<u32>) -> Result<Vec<ChatHistory>, String> {
        let safe_limit = i64::from(limit.unwrap_or(50).clamp(1, 1000));
        let connection = self.connection.borrow();
        let mut statement = connection
            .prepare(
                "
                SELECT id, title, NULL AS messages, prompt_id, created_at, updated_at
                FROM chat_history
                ORDER BY updated_at DESC, id DESC
                LIMIT ?1
                ",
            )
            .map_err(|error| format!("准备聊天记录列表查询失败: {error}"))?;
        let rows = statement
            .query_map(params![safe_limit], map_chat_history)
            .map_err(|error| format!("查询聊天记录列表失败: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取聊天记录列表失败: {error}"))
    }

    pub fn get_chat_history_by_id(&self, id: i64) -> Result<Option<ChatHistory>, String> {
        let connection = self.connection.borrow();
        find_chat_history_by_id(&connection, id, true)
    }

    pub fn delete_chat_history(&self, id: i64) -> Result<(), String> {
        let connection = self.connection.borrow();
        connection
            .execute("DELETE FROM chat_history WHERE id = ?1", params![id])
            .map_err(|error| format!("删除聊天记录失败: {error}"))?;
        Ok(())
    }

    pub fn save_practice_record(&self, record: PracticeRecordInput) -> Result<(), String> {
        validate_practice_record(&record)?;
        let connection = self.connection.borrow();
        if !bank_exists(&connection, record.bank_id)? {
            return Err("题库不存在".to_string());
        }

        connection
            .execute(
                "
                INSERT INTO practice_records (bank_id, total, correct, wrong, accuracy, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
                ",
                params![
                    record.bank_id,
                    record.total,
                    record.correct,
                    record.wrong,
                    record.accuracy,
                ],
            )
            .map_err(|error| format!("保存练习记录失败: {error}"))?;
        add_operation_log(
            &connection,
            "完成练习",
            format!("正确率: {}%", record.accuracy),
        )
    }

    pub fn get_practice_records(
        &self,
        bank_id: i64,
        limit: Option<u32>,
    ) -> Result<Vec<PracticeRecord>, String> {
        let safe_limit = i64::from(limit.unwrap_or(20).clamp(1, 1000));
        let connection = self.connection.borrow();
        let mut statement = connection
            .prepare(
                "
                SELECT id, bank_id, total, correct, wrong, accuracy, created_at
                FROM practice_records
                WHERE bank_id = ?1
                ORDER BY created_at DESC
                LIMIT ?2
                ",
            )
            .map_err(|error| format!("准备练习记录查询失败: {error}"))?;
        let rows = statement
            .query_map(params![bank_id, safe_limit], map_practice_record)
            .map_err(|error| format!("查询练习记录失败: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取练习记录失败: {error}"))
    }

    pub fn get_all_practice_stats(&self) -> Result<Vec<PracticeStats>, String> {
        let connection = self.connection.borrow();
        let mut statement = connection
            .prepare(
                "
                SELECT
                  pr.bank_id,
                  qb.name AS bank_name,
                  COUNT(*) AS practice_count,
                  ROUND(AVG(pr.accuracy)) AS avg_accuracy,
                  MAX(pr.created_at) AS last_practice
                FROM practice_records pr
                JOIN question_banks qb ON pr.bank_id = qb.id
                GROUP BY pr.bank_id
                ORDER BY last_practice DESC
                ",
            )
            .map_err(|error| format!("准备练习统计查询失败: {error}"))?;
        let rows = statement
            .query_map([], map_practice_stats)
            .map_err(|error| format!("查询练习统计失败: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取练习统计失败: {error}"))
    }

    pub fn get_question_count_by_type(
        &self,
        bank_id: Option<i64>,
    ) -> Result<Vec<TypeDistribution>, String> {
        let connection = self.connection.borrow();
        get_question_count_by_type(&connection, bank_id)
    }

    pub fn get_dashboard_stats(&self) -> Result<DashboardStats, String> {
        let connection = self.connection.borrow();
        let total_questions = count_all_questions(&connection)?;
        let today_questions = count_recent_questions(&connection, 1)?;
        let week_questions = count_recent_questions(&connection, 7)?;
        let type_distribution = get_question_count_by_type(&connection, None)?;

        Ok(DashboardStats {
            total_questions,
            today_questions,
            week_questions,
            type_distribution,
        })
    }

    pub fn get_operation_logs(&self, limit: Option<u32>) -> Result<Vec<OperationLog>, String> {
        let safe_limit = i64::from(limit.unwrap_or(10).clamp(1, 1000));
        let connection = self.connection.borrow();
        let mut statement = connection
            .prepare(
                "
                SELECT id, action, detail, created_at
                FROM operation_logs
                ORDER BY created_at DESC, id DESC
                LIMIT ?1
                ",
            )
            .map_err(|error| format!("准备操作日志查询失败: {error}"))?;
        let rows = statement
            .query_map(params![safe_limit], map_operation_log)
            .map_err(|error| format!("查询操作日志失败: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取操作日志失败: {error}"))
    }

    pub fn get_wrong_book_counts_by_bank(&self) -> Result<Vec<WrongBookCount>, String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;
        let mut statement = connection
            .prepare(
                "
                SELECT bank_id, COUNT(*) AS count
                FROM wrong_book
                GROUP BY bank_id
                ",
            )
            .map_err(|error| format!("准备错题统计查询失败: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok(WrongBookCount {
                    bank_id: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|error| format!("查询错题统计失败: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取错题统计失败: {error}"))
    }

    pub fn count_wrong_book_items(&self, bank_id: Option<i64>) -> Result<i64, String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;
        count_wrong_book_items(&connection, bank_id)
    }

    pub fn get_wrong_book_items(
        &self,
        bank_id: Option<i64>,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<WrongBookItem>, String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;
        query_wrong_book_items(&connection, bank_id, offset, limit)
    }

    pub fn get_random_wrong_questions(
        &self,
        bank_id: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<Question>, String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;
        query_random_wrong_questions(&connection, bank_id, limit)
    }

    pub fn update_wrong_book_from_practice(
        &self,
        results: Vec<WrongBookPracticeResult>,
        threshold: Option<i64>,
    ) -> Result<(), String> {
        let remove_threshold = threshold
            .filter(|value| *value > 0)
            .or(self.get_wrong_book_threshold().ok())
            .unwrap_or(3);
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;

        for result in results {
            if result.question_id <= 0 || result.bank_id <= 0 {
                continue;
            }

            if result.is_correct {
                connection
                    .execute(
                        "
                        UPDATE wrong_book
                        SET correct_count = correct_count + 1
                        WHERE question_id = ?1
                        ",
                        params![result.question_id],
                    )
                    .map_err(|error| format!("更新错题正确次数失败: {error}"))?;

                let correct_count = connection
                    .query_row(
                        "SELECT correct_count FROM wrong_book WHERE question_id = ?1",
                        params![result.question_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .optional()
                    .map_err(|error| format!("读取错题正确次数失败: {error}"))?;

                if matches!(correct_count, Some(value) if value >= remove_threshold) {
                    connection
                        .execute(
                            "DELETE FROM wrong_book WHERE question_id = ?1",
                            params![result.question_id],
                        )
                        .map_err(|error| format!("移除已掌握错题失败: {error}"))?;
                }
                continue;
            }

            connection
                .execute(
                    "
                    INSERT INTO wrong_book (question_id, bank_id, wrong_count, correct_count, added_at, last_wrong_at)
                    VALUES (?1, ?2, 1, 0, datetime('now'), datetime('now'))
                    ON CONFLICT(question_id) DO UPDATE SET
                      bank_id = excluded.bank_id,
                      wrong_count = wrong_count + 1,
                      last_wrong_at = datetime('now')
                    ",
                    params![result.question_id, result.bank_id],
                )
                .map_err(|error| format!("写入错题本失败: {error}"))?;
        }

        Ok(())
    }

    pub fn remove_wrong_book_item(&self, question_id: i64) -> Result<(), String> {
        let connection = self.connection.borrow();
        connection
            .execute(
                "DELETE FROM wrong_book WHERE question_id = ?1",
                params![question_id],
            )
            .map_err(|error| format!("移除错题失败: {error}"))?;
        Ok(())
    }

    pub fn clear_wrong_book(&self, bank_id: Option<i64>) -> Result<(), String> {
        let connection = self.connection.borrow();
        if let Some(bank_id) = bank_id.filter(|value| *value > 0) {
            connection
                .execute(
                    "DELETE FROM wrong_book WHERE bank_id = ?1",
                    params![bank_id],
                )
                .map_err(|error| format!("清空题库错题失败: {error}"))?;
            add_operation_log(
                &connection,
                "清空错题本",
                format!("清空题库 {bank_id} 的错题"),
            )?;
        } else {
            connection
                .execute("DELETE FROM wrong_book", [])
                .map_err(|error| format!("清空错题本失败: {error}"))?;
            add_operation_log(&connection, "清空错题本", "清空全部错题")?;
        }
        Ok(())
    }
}

fn open_database_at(path: &Path) -> Result<DatabaseStore, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建数据库目录失败: {error}"))?;
    }

    let connection = Connection::open(path).map_err(|error| format!("打开数据库失败: {error}"))?;
    initialize_database_schema(&connection)?;
    Ok(DatabaseStore {
        connection: RefCell::new(connection),
    })
}
