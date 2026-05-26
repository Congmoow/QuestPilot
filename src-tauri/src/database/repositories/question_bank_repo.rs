use rusqlite::{params, OptionalExtension};

use crate::database::{CreateQuestionBankInput, DatabaseStore, QuestionBank};

/// 题库数据访问对象（Phase 2：通过 `DatabaseStore::with_connection` /
/// `with_transaction` 直接访问 `rusqlite::Connection` / `Transaction`）。
///
/// 不再委托 `DatabaseStore` 的领域方法，自行持有 SQL 逻辑。
/// `DatabaseStore` 旧方法保留为兼容入口，本 Repository 是新主路径。
///
/// ## 层次关系
/// `QuestionBankService` → `QuestionBankRepository` → `DatabaseStore::with_connection/with_transaction`
///                                                          → `rusqlite::Connection`/`Transaction`
pub struct QuestionBankRepository {
    store: DatabaseStore,
}

impl QuestionBankRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 创建题库：名称校验 → INSERT → 写操作日志 → 返回完整题库记录（含题目数量）。
    pub fn create(&self, data: CreateQuestionBankInput) -> Result<QuestionBank, String> {
        let name = validate_bank_name(&data.name)?;
        let description = normalize_description(data.description);

        self.store.with_connection(|conn| {
            conn.execute(
                "INSERT INTO question_banks (name, description, created_at, updated_at) \
                 VALUES (?1, ?2, datetime('now'), datetime('now'))",
                params![name.as_str(), description.as_deref()],
            )
            .map_err(|e| format!("创建题库失败: {e}"))?;

            let id = conn.last_insert_rowid();
            add_operation_log_sql(conn, "创建题库", format!("创建题库: {name}"))?;
            get_bank_by_id_sql(conn, id)?.ok_or_else(|| "创建题库后读取失败".to_string())
        })
    }

    /// 查询所有题库：LEFT JOIN questions 统计题目数量，按 `updated_at` 倒序。
    pub fn list_all(&self) -> Result<Vec<QuestionBank>, String> {
        self.store.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT qb.id, qb.name, qb.description, qb.created_at, qb.updated_at, \
                            COUNT(q.id) AS question_count \
                     FROM question_banks qb \
                     LEFT JOIN questions q ON qb.id = q.bank_id \
                     GROUP BY qb.id \
                     ORDER BY qb.updated_at DESC",
                )
                .map_err(|e| format!("准备题库查询失败: {e}"))?;
            let rows = stmt
                .query_map([], map_question_bank)
                .map_err(|e| format!("查询题库失败: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取题库结果失败: {e}"))
        })
    }

    /// 按 ID 查询题库；不存在则返回 `None`。
    pub fn find_by_id(&self, id: i64) -> Result<Option<QuestionBank>, String> {
        self.store.with_connection(|conn| get_bank_by_id_sql(conn, id))
    }

    /// 更新题库名称/描述：名称校验 → UPDATE → 写操作日志 → 返回更新后记录。
    /// 若 ID 不存在则返回 `None`。
    pub fn update(&self, id: i64, data: CreateQuestionBankInput) -> Result<Option<QuestionBank>, String> {
        let name = validate_bank_name(&data.name)?;
        let description = normalize_description(data.description);

        self.store.with_connection(|conn| {
            conn.execute(
                "UPDATE question_banks \
                 SET name = ?1, description = ?2, updated_at = datetime('now') \
                 WHERE id = ?3",
                params![name.as_str(), description.as_deref(), id],
            )
            .map_err(|e| format!("更新题库失败: {e}"))?;

            add_operation_log_sql(conn, "更新题库", format!("更新题库: {name}"))?;
            get_bank_by_id_sql(conn, id)
        })
    }

    /// 删除题库：在单个事务内先删除题目、再删除题库，提交后写操作日志。
    ///
    /// - 事务内：`DELETE FROM questions WHERE bank_id = ?` 然后 `DELETE FROM question_banks WHERE id = ?`
    /// - 事务外：写 `operation_logs`（原行为：事务 commit 后同一连接写日志）
    /// - `wrong_book` 孤儿记录由 `WrongBookRepository` 的 cleanup 机制延迟清理（原行为）
    /// - `practice_records` 孤儿行保留作历史（原行为）
    pub fn delete(&self, id: i64) -> Result<(), String> {
        // Phase 1：原子事务删除题目 + 题库
        self.store.with_transaction(|tx| {
            tx.execute("DELETE FROM questions WHERE bank_id = ?1", params![id])
                .map_err(|e| format!("删除题库题目失败: {e}"))?;
            tx.execute("DELETE FROM question_banks WHERE id = ?1", params![id])
                .map_err(|e| format!("删除题库失败: {e}"))?;
            Ok(())
        })?;
        // Phase 2：事务提交后写操作日志（with_transaction 释放 borrow_mut 后可再 borrow）
        self.store.with_connection(|conn| {
            add_operation_log_sql(conn, "删除题库", format!("删除题库 ID: {id}"))
        })
    }
}

// ── 私有 SQL helper（接受 &Connection；行为与对应 queries.rs / validation.rs 函数一致）

/// 题库名称校验：去空格、不能为空、最多 50 字符。
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

/// 题库描述归一化：去空格后为空则返回 `None`。
fn normalize_description(description: Option<String>) -> Option<String> {
    description.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
    })
}

/// 写入操作日志一行。
fn add_operation_log_sql(
    conn: &rusqlite::Connection,
    action: &str,
    detail: impl AsRef<str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO operation_logs (action, detail, created_at) VALUES (?1, ?2, datetime('now'))",
        params![action, detail.as_ref()],
    )
    .map_err(|e| format!("写入操作日志失败: {e}"))?;
    Ok(())
}

/// 按 ID 查询题库（含题目数量 JOIN），不存在返回 `None`。
fn get_bank_by_id_sql(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<Option<QuestionBank>, String> {
    conn.query_row(
        "SELECT qb.id, qb.name, qb.description, qb.created_at, qb.updated_at, \
                COUNT(q.id) AS question_count \
         FROM question_banks qb \
         LEFT JOIN questions q ON qb.id = q.bank_id \
         WHERE qb.id = ?1 \
         GROUP BY qb.id",
        params![id],
        map_question_bank,
    )
    .optional()
    .map_err(|e| format!("读取题库失败: {e}"))
}

/// Row mapper：题库记录（含 question_count）。
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
