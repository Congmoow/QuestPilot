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
    /// 业务规则（完整在 Service 层编排）：
    /// 1. 解析 remove_threshold：传入值 > 0 → 优先用；否则读 DB 设置；最终兜底 3
    /// 2. 清理孤儿记录（题目已删除但错题本仍保留的行）
    /// 3. 跳过 question_id ≤ 0 或 bank_id ≤ 0 的无效条目
    /// 4. 答错 → `upsert_wrong_answer`：新增或累加 wrong_count
    /// 5. 答对 → `increment_correct_count`；再读 `get_correct_count`；
    ///    若 correct_count ≥ threshold → `remove_wrong_book_item` 移除
    ///
    /// # TODO (Phase 3)
    /// 当前各条目独立执行 SQL，中途失败可能造成部分更新。
    /// 后续可将整个循环包裹在 rusqlite transaction 中以保证原子性，
    /// 但需解决 `RefCell<Connection>` 的借用生命周期问题（需 `borrow_mut` 持有事务）。
    pub fn update_from_practice(
        &self,
        results: Vec<WrongBookPracticeResult>,
        threshold: Option<i64>,
    ) -> Result<(), AppError> {
        // 解析移除阈值
        let remove_threshold = threshold
            .filter(|v| *v > 0)
            .or_else(|| self.store.get_wrong_book_threshold().ok())
            .unwrap_or(3);

        // 清理孤儿错题记录
        self.store.cleanup_orphans()?;

        for result in results {
            // 跳过无效 ID
            if result.question_id <= 0 || result.bank_id <= 0 {
                continue;
            }

            if result.is_correct {
                // 累加答对次数
                self.store.increment_correct_count(result.question_id)?;

                // 达到阈值则移除（已掌握）
                let correct_count = self.store.get_correct_count(result.question_id)?;
                if matches!(correct_count, Some(v) if v >= remove_threshold) {
                    self.store.remove_wrong_book_item(result.question_id)?;
                }
            } else {
                // 新增或累加答错记录
                self.store
                    .upsert_wrong_answer(result.question_id, result.bank_id)?;
            }
        }

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
