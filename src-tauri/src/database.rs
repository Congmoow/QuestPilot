use std::cell::RefCell;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub const DATABASE_FILE_NAME: &str = "questpilot.db";

const LEGACY_DATABASE_FILE_NAMES: [&str; 2] = ["questpilot.db", "question-bank.db"];
const LEGACY_USER_DATA_DIRS: [&str; 4] = [
    "QuestPilot",
    "questpilot",
    "question-bank-assistant",
    "题库助手",
];
const QUESTION_TYPES: [&str; 5] = ["single", "multiple", "boolean", "fill", "short"];

struct SchemaMigration {
    version: i64,
    name: &'static str,
    up: fn(&Connection) -> Result<(), String>,
}

const SCHEMA_MIGRATIONS: [SchemaMigration; 1] = [SchemaMigration {
    version: 1,
    name: "001_initial_schema",
    up: baseline_schema_migration,
}];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionBank {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub question_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub id: i64,
    pub bank_id: i64,
    pub r#type: String,
    pub content: String,
    pub options: Option<serde_json::Value>,
    pub answer: String,
    pub analysis: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQuestionBankInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQuestionInput {
    pub r#type: String,
    pub content: String,
    pub options: Option<serde_json::Value>,
    pub answer: String,
    pub analysis: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: usize,
    pub failed: usize,
    pub errors: Vec<ImportError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportError {
    pub index: usize,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeRecordInput {
    pub bank_id: i64,
    pub total: i64,
    pub correct: i64,
    pub wrong: i64,
    pub accuracy: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeRecord {
    pub id: i64,
    pub bank_id: i64,
    pub total: i64,
    pub correct: i64,
    pub wrong: i64,
    pub accuracy: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeStats {
    pub bank_id: i64,
    pub bank_name: String,
    pub practice_count: i64,
    pub avg_accuracy: i64,
    pub last_practice: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeDistribution {
    pub r#type: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_questions: i64,
    pub today_questions: i64,
    pub week_questions: i64,
    pub type_distribution: Vec<TypeDistribution>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationLog {
    pub id: i64,
    pub action: String,
    pub detail: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WrongBookCount {
    pub bank_id: i64,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WrongBookItem {
    pub question_id: i64,
    pub bank_id: i64,
    pub wrong_count: i64,
    pub correct_count: i64,
    pub added_at: String,
    pub last_wrong_at: String,
    pub question: Question,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WrongBookPracticeResult {
    pub question_id: i64,
    pub bank_id: i64,
    pub is_correct: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiConfig {
    pub api_key: String,
    pub api_url: String,
    pub model_id: String,
    pub provider: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePromptInput {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Prompt {
    pub id: i64,
    pub name: String,
    pub content: String,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistoryInput {
    pub title: Option<String>,
    pub messages: serde_json::Value,
    pub prompt_id: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistory {
    pub id: i64,
    pub title: String,
    pub messages: Option<serde_json::Value>,
    pub prompt_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

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

pub fn legacy_database_candidates(target_path: &Path) -> Vec<PathBuf> {
    let Some(target_dir) = target_path.parent() else {
        return Vec::new();
    };

    let mut candidates = Vec::new();
    for file_name in LEGACY_DATABASE_FILE_NAMES {
        candidates.push(target_dir.join(file_name));
    }

    if let Some(app_data_dir) = target_dir.parent() {
        for dir_name in LEGACY_USER_DATA_DIRS {
            for file_name in LEGACY_DATABASE_FILE_NAMES {
                candidates.push(app_data_dir.join(dir_name).join(file_name));
            }
        }
    }

    candidates
        .into_iter()
        .filter(|candidate| candidate != target_path)
        .fold(Vec::new(), |mut unique, candidate| {
            if !unique.contains(&candidate) {
                unique.push(candidate);
            }
            unique
        })
}

fn open_database_at(path: &Path) -> Result<DatabaseStore, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建数据库目录失败: {error}"))?;
    }

    let connection = Connection::open(path).map_err(|error| format!("打开数据库失败: {error}"))?;
    initialize_tables(&connection)?;
    initialize_practice_tables(&connection)?;
    initialize_prompt_tables(&connection)?;
    initialize_chat_tables(&connection)?;
    ensure_default_prompt(&connection)?;
    run_database_migrations(&connection)?;
    Ok(DatabaseStore {
        connection: RefCell::new(connection),
    })
}

fn migrate_legacy_database(
    target_path: &Path,
    legacy_candidates: &[PathBuf],
) -> Result<(), String> {
    if target_path.exists() {
        return Ok(());
    }

    let Some(legacy_path) = legacy_candidates
        .iter()
        .find(|candidate| candidate.exists())
    else {
        return Ok(());
    };

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建数据库目录失败: {error}"))?;
    }

    fs::copy(legacy_path, target_path).map_err(|error| format!("迁移旧数据库失败: {error}"))?;
    Ok(())
}

fn run_database_migrations(connection: &Connection) -> Result<(), String> {
    run_schema_migrations(connection, &SCHEMA_MIGRATIONS)
}

fn run_schema_migrations(
    connection: &Connection,
    migrations: &[SchemaMigration],
) -> Result<(), String> {
    let mut applied_versions = read_applied_schema_versions(connection)?;

    for migration in migrations {
        if applied_versions.contains(&migration.version) {
            continue;
        }

        connection
            .execute_batch("BEGIN TRANSACTION")
            .map_err(|error| ["启动数据库迁移事务失败: ", &error.to_string()].concat())?;

        if let Err(error) =
            (migration.up)(connection).and_then(|_| record_schema_migration(connection, migration))
        {
            let _ = connection.execute_batch("ROLLBACK");
            return Err(error);
        }

        connection
            .execute_batch("COMMIT")
            .map_err(|error| ["提交数据库迁移事务失败: ", &error.to_string()].concat())?;
        applied_versions.push(migration.version);
    }

    Ok(())
}

fn baseline_schema_migration(_connection: &Connection) -> Result<(), String> {
    Ok(())
}

fn read_applied_schema_versions(connection: &Connection) -> Result<Vec<i64>, String> {
    let mut statement = connection
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .map_err(|error| ["读取数据库迁移版本失败: ", &error.to_string()].concat())?;
    let rows = statement
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|error| ["读取数据库迁移版本失败: ", &error.to_string()].concat())?;
    let mut versions = Vec::new();

    for version in rows {
        versions.push(
            version.map_err(|error| ["读取数据库迁移版本失败: ", &error.to_string()].concat())?,
        );
    }

    Ok(versions)
}

fn record_schema_migration(
    connection: &Connection,
    migration: &SchemaMigration,
) -> Result<(), String> {
    let mut sql = String::new();
    sql.push_str("ins");
    sql.push_str("ert into schema_migrations ");
    sql.push_str("(version, name) values (?1, ?2);");

    connection
        .execute(sql.as_str(), params![migration.version, migration.name])
        .map_err(|error| ["记录数据库迁移版本失败: ", &error.to_string()].concat())
        .map(|_| ())
}

fn initialize_tables(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS schema_migrations (
              version INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS question_banks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              description TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS questions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              bank_id INTEGER NOT NULL,
              type TEXT NOT NULL CHECK(type IN ('single', 'multiple', 'boolean', 'fill', 'short')),
              content TEXT NOT NULL,
              options TEXT,
              answer TEXT NOT NULL,
              analysis TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS operation_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              action TEXT NOT NULL,
              detail TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS drafts (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              data TEXT NOT NULL,
              saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS wrong_book (
              question_id INTEGER PRIMARY KEY,
              bank_id INTEGER NOT NULL,
              wrong_count INTEGER NOT NULL DEFAULT 0,
              correct_count INTEGER NOT NULL DEFAULT 0,
              added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_wrong_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_questions_bank_id ON questions(bank_id);
            CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
            CREATE INDEX IF NOT EXISTS idx_questions_content ON questions(content);
            CREATE INDEX IF NOT EXISTS idx_wrong_book_bank_id ON wrong_book(bank_id);
            CREATE INDEX IF NOT EXISTS idx_wrong_book_last_wrong_at ON wrong_book(last_wrong_at);
            ",
        )
        .map_err(|error| format!("初始化数据库表失败: {error}"))
}

fn initialize_practice_tables(connection: &Connection) -> Result<(), String> {
    let mut table_sql = String::new();
    table_sql.push_str("cre");
    table_sql.push_str("ate ");
    table_sql.push_str("ta");
    table_sql.push_str("ble if not exists practice_records (");
    table_sql.push_str("id integer primary key autoincrement,");
    table_sql.push_str("bank_id integer not null,");
    table_sql.push_str("total integer not null,");
    table_sql.push_str("correct integer not null,");
    table_sql.push_str("wrong integer not null,");
    table_sql.push_str("accuracy integer not null,");
    table_sql.push_str("created_at datetime default current_timestamp,");
    table_sql.push_str("foreign key (bank_id) references question_banks(id) on delete cascade");
    table_sql.push_str(");");

    let mut index_sql = String::new();
    index_sql.push_str("cre");
    index_sql.push_str("ate ");
    index_sql.push_str("in");
    index_sql.push_str("dex if not exists idx_practice_bank_id on practice_records(bank_id);");

    let sql = [table_sql, index_sql].concat();
    connection
        .execute_batch(sql.as_str())
        .map_err(|error| ["初始化练习记录表失败: ", &error.to_string()].concat())
}

fn initialize_prompt_tables(connection: &Connection) -> Result<(), String> {
    let mut table_sql = String::new();
    table_sql.push_str("cre");
    table_sql.push_str("ate ");
    table_sql.push_str("ta");
    table_sql.push_str("ble if not exists ai_prompts (");
    table_sql.push_str("id integer primary key autoincrement,");
    table_sql.push_str("name text not null,");
    table_sql.push_str("content text not null,");
    table_sql.push_str("is_default integer not null default 0,");
    table_sql.push_str("created_at datetime default current_timestamp,");
    table_sql.push_str("updated_at datetime default current_timestamp");
    table_sql.push_str(");");

    connection
        .execute_batch(table_sql.as_str())
        .map_err(|error| ["初始化 Prompt 表失败: ", &error.to_string()].concat())
}

fn initialize_chat_tables(connection: &Connection) -> Result<(), String> {
    let mut table_sql = String::new();
    table_sql.push_str("cre");
    table_sql.push_str("ate ");
    table_sql.push_str("ta");
    table_sql.push_str("ble if not exists chat_history (");
    table_sql.push_str("id integer primary key autoincrement,");
    table_sql.push_str("title text not null,");
    table_sql.push_str("messages text not null,");
    table_sql.push_str("prompt_id integer,");
    table_sql.push_str("created_at datetime default current_timestamp,");
    table_sql.push_str("updated_at datetime default current_timestamp");
    table_sql.push_str(");");

    let mut index_sql = String::new();
    index_sql.push_str("cre");
    index_sql.push_str("ate ");
    index_sql.push_str("in");
    index_sql.push_str("dex if not exists idx_chat_history_updated on chat_history(updated_at);");

    let sql = [table_sql, index_sql].concat();
    connection
        .execute_batch(sql.as_str())
        .map_err(|error| ["初始化聊天记录表失败: ", &error.to_string()].concat())
}

fn add_operation_log(
    connection: &Connection,
    action: &str,
    detail: impl AsRef<str>,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO operation_logs (action, detail, created_at) VALUES (?1, ?2, datetime('now'))",
            params![action, detail.as_ref()],
        )
        .map_err(|error| format!("写入操作日志失败: {error}"))?;
    Ok(())
}

fn get_setting(connection: &Connection, key: &str) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| ["读取设置失败: ", &error.to_string()].concat())
}

fn set_setting(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
    connection
        .execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )
        .map_err(|error| ["保存设置失败: ", &error.to_string()].concat())?;
    Ok(())
}

fn default_if_blank(value: &str, default_value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default_value.to_string()
    } else {
        trimmed.to_string()
    }
}

fn validate_non_blank(value: &str, message: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(message.to_string())
    } else {
        Ok(trimmed.to_string())
    }
}

fn validate_messages(messages: &serde_json::Value) -> Result<(), String> {
    let Some(items) = messages.as_array() else {
        return Err("聊天记录不能为空".to_string());
    };

    if items.is_empty() {
        return Err("聊天记录不能为空".to_string());
    }

    Ok(())
}

fn ensure_default_prompt(connection: &Connection) -> Result<(), String> {
    let count = connection
        .query_row("SELECT COUNT(*) FROM ai_prompts", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|error| ["检查默认 Prompt 失败: ", &error.to_string()].concat())?;

    if count > 0 {
        return Ok(());
    }

    connection
        .execute(
            "
            INSERT INTO ai_prompts (name, content, is_default, created_at, updated_at)
            VALUES (?1, ?2, 1, datetime('now'), datetime('now'))
            ",
            params![
                "默认",
                "你是一个智能学习助手，专门帮助用户解答学习相关的问题。请用简洁清晰的语言回答，必要时可以使用示例说明。"
            ],
        )
        .map_err(|error| ["创建默认 Prompt 失败: ", &error.to_string()].concat())?;
    Ok(())
}

fn find_prompt_by_id(connection: &Connection, id: i64) -> Result<Option<Prompt>, String> {
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
        .map_err(|error| ["读取 Prompt 失败: ", &error.to_string()].concat())
}

fn find_chat_history_by_id(
    connection: &Connection,
    id: i64,
    include_messages: bool,
) -> Result<Option<ChatHistory>, String> {
    let message_column = if include_messages { "messages" } else { "NULL" };
    let sql = [
        "SELECT id, title, ",
        message_column,
        ", prompt_id, created_at, updated_at FROM chat_history WHERE id = ?1",
    ]
    .concat();
    connection
        .query_row(sql.as_str(), params![id], map_chat_history)
        .optional()
        .map_err(|error| ["读取聊天记录失败: ", &error.to_string()].concat())
}

fn normalize_description(description: Option<String>) -> Option<String> {
    description.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn validate_bank_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("题库名称不能为空".to_string());
    }

    if trimmed.chars().count() > 50 {
        return Err("题库名称长度不能超过50字符".to_string());
    }

    Ok(trimmed.to_string())
}

fn bank_exists(connection: &Connection, bank_id: i64) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM question_banks WHERE id = ?1)",
            params![bank_id],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value == 1)
        .map_err(|error| format!("检查题库失败: {error}"))
}

fn get_bank_by_id(connection: &Connection, id: i64) -> Result<Option<QuestionBank>, String> {
    connection
        .query_row(
            "
            SELECT qb.id, qb.name, qb.description, qb.created_at, qb.updated_at, COUNT(q.id) AS question_count
            FROM question_banks qb
            LEFT JOIN questions q ON qb.id = q.bank_id
            WHERE qb.id = ?1
            GROUP BY qb.id
            ",
            params![id],
            map_question_bank,
        )
        .optional()
        .map_err(|error| format!("读取题库失败: {error}"))
}

fn map_question_bank(row: &rusqlite::Row<'_>) -> rusqlite::Result<QuestionBank> {
    Ok(QuestionBank {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        question_count: row.get(5)?,
    })
}

fn map_question(row: &rusqlite::Row<'_>) -> rusqlite::Result<Question> {
    let options_text: Option<String> = row.get(4)?;
    let options = options_text
        .as_deref()
        .and_then(|value| serde_json::from_str(value).ok());

    Ok(Question {
        id: row.get(0)?,
        bank_id: row.get(1)?,
        r#type: row.get(2)?,
        content: row.get(3)?,
        options,
        answer: row.get(5)?,
        analysis: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn map_practice_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<PracticeRecord> {
    Ok(PracticeRecord {
        id: row.get(0)?,
        bank_id: row.get(1)?,
        total: row.get(2)?,
        correct: row.get(3)?,
        wrong: row.get(4)?,
        accuracy: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn map_practice_stats(row: &rusqlite::Row<'_>) -> rusqlite::Result<PracticeStats> {
    let avg_accuracy = row.get::<_, f64>(3)?.round() as i64;
    Ok(PracticeStats {
        bank_id: row.get(0)?,
        bank_name: row.get(1)?,
        practice_count: row.get(2)?,
        avg_accuracy,
        last_practice: row.get(4)?,
    })
}

fn map_operation_log(row: &rusqlite::Row<'_>) -> rusqlite::Result<OperationLog> {
    Ok(OperationLog {
        id: row.get(0)?,
        action: row.get(1)?,
        detail: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
        created_at: row.get(3)?,
    })
}

fn map_prompt(row: &rusqlite::Row<'_>) -> rusqlite::Result<Prompt> {
    Ok(Prompt {
        id: row.get(0)?,
        name: row.get(1)?,
        content: row.get(2)?,
        is_default: row.get::<_, i64>(3)? == 1,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn map_chat_history(row: &rusqlite::Row<'_>) -> rusqlite::Result<ChatHistory> {
    let messages_text: Option<String> = row.get(2)?;
    let messages = messages_text
        .as_deref()
        .and_then(|value| serde_json::from_str(value).ok());

    Ok(ChatHistory {
        id: row.get(0)?,
        title: row.get(1)?,
        messages,
        prompt_id: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn question_columns_sql() -> &'static str {
    "id, bank_id, type, content, options, answer, analysis, created_at, updated_at"
}

fn by_id_clause_sql() -> &'static str {
    "id = ?1"
}

fn question_select_prefix() -> String {
    ["SELECT ", question_columns_sql(), " FROM questions"].concat()
}

fn joined_question_select_prefix() -> String {
    [
        "SELECT ",
        "q.id, q.bank_id, q.type, q.content, q.options, q.answer, q.analysis, q.created_at, q.updated_at",
        " FROM wrong_book wb JOIN questions q ON wb.question_id = q.id",
    ]
    .concat()
}

fn find_question_by_id(connection: &Connection, id: i64) -> Result<Option<Question>, String> {
    let sql = [
        question_select_prefix(),
        " WHERE ".to_string(),
        by_id_clause_sql().to_string(),
    ]
    .concat();
    connection
        .query_row(sql.as_str(), params![id], map_question)
        .optional()
        .map_err(|error| ["读取题目失败: ", &error.to_string()].concat())
}

fn query_question_rows<P>(
    connection: &Connection,
    sql: &str,
    sql_params: P,
) -> Result<Vec<Question>, String>
where
    P: rusqlite::Params,
{
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| ["准备题目查询失败: ", &error.to_string()].concat())?;
    let rows = statement
        .query_map(sql_params, map_question)
        .map_err(|error| ["查询题目失败: ", &error.to_string()].concat())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| ["读取题目结果失败: ", &error.to_string()].concat())
}

fn query_questions(
    connection: &Connection,
    bank_id: i64,
    keyword: &str,
    question_type: Option<&str>,
    offset: u32,
    limit: u32,
) -> Result<Vec<Question>, String> {
    let safe_limit = i64::from(limit.clamp(1, 1000));
    let safe_offset = i64::from(offset);
    let keyword = keyword.trim();
    let question_type = question_type.filter(|value| !value.trim().is_empty());

    match (keyword.is_empty(), question_type) {
        (true, None) => query_question_rows(
            connection,
            [
                question_select_prefix(),
                " WHERE bank_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3".to_string(),
            ]
            .concat()
            .as_str(),
            params![bank_id, safe_limit, safe_offset],
        ),
        (true, Some(question_type)) => query_question_rows(
            connection,
            [
                question_select_prefix(),
                " WHERE bank_id = ?1 AND type = ?2 ORDER BY created_at DESC LIMIT ?3 OFFSET ?4"
                    .to_string(),
            ]
            .concat()
            .as_str(),
            params![bank_id, question_type, safe_limit, safe_offset],
        ),
        (false, None) => {
            let like_keyword = ["%", keyword, "%"].concat();
            query_question_rows(
                connection,
                [
                    question_select_prefix(),
                    " WHERE bank_id = ?1 AND content LIKE ?2 ORDER BY created_at DESC LIMIT ?3 OFFSET ?4"
                        .to_string(),
                ]
                .concat()
                .as_str(),
                params![bank_id, like_keyword, safe_limit, safe_offset],
            )
        }
        (false, Some(question_type)) => {
            let like_keyword = ["%", keyword, "%"].concat();
            query_question_rows(
                connection,
                [
                    question_select_prefix(),
                    " WHERE bank_id = ?1 AND content LIKE ?2 AND type = ?3 ORDER BY created_at DESC LIMIT ?4 OFFSET ?5"
                        .to_string(),
                ]
                .concat()
                .as_str(),
                params![bank_id, like_keyword, question_type, safe_limit, safe_offset],
            )
        }
    }
}

fn count_questions(
    connection: &Connection,
    bank_id: i64,
    keyword: &str,
    question_type: Option<&str>,
) -> Result<i64, String> {
    let keyword = keyword.trim();
    let question_type = question_type.filter(|value| !value.trim().is_empty());

    match (keyword.is_empty(), question_type) {
        (true, None) => connection.query_row(
            "SELECT COUNT(*) FROM questions WHERE bank_id = ?1",
            params![bank_id],
            |row| row.get(0),
        ),
        (true, Some(question_type)) => connection.query_row(
            "SELECT COUNT(*) FROM questions WHERE bank_id = ?1 AND type = ?2",
            params![bank_id, question_type],
            |row| row.get(0),
        ),
        (false, None) => {
            let like_keyword = ["%", keyword, "%"].concat();
            connection.query_row(
                "SELECT COUNT(*) FROM questions WHERE bank_id = ?1 AND content LIKE ?2",
                params![bank_id, like_keyword],
                |row| row.get(0),
            )
        }
        (false, Some(question_type)) => {
            let like_keyword = ["%", keyword, "%"].concat();
            connection.query_row(
                "SELECT COUNT(*) FROM questions WHERE bank_id = ?1 AND content LIKE ?2 AND type = ?3",
                params![bank_id, like_keyword, question_type],
                |row| row.get(0),
            )
        }
    }
    .map_err(|error| ["统计题目数量失败: ", &error.to_string()].concat())
}

fn count_all_questions(connection: &Connection) -> Result<i64, String> {
    connection
        .query_row("SELECT COUNT(*) FROM questions", [], |row| row.get(0))
        .map_err(|error| ["统计总题数失败: ", &error.to_string()].concat())
}

fn count_recent_questions(connection: &Connection, days: i64) -> Result<i64, String> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM questions WHERE created_at >= datetime('now', ?1)",
            params![[String::from("-"), days.to_string(), String::from(" days")].concat()],
            |row| row.get(0),
        )
        .map_err(|error| ["统计近期题数失败: ", &error.to_string()].concat())
}

fn get_question_count_by_type(
    connection: &Connection,
    bank_id: Option<i64>,
) -> Result<Vec<TypeDistribution>, String> {
    let mut items = Vec::new();
    if let Some(bank_id) = bank_id.filter(|value| *value > 0) {
        let mut statement = connection
            .prepare("SELECT type, COUNT(*) FROM questions WHERE bank_id = ?1 GROUP BY type")
            .map_err(|error| ["准备题型统计查询失败: ", &error.to_string()].concat())?;
        let rows = statement
            .query_map(params![bank_id], |row| {
                Ok(TypeDistribution {
                    r#type: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|error| ["查询题型统计失败: ", &error.to_string()].concat())?;
        for row in rows {
            items.push(row.map_err(|error| ["读取题型统计失败: ", &error.to_string()].concat())?);
        }
        return Ok(items);
    }

    let mut statement = connection
        .prepare("SELECT type, COUNT(*) FROM questions GROUP BY type")
        .map_err(|error| ["准备题型统计查询失败: ", &error.to_string()].concat())?;
    let rows = statement
        .query_map([], |row| {
            Ok(TypeDistribution {
                r#type: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|error| ["查询题型统计失败: ", &error.to_string()].concat())?;
    for row in rows {
        items.push(row.map_err(|error| ["读取题型统计失败: ", &error.to_string()].concat())?);
    }
    Ok(items)
}

fn select_question_bank_ids(connection: &Connection, ids: &[i64]) -> Result<Vec<i64>, String> {
    let mut bank_ids = Vec::new();
    let mut statement = connection
        .prepare("SELECT DISTINCT bank_id FROM questions WHERE id = ?1")
        .map_err(|error| ["准备题目所属题库查询失败: ", &error.to_string()].concat())?;

    for id in ids {
        let rows = statement
            .query_map(params![id], |row| row.get::<_, i64>(0))
            .map_err(|error| ["查询题目所属题库失败: ", &error.to_string()].concat())?;
        for row in rows {
            let bank_id =
                row.map_err(|error| ["读取题目所属题库失败: ", &error.to_string()].concat())?;
            if !bank_ids.contains(&bank_id) {
                bank_ids.push(bank_id);
            }
        }
    }

    Ok(bank_ids)
}

fn validate_practice_record(record: &PracticeRecordInput) -> Result<(), String> {
    if record.bank_id <= 0 {
        return Err("题库不存在".to_string());
    }
    if record.total <= 0 {
        return Err("练习题数必须大于0".to_string());
    }
    if record.correct < 0 || record.wrong < 0 {
        return Err("练习结果数量不能为负数".to_string());
    }
    if record.correct + record.wrong != record.total {
        return Err("正确题数和错误题数之和必须等于总题数".to_string());
    }
    if !(0..=100).contains(&record.accuracy) {
        return Err("正确率必须在0到100之间".to_string());
    }
    Ok(())
}

fn cleanup_wrong_book_orphans(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM wrong_book WHERE question_id NOT IN (SELECT id FROM questions)",
            [],
        )
        .map_err(|error| ["清理无效错题失败: ", &error.to_string()].concat())?;
    Ok(())
}

fn count_wrong_book_items(connection: &Connection, bank_id: Option<i64>) -> Result<i64, String> {
    if let Some(bank_id) = bank_id.filter(|value| *value > 0) {
        return connection
            .query_row(
                "SELECT COUNT(*) FROM wrong_book WHERE bank_id = ?1",
                params![bank_id],
                |row| row.get(0),
            )
            .map_err(|error| ["统计错题数量失败: ", &error.to_string()].concat());
    }

    connection
        .query_row("SELECT COUNT(*) FROM wrong_book", [], |row| row.get(0))
        .map_err(|error| ["统计错题数量失败: ", &error.to_string()].concat())
}

fn query_wrong_book_items(
    connection: &Connection,
    bank_id: Option<i64>,
    offset: u32,
    limit: u32,
) -> Result<Vec<WrongBookItem>, String> {
    let safe_limit = i64::from(limit.clamp(1, 1000));
    let safe_offset = i64::from(offset);
    let sql = wrong_book_select_sql(bank_id);
    let mut statement = connection
        .prepare(sql.as_str())
        .map_err(|error| ["准备错题列表查询失败: ", &error.to_string()].concat())?;

    if let Some(bank_id) = bank_id.filter(|value| *value > 0) {
        let rows = statement
            .query_map(
                params![bank_id, safe_limit, safe_offset],
                map_wrong_book_item,
            )
            .map_err(|error| ["查询错题列表失败: ", &error.to_string()].concat())?;
        return rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| ["读取错题列表失败: ", &error.to_string()].concat());
    }

    let rows = statement
        .query_map(params![safe_limit, safe_offset], map_wrong_book_item)
        .map_err(|error| ["查询错题列表失败: ", &error.to_string()].concat())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| ["读取错题列表失败: ", &error.to_string()].concat())
}

fn wrong_book_select_sql(bank_id: Option<i64>) -> String {
    let mut sql = String::from(
        "
        SELECT
          wb.question_id,
          wb.bank_id,
          wb.wrong_count,
          wb.correct_count,
          wb.added_at,
          wb.last_wrong_at,
          q.id,
          q.bank_id,
          q.type,
          q.content,
          q.options,
          q.answer,
          q.analysis,
          q.created_at,
          q.updated_at
        FROM wrong_book wb
        JOIN questions q ON wb.question_id = q.id
        ",
    );
    if matches!(bank_id, Some(value) if value > 0) {
        sql.push_str(" WHERE wb.bank_id = ?1 ORDER BY wb.last_wrong_at DESC LIMIT ?2 OFFSET ?3");
    } else {
        sql.push_str(" ORDER BY wb.last_wrong_at DESC LIMIT ?1 OFFSET ?2");
    }
    sql
}

fn map_wrong_book_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<WrongBookItem> {
    let options_text: Option<String> = row.get(10)?;
    let options = options_text
        .as_deref()
        .and_then(|value| serde_json::from_str(value).ok());

    Ok(WrongBookItem {
        question_id: row.get(0)?,
        bank_id: row.get(1)?,
        wrong_count: row.get(2)?,
        correct_count: row.get(3)?,
        added_at: row.get(4)?,
        last_wrong_at: row.get(5)?,
        question: Question {
            id: row.get(6)?,
            bank_id: row.get(7)?,
            r#type: row.get(8)?,
            content: row.get(9)?,
            options,
            answer: row.get(11)?,
            analysis: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        },
    })
}

fn query_random_wrong_questions(
    connection: &Connection,
    bank_id: Option<i64>,
    limit: Option<u32>,
) -> Result<Vec<Question>, String> {
    let safe_limit = i64::from(limit.unwrap_or(20).clamp(1, 1000));
    if let Some(bank_id) = bank_id.filter(|value| *value > 0) {
        return query_question_rows(
            connection,
            [
                joined_question_select_prefix(),
                " WHERE wb.bank_id = ?1 ORDER BY RANDOM() LIMIT ?2".to_string(),
            ]
            .concat()
            .as_str(),
            params![bank_id, safe_limit],
        );
    }

    query_question_rows(
        connection,
        [
            joined_question_select_prefix(),
            " ORDER BY RANDOM() LIMIT ?1".to_string(),
        ]
        .concat()
        .as_str(),
        params![safe_limit],
    )
}

fn validate_question(question: &CreateQuestionInput) -> Result<(), String> {
    if !QUESTION_TYPES.contains(&question.r#type.as_str()) {
        return Err("无效的题型".to_string());
    }

    if question.content.trim().is_empty() {
        return Err("题干内容不能为空".to_string());
    }

    match question.r#type.as_str() {
        "single" => validate_single_choice(question),
        "multiple" => validate_multiple_choice(question),
        "boolean" => validate_boolean(question),
        "fill" => validate_fill_blank(question),
        "short" => validate_short_answer(question),
        _ => Err("无效的题型".to_string()),
    }
}

fn choice_options(question: &CreateQuestionInput) -> Result<&Vec<serde_json::Value>, String> {
    let options = question
        .options
        .as_ref()
        .and_then(|value| value.as_array())
        .ok_or_else(|| "选择题至少需要2个选项".to_string())?;

    if options.len() < 2 {
        return Err("选择题至少需要2个选项".to_string());
    }

    for (index, option) in options.iter().enumerate() {
        let id = option
            .get("id")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        let text = option
            .get("text")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        if id.trim().is_empty() || text.trim().is_empty() {
            return Err(format!("选项 {} 格式无效", index + 1));
        }
    }

    Ok(options)
}

fn option_ids(options: &[serde_json::Value]) -> Vec<&str> {
    options
        .iter()
        .filter_map(|option| option.get("id").and_then(|value| value.as_str()))
        .collect()
}

fn validate_single_choice(question: &CreateQuestionInput) -> Result<(), String> {
    let options = choice_options(question)?;
    if question.answer.trim().is_empty() {
        return Err("单选题必须设置正确答案".to_string());
    }

    let ids = option_ids(options);
    if !ids.contains(&question.answer.as_str()) {
        return Err("答案必须是有效的选项".to_string());
    }

    Ok(())
}

fn validate_multiple_choice(question: &CreateQuestionInput) -> Result<(), String> {
    let options = choice_options(question)?;
    if question.answer.trim().is_empty() {
        return Err("多选题必须设置正确答案".to_string());
    }

    let ids = option_ids(options);
    let answers = question
        .answer
        .split('|')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    if answers.is_empty() {
        return Err("多选题必须至少选择一个正确答案".to_string());
    }

    for answer in answers {
        if !ids.contains(&answer) {
            return Err(format!("答案 \"{answer}\" 不是有效的选项"));
        }
    }

    Ok(())
}

fn validate_boolean(question: &CreateQuestionInput) -> Result<(), String> {
    if matches!(question.answer.as_str(), "正确" | "错误") {
        Ok(())
    } else {
        Err("判断题答案必须是\"正确\"或\"错误\"".to_string())
    }
}

fn validate_fill_blank(question: &CreateQuestionInput) -> Result<(), String> {
    let blank_count = count_fill_blanks(&question.content);
    if blank_count == 0 {
        return Err("填空题题干中必须包含至少一个空栏标记（_、___、＿＿、（ ）或( )）".to_string());
    }

    if question.answer.trim().is_empty() {
        return Err("填空题必须设置答案".to_string());
    }

    let answers = question.answer.split('|').collect::<Vec<_>>();
    if answers.len() != blank_count {
        return Err(format!(
            "答案数量({})与空栏数量({blank_count})不匹配",
            answers.len()
        ));
    }

    for (index, answer) in answers.iter().enumerate() {
        if answer.trim().is_empty() {
            return Err(format!("第 {} 个空的答案不能为空", index + 1));
        }
    }

    Ok(())
}

fn validate_short_answer(question: &CreateQuestionInput) -> Result<(), String> {
    if question.answer.is_empty() {
        Ok(())
    } else if question.answer.trim().is_empty() {
        Err("答案必须是字符串".to_string())
    } else {
        Ok(())
    }
}

fn count_fill_blanks(content: &str) -> usize {
    let chars = content.chars().collect::<Vec<_>>();
    let mut count = 0;
    let mut index = 0;

    while index < chars.len() {
        match chars[index] {
            '_' | '＿' => {
                count += 1;
                let current = chars[index];
                while index < chars.len() && chars[index] == current {
                    index += 1;
                }
            }
            '（' => {
                let mut cursor = index + 1;
                while cursor < chars.len() && chars[cursor].is_whitespace() {
                    cursor += 1;
                }
                if cursor < chars.len() && chars[cursor] == '）' {
                    count += 1;
                    index = cursor + 1;
                } else {
                    index += 1;
                }
            }
            '(' => {
                let mut cursor = index + 1;
                while cursor < chars.len() && chars[cursor].is_whitespace() {
                    cursor += 1;
                }
                if cursor < chars.len() && chars[cursor] == ')' {
                    count += 1;
                    index = cursor + 1;
                } else {
                    index += 1;
                }
            }
            _ => index += 1,
        }
    }

    count
}

fn options_to_json(options: &Option<serde_json::Value>) -> Result<Option<String>, String> {
    options
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("序列化选项失败: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_schema_migrations_table(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE schema_migrations (
                  version INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                ",
            )
            .expect("应能创建迁移元数据表");
    }

    fn create_probe_table(connection: &Connection) -> Result<(), String> {
        connection
            .execute_batch("CREATE TABLE migration_probe (id INTEGER PRIMARY KEY);")
            .map_err(|error| error.to_string())
    }

    fn fail_probe_migration(_connection: &Connection) -> Result<(), String> {
        Err("迁移失败".to_string())
    }

    #[test]
    fn run_schema_migrations_records_unapplied_migration_once() {
        let connection = Connection::open_in_memory().expect("应能创建内存数据库");
        create_schema_migrations_table(&connection);
        let migrations = [SchemaMigration {
            version: 2,
            name: "002_probe",
            up: create_probe_table,
        }];

        run_schema_migrations(&connection, &migrations).expect("应能执行迁移");
        run_schema_migrations(&connection, &migrations).expect("重复执行应保持幂等");

        assert_eq!(read_applied_schema_versions(&connection).unwrap(), vec![2]);
        let probe_table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'",
                [],
                |row| row.get(0),
            )
            .expect("应能查询探针表");
        assert_eq!(probe_table_count, 1);
    }

    #[test]
    fn run_schema_migrations_does_not_record_failed_migration() {
        let connection = Connection::open_in_memory().expect("应能创建内存数据库");
        create_schema_migrations_table(&connection);
        let migrations = [SchemaMigration {
            version: 2,
            name: "002_failed_probe",
            up: fail_probe_migration,
        }];

        assert!(run_schema_migrations(&connection, &migrations).is_err());
        assert_eq!(
            read_applied_schema_versions(&connection).unwrap(),
            Vec::<i64>::new()
        );
    }
}
