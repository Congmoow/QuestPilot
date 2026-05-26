use crate::database::{
    DatabaseStore, PracticeRecord, PracticeRecordInput, PracticeRepository, PracticeStats,
};
use crate::error::AppError;

/// 练习记录业务服务。
///
/// 负责练习记录的保存与查询，通过 [`PracticeRepository`] 访问数据库。
/// Command 层不再直接操作 store/repo，统一经由此 Service 访问。
///
/// ## 层次结构
/// `PracticeCommand` → `PracticeService` → `PracticeRepository` → `DatabaseStore` → SQLite
pub struct PracticeService {
    repo: PracticeRepository,
}

impl PracticeService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `PracticeRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: PracticeRepository::new(store),
        }
    }

    /// 保存一条练习记录。
    pub fn save_record(&self, record: PracticeRecordInput) -> Result<(), AppError> {
        self.repo.save_record(record)?;
        Ok(())
    }

    /// 查询某题库的练习记录，按时间倒序返回。
    pub fn get_records(
        &self,
        bank_id: i64,
        limit: Option<u32>,
    ) -> Result<Vec<PracticeRecord>, AppError> {
        Ok(self.repo.get_records(bank_id, limit)?)
    }

    /// 查询所有题库的练习统计摘要。
    pub fn get_all_stats(&self) -> Result<Vec<PracticeStats>, AppError> {
        Ok(self.repo.get_all_stats()?)
    }
}
