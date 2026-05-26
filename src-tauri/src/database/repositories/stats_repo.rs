use crate::database::{DashboardStats, DatabaseStore, OperationLog, TypeDistribution};

/// 统计数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装仪表盘统计、操作日志、题型分布等只读聚合查询，向 [`crate::services::stats_service::StatsService`] 提供纯数据访问接口。
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection`，消除对 `DatabaseStore` 的依赖。
pub struct StatsRepository {
    store: DatabaseStore,
}

impl StatsRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 查询仪表盘统计数据（题目总数、今日/本周新增、题型分布）。
    pub fn get_dashboard(&self) -> Result<DashboardStats, String> {
        self.store.get_dashboard_stats()
    }

    /// 查询操作日志（按时间倒序，默认最近 10 条）。
    pub fn get_operation_logs(&self, limit: Option<u32>) -> Result<Vec<OperationLog>, String> {
        self.store.get_operation_logs(limit)
    }

    /// 查询题型分布（可选按题库过滤）。
    pub fn get_type_distribution(
        &self,
        bank_id: Option<i64>,
    ) -> Result<Vec<TypeDistribution>, String> {
        self.store.get_question_count_by_type(bank_id)
    }
}
