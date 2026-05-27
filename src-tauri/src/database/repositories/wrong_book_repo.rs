use rusqlite::{params, OptionalExtension};

use crate::database::{
    DatabaseStore, Question, WrongBookCount, WrongBookItem, WrongBookPracticeResult,
};

/// 错题本数据访问对象（Phase 2 试点：通过 `DatabaseStore::with_connection` /
/// `with_transaction` 直接访问 `rusqlite::Connection` / `Transaction`）。
///
/// 不再委托 `DatabaseStore` 的领域方法，自行持有 SQL 逻辑。
/// `DatabaseStore` 旧方法保留为兼容入口，本 Repository 是新主路径。
///
/// ## 层次关系
/// `WrongBookService` → `WrongBookRepository` → `DatabaseStore::with_connection/with_transaction`
///                                                     → `rusqlite::Connection`/`Transaction`
pub struct WrongBookRepository {
    store: DatabaseStore,
}

impl WrongBookRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 按题库统计错题数量（先清理孤儿记录）。
    pub fn get_counts_by_bank(&self) -> Result<Vec<WrongBookCount>, String> {
        self.store.with_connection(|conn| {
            cleanup_orphans_sql(conn)?;
            let mut stmt = conn
                .prepare("SELECT bank_id, COUNT(*) AS count FROM wrong_book GROUP BY bank_id")
                .map_err(|e| format!("准备错题统计查询失败: {e}"))?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(WrongBookCount {
                        bank_id: row.get(0)?,
                        count: row.get(1)?,
                    })
                })
                .map_err(|e| format!("查询错题统计失败: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取错题统计失败: {e}"))
        })
    }

    /// 统计符合条件的错题总条数（先清理孤儿记录）。
    pub fn count_items(&self, bank_id: Option<i64>) -> Result<i64, String> {
        self.store.with_connection(|conn| {
            cleanup_orphans_sql(conn)?;
            count_items_sql(conn, bank_id)
        })
    }

    /// 分页查询错题列表（先清理孤儿记录）。
    pub fn get_items(
        &self,
        bank_id: Option<i64>,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<WrongBookItem>, String> {
        self.store.with_connection(|conn| {
            cleanup_orphans_sql(conn)?;
            query_items_sql(conn, bank_id, offset, limit)
        })
    }

    /// 随机抽取错题中的原始题目（先清理孤儿记录）。
    pub fn get_random_questions(
        &self,
        bank_id: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<Question>, String> {
        self.store.with_connection(|conn| {
            cleanup_orphans_sql(conn)?;
            query_random_questions_sql(conn, bank_id, limit)
        })
    }

    /// 读取错题本的"已掌握移除阈值"设置；无设置或无效值时返回默认值 3。
    pub fn get_threshold(&self) -> Result<i64, String> {
        self.store.with_connection(|conn| {
            let raw: Option<String> = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'wrong_book_threshold'",
                    [],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| format!("读取阈值设置失败: {e}"))?;
            let threshold = raw
                .and_then(|v| v.parse::<i64>().ok())
                .filter(|v| *v > 0)
                .unwrap_or(3);
            Ok(threshold)
        })
    }

    /// 原子事务更新：孤儿清理 + 答错 upsert + 答对 correct_count+1 + 达阈值删除。
    ///
    /// 通过 `DatabaseStore::with_transaction` 直接使用 `rusqlite::Transaction`，
    /// 无需再调用任何 `self.store.*` 领域方法（避免 RefCell 重复借用）。
    pub fn update_from_practice_tx(
        &self,
        results: &[WrongBookPracticeResult],
        remove_threshold: i64,
    ) -> Result<(), String> {
        self.store.with_transaction(|tx| {
            // 1. 清理孤儿记录（Transaction: Deref<Target=Connection>，满足函数签名）
            cleanup_orphans_sql(tx)?;

            for result in results {
                // 2. 跳过无效 id
                if result.question_id <= 0 || result.bank_id <= 0 {
                    continue;
                }

                if result.is_correct {
                    // 3. 答对：correct_count + 1
                    tx.execute(
                        "UPDATE wrong_book SET correct_count = correct_count + 1 \
                         WHERE question_id = ?1",
                        params![result.question_id],
                    )
                    .map_err(|e| format!("更新错题正确次数失败: {e}"))?;

                    // 4. 查询当前 correct_count
                    let correct_count: Option<i64> = tx
                        .query_row(
                            "SELECT correct_count FROM wrong_book WHERE question_id = ?1",
                            params![result.question_id],
                            |row| row.get(0),
                        )
                        .optional()
                        .map_err(|e| format!("读取错题正确次数失败: {e}"))?;

                    // 5. 达到阈值则删除
                    if matches!(correct_count, Some(v) if v >= remove_threshold) {
                        tx.execute(
                            "DELETE FROM wrong_book WHERE question_id = ?1",
                            params![result.question_id],
                        )
                        .map_err(|e| format!("移除已掌握错题失败: {e}"))?;
                    }
                } else {
                    // 6. 答错：INSERT 或累加 wrong_count
                    tx.execute(
                        "INSERT INTO wrong_book \
                           (question_id, bank_id, wrong_count, correct_count, added_at, last_wrong_at) \
                         VALUES (?1, ?2, 1, 0, datetime('now'), datetime('now')) \
                         ON CONFLICT(question_id) DO UPDATE SET \
                           bank_id       = excluded.bank_id, \
                           wrong_count   = wrong_count + 1, \
                           last_wrong_at = datetime('now')",
                        params![result.question_id, result.bank_id],
                    )
                    .map_err(|e| format!("写入错题本失败: {e}"))?;
                }
            }
            Ok(())
        })
    }

    /// 手动移除单道错题。
    pub fn remove_item(&self, question_id: i64) -> Result<(), String> {
        self.store.with_connection(|conn| {
            conn.execute(
                "DELETE FROM wrong_book WHERE question_id = ?1",
                params![question_id],
            )
            .map_err(|e| format!("移除错题失败: {e}"))?;
            Ok(())
        })
    }

    /// 清空错题本（可选按题库过滤），写入操作日志。
    pub fn clear(&self, bank_id: Option<i64>) -> Result<(), String> {
        self.store.with_connection(|conn| {
            if let Some(bid) = bank_id.filter(|v| *v > 0) {
                conn.execute("DELETE FROM wrong_book WHERE bank_id = ?1", params![bid])
                    .map_err(|e| format!("清空题库错题失败: {e}"))?;
                conn.execute(
                    "INSERT INTO operation_logs (action, detail, created_at) \
                     VALUES (?1, ?2, datetime('now'))",
                    params!["清空错题本", format!("清空题库 {bid} 的错题")],
                )
                .map_err(|e| format!("写入操作日志失败: {e}"))?;
            } else {
                conn.execute("DELETE FROM wrong_book", [])
                    .map_err(|e| format!("清空错题本失败: {e}"))?;
                conn.execute(
                    "INSERT INTO operation_logs (action, detail, created_at) \
                     VALUES (?1, ?2, datetime('now'))",
                    params!["清空错题本", "清空全部错题"],
                )
                .map_err(|e| format!("写入操作日志失败: {e}"))?;
            }
            Ok(())
        })
    }

    // ── 细粒度方法（供非事务场景或后续复用）─────────────────────────────────

    /// 清理孤儿错题记录（题目已删除但 wrong_book 仍保留的行）。
    pub fn cleanup_orphans(&self) -> Result<(), String> {
        self.store.with_connection(|conn| cleanup_orphans_sql(conn))
    }

    /// 写入或累加一条答错记录。
    pub fn upsert_wrong_answer(&self, question_id: i64, bank_id: i64) -> Result<(), String> {
        self.store.with_connection(|conn| {
            conn.execute(
                "INSERT INTO wrong_book \
                   (question_id, bank_id, wrong_count, correct_count, added_at, last_wrong_at) \
                 VALUES (?1, ?2, 1, 0, datetime('now'), datetime('now')) \
                 ON CONFLICT(question_id) DO UPDATE SET \
                   bank_id       = excluded.bank_id, \
                   wrong_count   = wrong_count + 1, \
                   last_wrong_at = datetime('now')",
                params![question_id, bank_id],
            )
            .map_err(|e| format!("写入错题本失败: {e}"))?;
            Ok(())
        })
    }

    /// 将指定题目的 correct_count 加一。
    pub fn increment_correct_count(&self, question_id: i64) -> Result<(), String> {
        self.store.with_connection(|conn| {
            conn.execute(
                "UPDATE wrong_book SET correct_count = correct_count + 1 \
                 WHERE question_id = ?1",
                params![question_id],
            )
            .map_err(|e| format!("更新错题正确次数失败: {e}"))?;
            Ok(())
        })
    }

    /// 查询指定题目的 correct_count；不在错题本中则返回 None。
    pub fn get_correct_count(&self, question_id: i64) -> Result<Option<i64>, String> {
        self.store.with_connection(|conn| {
            conn.query_row(
                "SELECT correct_count FROM wrong_book WHERE question_id = ?1",
                params![question_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|e| format!("读取错题正确次数失败: {e}"))
        })
    }
}

// ── 私有 SQL helper（接受 &Connection，Transaction 通过 Deref 自动满足）────────

/// 清理孤儿错题记录（题目已被删除但 wrong_book 仍保留的行）。
fn cleanup_orphans_sql(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute(
        "DELETE FROM wrong_book WHERE question_id NOT IN (SELECT id FROM questions)",
        [],
    )
    .map_err(|e| format!("清理无效错题失败: {e}"))?;
    Ok(())
}

/// 统计符合条件的错题总条数。
fn count_items_sql(conn: &rusqlite::Connection, bank_id: Option<i64>) -> Result<i64, String> {
    if let Some(bid) = bank_id.filter(|v| *v > 0) {
        return conn
            .query_row(
                "SELECT COUNT(*) FROM wrong_book WHERE bank_id = ?1",
                params![bid],
                |row| row.get(0),
            )
            .map_err(|e| format!("统计错题数量失败: {e}"));
    }
    conn.query_row("SELECT COUNT(*) FROM wrong_book", [], |row| row.get(0))
        .map_err(|e| format!("统计错题数量失败: {e}"))
}

/// 分页查询错题列表（含关联题目信息）。
fn query_items_sql(
    conn: &rusqlite::Connection,
    bank_id: Option<i64>,
    offset: u32,
    limit: u32,
) -> Result<Vec<WrongBookItem>, String> {
    let safe_limit = i64::from(limit.clamp(1, 1000));
    let safe_offset = i64::from(offset);
    let sql = wrong_book_select_sql(bank_id);
    let mut stmt = conn
        .prepare(sql.as_str())
        .map_err(|e| format!("准备错题列表查询失败: {e}"))?;

    if let Some(bid) = bank_id.filter(|v| *v > 0) {
        let rows = stmt
            .query_map(params![bid, safe_limit, safe_offset], map_wrong_book_item)
            .map_err(|e| format!("查询错题列表失败: {e}"))?;
        return rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取错题列表失败: {e}"));
    }
    let rows = stmt
        .query_map(params![safe_limit, safe_offset], map_wrong_book_item)
        .map_err(|e| format!("查询错题列表失败: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取错题列表失败: {e}"))
}

/// 随机抽取错题（via JOIN）。
fn query_random_questions_sql(
    conn: &rusqlite::Connection,
    bank_id: Option<i64>,
    limit: Option<u32>,
) -> Result<Vec<Question>, String> {
    let safe_limit = i64::from(limit.unwrap_or(20).clamp(1, 1000));
    let base = "SELECT q.id, q.bank_id, q.type, q.content, q.options, \
                       q.answer, q.analysis, q.created_at, q.updated_at \
                FROM wrong_book wb JOIN questions q ON wb.question_id = q.id";
    if let Some(bid) = bank_id.filter(|v| *v > 0) {
        let sql = format!("{base} WHERE wb.bank_id = ?1 ORDER BY RANDOM() LIMIT ?2");
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("准备随机错题查询失败: {e}"))?;
        let rows = stmt
            .query_map(params![bid, safe_limit], map_question)
            .map_err(|e| format!("查询随机错题失败: {e}"))?;
        return rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取随机错题失败: {e}"));
    }
    let sql = format!("{base} ORDER BY RANDOM() LIMIT ?1");
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("准备随机错题查询失败: {e}"))?;
    let rows = stmt
        .query_map(params![safe_limit], map_question)
        .map_err(|e| format!("查询随机错题失败: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取随机错题失败: {e}"))
}

/// 生成分页错题查询 SQL（bank_id 可选）。
fn wrong_book_select_sql(bank_id: Option<i64>) -> String {
    let mut sql = String::from(
        "SELECT wb.question_id, wb.bank_id, wb.wrong_count, wb.correct_count, \
                wb.added_at, wb.last_wrong_at, \
                q.id, q.bank_id, q.type, q.content, q.options, \
                q.answer, q.analysis, q.created_at, q.updated_at \
         FROM wrong_book wb JOIN questions q ON wb.question_id = q.id",
    );
    if matches!(bank_id, Some(v) if v > 0) {
        sql.push_str(" WHERE wb.bank_id = ?1 ORDER BY wb.last_wrong_at DESC LIMIT ?2 OFFSET ?3");
    } else {
        sql.push_str(" ORDER BY wb.last_wrong_at DESC LIMIT ?1 OFFSET ?2");
    }
    sql
}

/// Row mapper：题目。
fn map_question(row: &rusqlite::Row<'_>) -> rusqlite::Result<Question> {
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

/// Row mapper：错题本条目（含嵌套题目）。
fn map_wrong_book_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<WrongBookItem> {
    let options_text: Option<String> = row.get(10)?;
    let options = options_text
        .as_deref()
        .and_then(|v| serde_json::from_str(v).ok());
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
