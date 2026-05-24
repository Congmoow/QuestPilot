use std::cell::RefCell;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub const DATABASE_FILE_NAME: &str = "questpilot.db";

const LEGACY_DATABASE_FILE_NAMES: [&str; 1] = ["question-bank.db"];
const LEGACY_USER_DATA_DIRS: [&str; 2] = ["question-bank-assistant", "题库助手"];
const QUESTION_TYPES: [&str; 5] = ["single", "multiple", "boolean", "fill", "short"];

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

#[derive(Debug, Deserialize)]
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

fn initialize_tables(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;

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
