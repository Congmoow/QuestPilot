/// 仓库层共享 SQL helper。
///
/// 从原 `database::queries` 中迁移而来。
/// 所有函数接受 `&rusqlite::Connection`（或通过 `Transaction` deref 满足），
/// 可在 `with_connection` / `with_transaction` 闭包内直接调用。
use rusqlite::{params, Connection, OptionalExtension};

use crate::database::{ChatHistory, Prompt, Question};

// ── 操作日志 ──────────────────────────────────────────────────────────────────

/// 向 `operation_logs` 表插入一行日志。
pub fn add_operation_log(
    connection: &Connection,
    action: &str,
    detail: impl AsRef<str>,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO operation_logs (action, detail, created_at) \
             VALUES (?1, ?2, datetime('now'))",
            params![action, detail.as_ref()],
        )
        .map_err(|e| format!("写入操作日志失败: {e}"))?;
    Ok(())
}

// ── 题库 ──────────────────────────────────────────────────────────────────────

/// 检查题库是否存在。
pub fn bank_exists(connection: &Connection, bank_id: i64) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM question_banks WHERE id = ?1)",
            params![bank_id],
            |row| row.get::<_, i64>(0),
        )
        .map(|v| v == 1)
        .map_err(|e| format!("检查题库失败: {e}"))
}

// ── 题目 ──────────────────────────────────────────────────────────────────────

pub fn find_question_by_id(connection: &Connection, id: i64) -> Result<Option<Question>, String> {
    let sql = [
        question_select_prefix(),
        format!(" WHERE {}", by_id_clause_sql()),
    ]
    .concat();
    connection
        .query_row(sql.as_str(), params![id], map_question)
        .optional()
        .map_err(|e| format!("读取题目失败: {e}"))
}

pub fn map_question(row: &rusqlite::Row<'_>) -> rusqlite::Result<Question> {
    let options_text: Option<String> = row.get(4)?;
    let options = options_text
        .as_deref()
        .and_then(|v| serde_json::from_str(v).ok());
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

pub fn query_questions(
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
    let question_type = question_type.filter(|v| !v.trim().is_empty());

    match (keyword.is_empty(), question_type) {
        (true, None) => query_question_rows(
            connection,
            &[
                question_select_prefix(),
                " WHERE bank_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3".to_string(),
            ]
            .concat(),
            params![bank_id, safe_limit, safe_offset],
        ),
        (true, Some(qt)) => query_question_rows(
            connection,
            &[
                question_select_prefix(),
                " WHERE bank_id = ?1 AND type = ?2 ORDER BY created_at DESC LIMIT ?3 OFFSET ?4"
                    .to_string(),
            ]
            .concat(),
            params![bank_id, qt, safe_limit, safe_offset],
        ),
        (false, None) => {
            let like_kw = format!("%{keyword}%");
            query_question_rows(
                connection,
                &[
                    question_select_prefix(),
                    " WHERE bank_id = ?1 AND content LIKE ?2 ORDER BY created_at DESC LIMIT ?3 OFFSET ?4".to_string(),
                ]
                .concat(),
                params![bank_id, like_kw, safe_limit, safe_offset],
            )
        }
        (false, Some(qt)) => {
            let like_kw = format!("%{keyword}%");
            query_question_rows(
                connection,
                &[
                    question_select_prefix(),
                    " WHERE bank_id = ?1 AND content LIKE ?2 AND type = ?3 ORDER BY created_at DESC LIMIT ?4 OFFSET ?5".to_string(),
                ]
                .concat(),
                params![bank_id, like_kw, qt, safe_limit, safe_offset],
            )
        }
    }
}

pub fn count_questions(
    connection: &Connection,
    bank_id: i64,
    keyword: &str,
    question_type: Option<&str>,
) -> Result<i64, String> {
    let keyword = keyword.trim();
    let question_type = question_type.filter(|v| !v.trim().is_empty());

    match (keyword.is_empty(), question_type) {
        (true, None) => connection.query_row(
            "SELECT COUNT(*) FROM questions WHERE bank_id = ?1",
            params![bank_id],
            |row| row.get(0),
        ),
        (true, Some(qt)) => connection.query_row(
            "SELECT COUNT(*) FROM questions WHERE bank_id = ?1 AND type = ?2",
            params![bank_id, qt],
            |row| row.get(0),
        ),
        (false, None) => {
            let like_kw = format!("%{keyword}%");
            connection.query_row(
                "SELECT COUNT(*) FROM questions WHERE bank_id = ?1 AND content LIKE ?2",
                params![bank_id, like_kw],
                |row| row.get(0),
            )
        }
        (false, Some(qt)) => {
            let like_kw = format!("%{keyword}%");
            connection.query_row(
                "SELECT COUNT(*) FROM questions WHERE bank_id = ?1 AND content LIKE ?2 AND type = ?3",
                params![bank_id, like_kw, qt],
                |row| row.get(0),
            )
        }
    }
    .map_err(|e| format!("统计题目数量失败: {e}"))
}

pub fn select_question_bank_ids(connection: &Connection, ids: &[i64]) -> Result<Vec<i64>, String> {
    let mut bank_ids = Vec::new();
    let mut stmt = connection
        .prepare("SELECT DISTINCT bank_id FROM questions WHERE id = ?1")
        .map_err(|e| format!("准备题目所属题库查询失败: {e}"))?;
    for id in ids {
        let rows = stmt
            .query_map(params![id], |row| row.get::<_, i64>(0))
            .map_err(|e| format!("查询题目所属题库失败: {e}"))?;
        for row in rows {
            let bank_id = row.map_err(|e| format!("读取题目所属题库失败: {e}"))?;
            if !bank_ids.contains(&bank_id) {
                bank_ids.push(bank_id);
            }
        }
    }
    Ok(bank_ids)
}

// ── Prompt ────────────────────────────────────────────────────────────────────

pub fn find_prompt_by_id(connection: &Connection, id: i64) -> Result<Option<Prompt>, String> {
    connection
        .query_row(
            "SELECT id, name, content, is_default, created_at, updated_at \
             FROM ai_prompts WHERE id = ?1",
            params![id],
            map_prompt,
        )
        .optional()
        .map_err(|e| format!("读取 Prompt 失败: {e}"))
}

pub fn map_prompt(row: &rusqlite::Row<'_>) -> rusqlite::Result<Prompt> {
    Ok(Prompt {
        id: row.get(0)?,
        name: row.get(1)?,
        content: row.get(2)?,
        is_default: row.get::<_, i64>(3)? == 1,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

/// 确保数据库中存在至少一条默认 Prompt。若不存在则插入内置默认。
pub fn ensure_default_prompt(connection: &Connection) -> Result<(), String> {
    let count = connection
        .query_row("SELECT COUNT(*) FROM ai_prompts", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|e| format!("检查默认 Prompt 失败: {e}"))?;

    if count > 0 {
        return Ok(());
    }

    connection
        .execute(
            "INSERT INTO ai_prompts (name, content, is_default, created_at, updated_at) \
             VALUES (?1, ?2, 1, datetime('now'), datetime('now'))",
            params![
                "默认",
                "你是一个智能学习助手，专门帮助用户解答学习相关的问题。\
                 请用简洁清晰的语言回答，必要时可以使用示例说明。"
            ],
        )
        .map_err(|e| format!("创建默认 Prompt 失败: {e}"))?;
    Ok(())
}

// ── 聊天记录 ──────────────────────────────────────────────────────────────────

pub fn find_chat_history_by_id(
    connection: &Connection,
    id: i64,
    include_messages: bool,
) -> Result<Option<ChatHistory>, String> {
    let msg_col = if include_messages { "messages" } else { "NULL" };
    let sql = format!(
        "SELECT id, title, {msg_col}, prompt_id, created_at, updated_at \
         FROM chat_history WHERE id = ?1"
    );
    connection
        .query_row(sql.as_str(), params![id], map_chat_history)
        .optional()
        .map_err(|e| format!("读取聊天记录失败: {e}"))
}

pub fn map_chat_history(row: &rusqlite::Row<'_>) -> rusqlite::Result<ChatHistory> {
    let messages_text: Option<String> = row.get(2)?;
    let messages = messages_text
        .as_deref()
        .and_then(|v| serde_json::from_str(v).ok());
    Ok(ChatHistory {
        id: row.get(0)?,
        title: row.get(1)?,
        messages,
        prompt_id: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

// ── 私有 SQL 构建 helper ───────────────────────────────────────────────────────

fn question_columns_sql() -> &'static str {
    "id, bank_id, type, content, options, answer, analysis, created_at, updated_at"
}

fn by_id_clause_sql() -> &'static str {
    "id = ?1"
}

fn question_select_prefix() -> String {
    format!("SELECT {} FROM questions", question_columns_sql())
}

fn query_question_rows<P>(
    connection: &Connection,
    sql: &str,
    sql_params: P,
) -> Result<Vec<Question>, String>
where
    P: rusqlite::Params,
{
    let mut stmt = connection
        .prepare(sql)
        .map_err(|e| format!("准备题目查询失败: {e}"))?;
    let rows = stmt
        .query_map(sql_params, map_question)
        .map_err(|e| format!("查询题目失败: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取题目结果失败: {e}"))
}
