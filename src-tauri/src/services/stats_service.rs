use crate::database::{DashboardStats, DatabaseStore, OperationLog, StatsRepository, TypeDistribution};
use crate::error::AppError;

/// 统计业务服务。
///
/// 负责仪表盘统计、操作日志、题型分布的查询，通过 [`StatsRepository`] 访问数据库。
///
/// ## 层次结构
/// `StatsCommand` → `StatsService` → `StatsRepository` → `DatabaseStore` → SQLite
pub struct StatsService {
    repo: StatsRepository,
}

impl StatsService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `StatsRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: StatsRepository::new(store),
        }
    }

    /// 查询仪表盘统计数据。
    pub fn get_dashboard(&self) -> Result<DashboardStats, AppError> {
        Ok(self.repo.get_dashboard()?)
    }

    /// 查询操作日志。
    pub fn get_operation_logs(&self, limit: Option<u32>) -> Result<Vec<OperationLog>, AppError> {
        Ok(self.repo.get_operation_logs(limit)?)
    }

    /// 查询题型分布（可选按题库过滤）。
    pub fn get_type_distribution(
        &self,
        bank_id: Option<i64>,
    ) -> Result<Vec<TypeDistribution>, AppError> {
        Ok(self.repo.get_type_distribution(bank_id)?)
    }
}
