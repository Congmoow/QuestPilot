use rusqlite::{params, Connection, OptionalExtension};

use super::{
    ChatHistory, OperationLog, PracticeRecord, PracticeRecordInput, PracticeStats, Prompt,
    Question, QuestionBank, TypeDistribution, WrongBookItem,
};

pub(super) fn add_operation_log(
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

pub(super) fn get_setting(connection: &Connection, key: &str) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| ["读取设置失败: ", &error.to_string()].concat())
}

pub(super) fn set_setting(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
    connection
        .execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )
        .map_err(|error| ["保存设置失败: ", &error.to_string()].concat())?;
    Ok(())
}

pub(super) fn find_prompt_by_id(
    connection: &Connection,
    id: i64,
) -> Result<Option<Prompt>, String> {
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

pub(super) fn find_chat_history_by_id(
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

pub(super) fn bank_exists(connection: &Connection, bank_id: i64) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM question_banks WHERE id = ?1)",
            params![bank_id],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value == 1)
        .map_err(|error| format!("检查题库失败: {error}"))
}

pub(super) fn get_bank_by_id(
    connection: &Connection,
    id: i64,
) -> Result<Option<QuestionBank>, String> {
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

pub(super) fn map_question_bank(row: &rusqlite::Row<'_>) -> rusqlite::Result<QuestionBank> {
    Ok(QuestionBank {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        question_count: row.get(5)?,
    })
}

pub(super) fn map_question(row: &rusqlite::Row<'_>) -> rusqlite::Result<Question> {
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

pub(super) fn map_practice_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<PracticeRecord> {
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

pub(super) fn map_practice_stats(row: &rusqlite::Row<'_>) -> rusqlite::Result<PracticeStats> {
    let avg_accuracy = row.get::<_, f64>(3)?.round() as i64;
    Ok(PracticeStats {
        bank_id: row.get(0)?,
        bank_name: row.get(1)?,
        practice_count: row.get(2)?,
        avg_accuracy,
        last_practice: row.get(4)?,
    })
}

pub(super) fn map_operation_log(row: &rusqlite::Row<'_>) -> rusqlite::Result<OperationLog> {
    Ok(OperationLog {
        id: row.get(0)?,
        action: row.get(1)?,
        detail: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
        created_at: row.get(3)?,
    })
}

pub(super) fn map_prompt(row: &rusqlite::Row<'_>) -> rusqlite::Result<Prompt> {
    Ok(Prompt {
        id: row.get(0)?,
        name: row.get(1)?,
        content: row.get(2)?,
        is_default: row.get::<_, i64>(3)? == 1,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

pub(super) fn map_chat_history(row: &rusqlite::Row<'_>) -> rusqlite::Result<ChatHistory> {
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

pub(super) fn find_question_by_id(
    connection: &Connection,
    id: i64,
) -> Result<Option<Question>, String> {
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

pub(super) fn query_questions(
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

pub(super) fn count_questions(
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

pub(super) fn count_all_questions(connection: &Connection) -> Result<i64, String> {
    connection
        .query_row("SELECT COUNT(*) FROM questions", [], |row| row.get(0))
        .map_err(|error| ["统计总题数失败: ", &error.to_string()].concat())
}

pub(super) fn count_recent_questions(connection: &Connection, days: i64) -> Result<i64, String> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM questions WHERE created_at >= datetime('now', ?1)",
            params![[String::from("-"), days.to_string(), String::from(" days")].concat()],
            |row| row.get(0),
        )
        .map_err(|error| ["统计近期题数失败: ", &error.to_string()].concat())
}

pub(super) fn get_question_count_by_type(
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

pub(super) fn select_question_bank_ids(
    connection: &Connection,
    ids: &[i64],
) -> Result<Vec<i64>, String> {
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

pub(super) fn validate_practice_record(record: &PracticeRecordInput) -> Result<(), String> {
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

pub(super) fn cleanup_wrong_book_orphans(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM wrong_book WHERE question_id NOT IN (SELECT id FROM questions)",
            [],
        )
        .map_err(|error| ["清理无效错题失败: ", &error.to_string()].concat())?;
    Ok(())
}

pub(super) fn count_wrong_book_items(
    connection: &Connection,
    bank_id: Option<i64>,
) -> Result<i64, String> {
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

pub(super) fn query_wrong_book_items(
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

pub(super) fn query_random_wrong_questions(
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
