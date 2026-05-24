use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

const DATABASE_FILE_NAME: &str = "questpilot.db";
const QUESTION_TYPES: [&str; 5] = ["single", "multiple", "boolean", "fill", "short"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuestionBank {
    id: i64,
    name: String,
    description: Option<String>,
    created_at: String,
    updated_at: String,
    question_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Question {
    id: i64,
    bank_id: i64,
    r#type: String,
    content: String,
    options: Option<serde_json::Value>,
    answer: String,
    analysis: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateQuestionBankInput {
    name: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateQuestionInput {
    r#type: String,
    content: String,
    options: Option<serde_json::Value>,
    answer: String,
    analysis: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportResult {
    success: usize,
    failed: usize,
    errors: Vec<ImportError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportError {
    index: usize,
    message: String,
}

fn main_window(window: &WebviewWindow) -> Result<WebviewWindow, String> {
    window
        .app_handle()
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败: {error}"))
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(DATABASE_FILE_NAME))
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建数据库目录失败: {error}"))?;
    }

    let connection = Connection::open(&path).map_err(|error| format!("打开数据库失败: {error}"))?;
    initialize_tables(&connection)?;
    Ok(connection)
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

            CREATE INDEX IF NOT EXISTS idx_questions_bank_id ON questions(bank_id);
            CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
            CREATE INDEX IF NOT EXISTS idx_questions_content ON questions(content);
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

#[tauri::command(rename_all = "camelCase")]
fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    main_window(&window)?
        .minimize()
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn window_maximize(window: WebviewWindow) -> Result<(), String> {
    let main = main_window(&window)?;
    let is_maximized = main.is_maximized().map_err(|error| error.to_string())?;
    if is_maximized {
        main.unmaximize().map_err(|error| error.to_string())
    } else {
        main.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command(rename_all = "camelCase")]
fn window_close(window: WebviewWindow) -> Result<(), String> {
    main_window(&window)?
        .close()
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    main_window(&window)?
        .is_maximized()
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn question_bank_create(
    app: AppHandle,
    data: CreateQuestionBankInput,
) -> Result<QuestionBank, String> {
    let connection = open_database(&app)?;
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

#[tauri::command(rename_all = "camelCase")]
fn question_bank_get_all(app: AppHandle) -> Result<Vec<QuestionBank>, String> {
    let connection = open_database(&app)?;
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

#[tauri::command(rename_all = "camelCase")]
fn question_create_batch(
    app: AppHandle,
    bank_id: i64,
    questions: Vec<CreateQuestionInput>,
) -> Result<ImportResult, String> {
    if bank_id <= 0 {
        return Err("题库不存在".to_string());
    }

    if questions.is_empty() {
        return Err("没有可导入的题目".to_string());
    }

    let mut connection = open_database(&app)?;
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

#[tauri::command(rename_all = "camelCase")]
fn question_get_random(
    app: AppHandle,
    bank_id: i64,
    limit: Option<u32>,
    question_type: Option<String>,
) -> Result<Vec<Question>, String> {
    if bank_id <= 0 {
        return Ok(Vec::new());
    }

    let safe_limit = i64::from(limit.unwrap_or(20).clamp(1, 1000));
    let connection = open_database(&app)?;
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

#[tauri::command(rename_all = "camelCase")]
fn settings_get_theme(app: AppHandle) -> Result<String, String> {
    let connection = open_database(&app)?;
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

#[tauri::command(rename_all = "camelCase")]
fn settings_set_theme(app: AppHandle, theme: String) -> Result<(), String> {
    if !matches!(theme.as_str(), "light" | "dark" | "system") {
        return Err("无效的主题设置".to_string());
    }

    let connection = open_database(&app)?;
    connection
        .execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?1)",
            params![theme.as_str()],
        )
        .map_err(|error| format!("保存主题设置失败: {error}"))?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn csv_select_file(window: WebviewWindow) -> Result<Option<String>, String> {
    let file_path = window
        .dialog()
        .file()
        .add_filter("CSV 文件", &["csv"])
        .blocking_pick_file();

    Ok(file_path.map(|path| path.to_string()))
}

#[tauri::command(rename_all = "camelCase")]
fn csv_parse_file(file_path: String) -> Result<serde_json::Value, String> {
    let path = Path::new(&file_path);
    let mut reader = csv::Reader::from_path(path).map_err(|error| error.to_string())?;
    let headers = reader
        .headers()
        .map_err(|error| error.to_string())?
        .iter()
        .map(str::to_string)
        .collect::<Vec<_>>();
    let total_rows = reader
        .records()
        .try_fold(0usize, |count, row| row.map(|_| count + 1))
        .map_err(|error| error.to_string())?;

    Ok(serde_json::json!({
        "valid": [],
        "errors": [],
        "headers": headers,
        "totalRows": total_rows
    }))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            question_bank_create,
            question_bank_get_all,
            question_create_batch,
            question_get_random,
            settings_get_theme,
            settings_set_theme,
            csv_select_file,
            csv_parse_file
        ])
        .run(tauri::generate_context!())
        .expect("启动 QuestPilot Tauri PoC 失败");
}
