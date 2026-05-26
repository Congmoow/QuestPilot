use rusqlite::params;

use super::{
    queries::{
        add_operation_log, bank_exists, map_practice_record, map_practice_stats,
        validate_practice_record,
    },
    types::{PracticeRecord, PracticeRecordInput, PracticeStats},
    DatabaseStore,
};

impl DatabaseStore {
    /// 兼容入口保留；新主路径由 [`PracticeRepository::save_record`] 直接访问 Connection。
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

    /// 兼容入口保留；新主路径由 [`PracticeRepository::get_records`] 直接访问 Connection。
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

    /// 兼容入口保留；新主路径由 [`PracticeRepository::get_all_stats`] 直接访问 Connection。
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
}
