use crate::database::{
    DatabaseStore, Question, WrongBookCount, WrongBookItem, WrongBookPracticeResult,
};

/// 错题本数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装所有与 `wrong_book` 表相关的 SQL 操作，向 [`crate::services::wrong_book_service::WrongBookService`] 提供纯数据访问接口。
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection` / `Transaction`，消除对 `DatabaseStore` 的依赖。
pub struct WrongBookRepository {
    store: DatabaseStore,
}

impl WrongBookRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 按题库统计错题数量。
    pub fn get_counts_by_bank(&self) -> Result<Vec<WrongBookCount>, String> {
        self.store.get_wrong_book_counts_by_bank()
    }

    /// 统计符合条件的错题总条数。
    pub fn count_items(&self, bank_id: Option<i64>) -> Result<i64, String> {
        self.store.count_wrong_book_items(bank_id)
    }

    /// 分页查询错题列表。
    pub fn get_items(
        &self,
        bank_id: Option<i64>,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<WrongBookItem>, String> {
        self.store.get_wrong_book_items(bank_id, offset, limit)
    }

    /// 随机抽取错题中的原始题目。
    pub fn get_random_questions(
        &self,
        bank_id: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<Question>, String> {
        self.store.get_random_wrong_questions(bank_id, limit)
    }

    /// 读取错题本的"已掌握移除阈值"设置。
    pub fn get_threshold(&self) -> Result<i64, String> {
        self.store.get_wrong_book_threshold()
    }

    /// 原子事务更新：孤儿清理 + 答错 upsert + 答对 correct_count+1 + 达阈值删除。
    ///
    /// 是 `wrong_book_update_from_practice` command 主路径调用的方法。
    pub fn update_from_practice_tx(
        &self,
        results: &[WrongBookPracticeResult],
        remove_threshold: i64,
    ) -> Result<(), String> {
        self.store
            .update_wrong_book_from_practice_tx(results, remove_threshold)
    }

    /// 手动移除单道错题。
    pub fn remove_item(&self, question_id: i64) -> Result<(), String> {
        self.store.remove_wrong_book_item(question_id)
    }

    /// 清空错题本（可选按题库过滤）。
    pub fn clear(&self, bank_id: Option<i64>) -> Result<(), String> {
        self.store.clear_wrong_book(bank_id)
    }

    // ── 细粒度方法（供非事务场景或后续复用）─────────────────────────────────

    /// 清理孤儿错题记录（题目已删除但 wrong_book 仍保留的行）。
    pub fn cleanup_orphans(&self) -> Result<(), String> {
        self.store.cleanup_orphans()
    }

    /// 写入或累加一条答错记录。
    pub fn upsert_wrong_answer(&self, question_id: i64, bank_id: i64) -> Result<(), String> {
        self.store.upsert_wrong_answer(question_id, bank_id)
    }

    /// 将指定题目的 correct_count 加一。
    pub fn increment_correct_count(&self, question_id: i64) -> Result<(), String> {
        self.store.increment_correct_count(question_id)
    }

    /// 查询指定题目的 correct_count；不在错题本中则返回 None。
    pub fn get_correct_count(&self, question_id: i64) -> Result<Option<i64>, String> {
        self.store.get_correct_count(question_id)
    }
}
