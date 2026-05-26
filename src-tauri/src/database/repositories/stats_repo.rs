use rusqlite::params;

use crate::database::{DashboardStats, DatabaseStore, OperationLog, TypeDistribution};

/// 统计数据访问对象（Phase 2：通过 `DatabaseStore::with_connection` 直接执行 SQL）。
///
/// 封装仪表盘统计、操作日志、题型分布等只读聚合查询。
pub struct StatsRepository {
    store: DatabaseStore,
}

impl StatsRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 查询仪表盘统计数据（题目总数、今日/本周新增、题型分布）。
    pub fn get_dashboard(&self) -> Result<DashboardStats, String> {
        self.store.with_connection(|conn| {
            let total_questions = count_all_questions_sql(conn)?;
            let today_questions = count_recent_questions_sql(conn, 1)?;
            let week_questions = count_recent_questions_sql(conn, 7)?;
            let type_distribution = get_type_distribution_sql(conn, None)?;
            Ok(DashboardStats {
                total_questions,
                today_questions,
                week_questions,
                type_distribution,
            })
        })
    }

    /// 查询操作日志（按时间倒序，`limit` 默认 10，上限 1000）。
    pub fn get_operation_logs(&self, limit: Option<u32>) -> Result<Vec<OperationLog>, String> {
        let safe_limit = i64::from(limit.unwrap_or(10).clamp(1, 1000));
        self.store.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT id, action, detail, created_at \
                     FROM operation_logs \
                     ORDER BY created_at DESC, id DESC \
                     LIMIT ?1",
                )
                .map_err(|e| format!("准备操作日志查询失败: {e}"))?;
            let rows = stmt
                .query_map(params![safe_limit], map_operation_log)
                .map_err(|e| format!("查询操作日志失败: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取操作日志失败: {e}"))
        })
    }

    /// 查询题型分布（`bank_id = None` 时统计全库）。
    pub fn get_type_distribution(
        &self,
        bank_id: Option<i64>,
    ) -> Result<Vec<TypeDistribution>, String> {
        self.store.with_connection(|conn| get_type_distribution_sql(conn, bank_id))
    }
}

// ── 私有 SQL helper ──────────────────────────────────────────────────────────

fn count_all_questions_sql(conn: &rusqlite::Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM questions", [], |row| row.get(0))
        .map_err(|e| format!("统计总题数失败: {e}"))
}

fn count_recent_questions_sql(conn: &rusqlite::Connection, days: i64) -> Result<i64, String> {
    let interval = ["-", &days.to_string(), " days"].concat();
    conn.query_row(
        "SELECT COUNT(*) FROM questions WHERE created_at >= datetime('now', ?1)",
        params![interval],
        |row| row.get(0),
    )
    .map_err(|e| format!("统计近期题数失败: {e}"))
}

fn get_type_distribution_sql(
    conn: &rusqlite::Connection,
    bank_id: Option<i64>,
) -> Result<Vec<TypeDistribution>, String> {
    let mut items = Vec::new();
    if let Some(bid) = bank_id.filter(|v| *v > 0) {
        let mut stmt = conn
            .prepare("SELECT type, COUNT(*) FROM questions WHERE bank_id = ?1 GROUP BY type")
            .map_err(|e| format!("准备题型统计查询失败: {e}"))?;
        let rows = stmt
            .query_map(params![bid], |row| {
                Ok(TypeDistribution { r#type: row.get(0)?, count: row.get(1)? })
            })
            .map_err(|e| format!("查询题型统计失败: {e}"))?;
        for row in rows {
            items.push(row.map_err(|e| format!("读取题型统计失败: {e}"))?);
        }
        return Ok(items);
    }
    let mut stmt = conn
        .prepare("SELECT type, COUNT(*) FROM questions GROUP BY type")
        .map_err(|e| format!("准备题型统计查询失败: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TypeDistribution { r#type: row.get(0)?, count: row.get(1)? })
        })
        .map_err(|e| format!("查询题型统计失败: {e}"))?;
    for row in rows {
        items.push(row.map_err(|e| format!("读取题型统计失败: {e}"))?);
    }
    Ok(items)
}

fn map_operation_log(row: &rusqlite::Row<'_>) -> rusqlite::Result<OperationLog> {
    Ok(OperationLog {
        id: row.get(0)?,
        action: row.get(1)?,
        detail: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
        created_at: row.get(3)?,
    })
}
