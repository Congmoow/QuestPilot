use rusqlite::params;

use crate::database::{DatabaseStore, PracticeRecord, PracticeRecordInput, PracticeStats};

/// 练习记录数据访问对象（Phase 2：通过 `DatabaseStore::with_connection` 直接访问
/// `rusqlite::Connection`）。
///
/// 不再委托 `DatabaseStore` 的领域方法，自行持有 SQL 逻辑。
/// `DatabaseStore` 旧方法保留为兼容入口，本 Repository 是新主路径。
///
/// ## 层次关系
/// `PracticeService` → `PracticeRepository` → `DatabaseStore::with_connection`
///                                                 → `rusqlite::Connection`
pub struct PracticeRepository {
    store: DatabaseStore,
}

impl PracticeRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 保存一条练习记录：先做输入校验，再校验题库存在，最后写入并记录操作日志。
    ///
    /// 三条 SQL（EXISTS 检查 + INSERT + 日志 INSERT）在同一次 `with_connection`
    /// 借用内执行，保持与旧 `DatabaseStore::save_practice_record` 行为一致。
    pub fn save_record(&self, record: PracticeRecordInput) -> Result<(), String> {
        // 输入校验放在 with_connection 外，避免无意义的 borrow
        validate_practice_record(&record)?;

        self.store.with_connection(|conn| {
            if !bank_exists_sql(conn, record.bank_id)? {
                return Err("题库不存在".to_string());
            }

            conn.execute(
                "INSERT INTO practice_records \
                   (bank_id, total, correct, wrong, accuracy, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))",
                params![
                    record.bank_id,
                    record.total,
                    record.correct,
                    record.wrong,
                    record.accuracy,
                ],
            )
            .map_err(|e| format!("保存练习记录失败: {e}"))?;

            add_operation_log_sql(conn, "完成练习", format!("正确率: {}%", record.accuracy))
        })
    }

    /// 查询某题库的练习记录，按 `created_at` 倒序返回。
    /// `limit` 默认 20，上限 1000，下限 1。
    pub fn get_records(
        &self,
        bank_id: i64,
        limit: Option<u32>,
    ) -> Result<Vec<PracticeRecord>, String> {
        let safe_limit = i64::from(limit.unwrap_or(20).clamp(1, 1000));

        self.store.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT id, bank_id, total, correct, wrong, accuracy, created_at \
                     FROM practice_records \
                     WHERE bank_id = ?1 \
                     ORDER BY created_at DESC \
                     LIMIT ?2",
                )
                .map_err(|e| format!("准备练习记录查询失败: {e}"))?;
            let rows = stmt
                .query_map(params![bank_id, safe_limit], map_practice_record)
                .map_err(|e| format!("查询练习记录失败: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取练习记录失败: {e}"))
        })
    }

    /// 查询所有题库的练习统计摘要：聚合 count / avg_accuracy / last_practice，
    /// 按最近一次练习时间倒序排列。
    pub fn get_all_stats(&self) -> Result<Vec<PracticeStats>, String> {
        self.store.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT \
                       pr.bank_id, \
                       qb.name AS bank_name, \
                       COUNT(*) AS practice_count, \
                       ROUND(AVG(pr.accuracy)) AS avg_accuracy, \
                       MAX(pr.created_at) AS last_practice \
                     FROM practice_records pr \
                     JOIN question_banks qb ON pr.bank_id = qb.id \
                     GROUP BY pr.bank_id \
                     ORDER BY last_practice DESC",
                )
                .map_err(|e| format!("准备练习统计查询失败: {e}"))?;
            let rows = stmt
                .query_map([], map_practice_stats)
                .map_err(|e| format!("查询练习统计失败: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取练习统计失败: {e}"))
        })
    }
}

// ── 私有 SQL helper（接受 &Connection；与 queries.rs 中原 helper 行为一致）──────

/// 输入校验：不涉及 SQL，纯业务规则，与 `queries::validate_practice_record` 完全一致。
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

/// 检查题库是否存在。
fn bank_exists_sql(conn: &rusqlite::Connection, bank_id: i64) -> Result<bool, String> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM question_banks WHERE id = ?1)",
        params![bank_id],
        |row| row.get::<_, i64>(0),
    )
    .map(|v| v == 1)
    .map_err(|e| format!("检查题库失败: {e}"))
}

/// 写入操作日志一行。
fn add_operation_log_sql(
    conn: &rusqlite::Connection,
    action: &str,
    detail: impl AsRef<str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO operation_logs (action, detail, created_at) \
         VALUES (?1, ?2, datetime('now'))",
        params![action, detail.as_ref()],
    )
    .map_err(|e| format!("写入操作日志失败: {e}"))?;
    Ok(())
}

/// Row mapper：练习记录。
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

/// Row mapper：练习统计摘要（avg_accuracy 来自 ROUND(AVG(...)) 的 f64，按整数返回）。
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
