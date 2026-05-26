use crate::database::{DatabaseStore, PracticeRecord, PracticeRecordInput, PracticeStats};
use crate::error::AppError;

/// 练习记录业务服务。
///
/// 负责练习记录的保存与查询，调用 [`DatabaseStore`] 的数据库方法。
/// Command 层不再直接操作 store，统一经由此 Service 访问。
pub struct PracticeService {
    store: DatabaseStore,
}

impl PracticeService {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 保存一条练习记录。
    pub fn save_record(&self, record: PracticeRecordInput) -> Result<(), AppError> {
        self.store.save_practice_record(record)?;
        Ok(())
    }

    /// 查询某题库的练习记录，按时间倒序返回。
    pub fn get_records(
        &self,
        bank_id: i64,
        limit: Option<u32>,
    ) -> Result<Vec<PracticeRecord>, AppError> {
        Ok(self.store.get_practice_records(bank_id, limit)?)
    }

    /// 查询所有题库的练习统计摘要。
    pub fn get_all_stats(&self) -> Result<Vec<PracticeStats>, AppError> {
        Ok(self.store.get_all_practice_stats()?)
    }
}
