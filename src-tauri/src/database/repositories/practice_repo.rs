use crate::database::{DatabaseStore, PracticeRecord, PracticeRecordInput, PracticeStats};

/// 练习记录数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装所有与 `practice_records` 表相关的 SQL 操作，向 [`crate::services::practice_service::PracticeService`] 提供纯数据访问接口。
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection`，消除对 `DatabaseStore` 的依赖。
pub struct PracticeRepository {
    store: DatabaseStore,
}

impl PracticeRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 保存一条练习记录（含 bank_exists 校验 + operation_log）。
    pub fn save_record(&self, record: PracticeRecordInput) -> Result<(), String> {
        self.store.save_practice_record(record)
    }

    /// 查询某题库的练习记录，按时间倒序返回。
    pub fn get_records(
        &self,
        bank_id: i64,
        limit: Option<u32>,
    ) -> Result<Vec<PracticeRecord>, String> {
        self.store.get_practice_records(bank_id, limit)
    }

    /// 查询所有题库的练习统计摘要。
    pub fn get_all_stats(&self) -> Result<Vec<PracticeStats>, String> {
        self.store.get_all_practice_stats()
    }
}
