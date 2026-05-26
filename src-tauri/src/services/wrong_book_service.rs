use crate::database::{
    DatabaseStore, Question, WrongBookCount, WrongBookItem, WrongBookPracticeResult,
};
use crate::error::AppError;

/// 错题本业务服务。
///
/// 负责错题本的查询、更新和清除，调用 [`DatabaseStore`] 的数据库方法。
/// Command 层不再直接操作 store，统一经由此 Service 访问。
pub struct WrongBookService {
    store: DatabaseStore,
}

impl WrongBookService {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 按题库统计错题数量。
    pub fn get_counts_by_bank(&self) -> Result<Vec<WrongBookCount>, AppError> {
        Ok(self.store.get_wrong_book_counts_by_bank()?)
    }

    /// 分页获取错题列表，同时返回符合条件的总条数。
    ///
    /// 将两次 DB 调用（数据 + 计数）收口到 Service，避免 Command 层重复持有 store。
    pub fn get_items_paginated(
        &self,
        bank_id: Option<i64>,
        offset: u32,
        limit: u32,
    ) -> Result<(Vec<WrongBookItem>, i64), AppError> {
        let data = self.store.get_wrong_book_items(bank_id, offset, limit)?;
        let total = self.store.count_wrong_book_items(bank_id)?;
        Ok((data, total))
    }

    /// 随机抽取错题中的原始题目。
    pub fn get_random_questions(
        &self,
        bank_id: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<Question>, AppError> {
        Ok(self.store.get_random_wrong_questions(bank_id, limit)?)
    }

    /// 根据练习结果批量更新错题本。
    ///
    /// 业务规则：
    /// - 答错 → 写入 / 累计 wrong_count
    /// - 答对 → 累计 correct_count；达到 threshold 后自动移除
    /// - threshold 优先使用传入值；未传则从 DB 设置读取；最终兜底为 3
    ///
    /// # TODO (Phase 2)
    /// 当前 threshold 判断逻辑与 SQL 操作仍混合在 `DatabaseStore::update_wrong_book_from_practice`。
    /// 后续可拆分为粒度化 DB 方法（`increment_correct_count` / `upsert_wrong_answer`），
    /// 将 threshold 判断循环上移到此处，使 database 层专注纯 SQL 操作。
    pub fn update_from_practice(
        &self,
        results: Vec<WrongBookPracticeResult>,
        threshold: Option<i64>,
    ) -> Result<(), AppError> {
        self.store
            .update_wrong_book_from_practice(results, threshold)?;
        Ok(())
    }

    /// 手动移除单道错题。
    pub fn remove_item(&self, question_id: i64) -> Result<(), AppError> {
        self.store.remove_wrong_book_item(question_id)?;
        Ok(())
    }

    /// 清空错题本（可选按题库过滤）。
    pub fn clear(&self, bank_id: Option<i64>) -> Result<(), AppError> {
        self.store.clear_wrong_book(bank_id)?;
        Ok(())
    }
}
