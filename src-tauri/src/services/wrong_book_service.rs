use crate::database::{
    DatabaseStore, Question, WrongBookCount, WrongBookItem, WrongBookPracticeResult,
    WrongBookRepository,
};
use crate::error::AppError;

/// 错题本业务服务。
///
/// 负责错题本的查询、更新和清除，通过 [`WrongBookRepository`] 访问数据库。
/// Command 层不再直接操作 store/repo，统一经由此 Service 访问。
///
/// ## 层次结构
/// `WrongBookCommand` → `WrongBookService` → `WrongBookRepository` → `DatabaseStore` → SQLite
pub struct WrongBookService {
    repo: WrongBookRepository,
}

impl WrongBookService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `WrongBookRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: WrongBookRepository::new(store),
        }
    }

    /// 按题库统计错题数量。
    pub fn get_counts_by_bank(&self) -> Result<Vec<WrongBookCount>, AppError> {
        Ok(self.repo.get_counts_by_bank()?)
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
        let data = self.repo.get_items(bank_id, offset, limit)?;
        let total = self.repo.count_items(bank_id)?;
        Ok((data, total))
    }

    /// 随机抽取错题中的原始题目。
    pub fn get_random_questions(
        &self,
        bank_id: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<Question>, AppError> {
        Ok(self.repo.get_random_questions(bank_id, limit)?)
    }

    /// 根据练习结果批量更新错题本（带事务原子性）。
    ///
    /// ## Service 层职责（此处）
    /// 1. 解析 remove_threshold：传入值 > 0 → 优先用；否则读 DB 设置；最终兜底 3
    /// 2. 将解析好的 threshold 连同 results 传入 Repository 层事务方法
    ///
    /// ## Repository 层职责（`update_from_practice_tx`）
    /// - 在单个 rusqlite 事务内完成全部 SQL 写入
    /// - 孤儿清理 / 答错 upsert / 答对 correct_count+1 / 达阈值删除
    /// - 任一步骤失败则整体回滚，不会留下半成品数据
    pub fn update_from_practice(
        &self,
        results: Vec<WrongBookPracticeResult>,
        threshold: Option<i64>,
    ) -> Result<(), AppError> {
        // Service 层：解析业务阈值（纯业务规则，不涉及 SQL 写入）
        let remove_threshold = threshold
            .filter(|v| *v > 0)
            .or_else(|| self.repo.get_threshold().ok())
            .unwrap_or(3);

        // Repository 层：原子事务写入
        self.repo
            .update_from_practice_tx(&results, remove_threshold)?;

        Ok(())
    }

    /// 手动移除单道错题。
    pub fn remove_item(&self, question_id: i64) -> Result<(), AppError> {
        self.repo.remove_item(question_id)?;
        Ok(())
    }

    /// 清空错题本（可选按题库过滤）。
    pub fn clear(&self, bank_id: Option<i64>) -> Result<(), AppError> {
        self.repo.clear(bank_id)?;
        Ok(())
    }
}
