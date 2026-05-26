use rusqlite::params;

use super::{
    queries::{
        count_all_questions, count_recent_questions, get_question_count_by_type, map_operation_log,
    },
    types::{DashboardStats, OperationLog, TypeDistribution},
    DatabaseStore,
};

impl DatabaseStore {
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
}
