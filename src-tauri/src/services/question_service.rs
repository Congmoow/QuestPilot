use crate::database::{
    CreateQuestionInput, DatabaseStore, Question, QuestionRepository,
};
use crate::error::AppError;

/// 题目业务服务。
///
/// 负责题目的增删改查与搜索，通过 [`QuestionRepository`] 访问数据库。
/// 分页协调（两次 DB 调用合并）在 Service 层完成，Command 层只做参数解析。
///
/// ## 层次结构
/// `QuestionCommand` → `QuestionService` → `QuestionRepository` → `DatabaseStore` → SQLite
pub struct QuestionService {
    repo: QuestionRepository,
}

impl QuestionService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `QuestionRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: QuestionRepository::new(store),
        }
    }

    /// 创建单道题目。
    pub fn create(&self, bank_id: i64, data: CreateQuestionInput) -> Result<Question, AppError> {
        Ok(self.repo.create(bank_id, data)?)
    }

    /// 分页查询题库题目，返回 `(data, total)`，由 Command 层组装分页结构。
    pub fn get_by_bank_paginated(
        &self,
        bank_id: i64,
        offset: u32,
        limit: u32,
        question_type: Option<String>,
    ) -> Result<(Vec<Question>, i64), AppError> {
        let data = self.repo.list_by_bank(bank_id, offset, limit, question_type.clone())?;
        let total = self.repo.count(bank_id, String::new(), question_type)?;
        Ok((data, total))
    }

    /// 随机抽取题目。
    pub fn get_random(
        &self,
        bank_id: i64,
        limit: Option<u32>,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, AppError> {
        Ok(self.repo.get_random(bank_id, limit, question_type)?)
    }

    /// 按 ID 查询单道题目。
    pub fn get_by_id(&self, id: i64) -> Result<Option<Question>, AppError> {
        Ok(self.repo.find_by_id(id)?)
    }

    /// 更新题目内容。
    pub fn update(&self, id: i64, data: CreateQuestionInput) -> Result<Option<Question>, AppError> {
        Ok(self.repo.update(id, data)?)
    }

    /// 批量删除题目。
    ///
    /// 业务规则：`ids` 为空时返回错误（需选择题目）。
    pub fn delete(&self, ids: &[i64]) -> Result<(), AppError> {
        if ids.is_empty() {
            return Err(AppError::Database("请选择要删除的题目".into()));
        }
        Ok(self.repo.delete_batch(ids)?)
    }

    /// 搜索题目（分页），返回 `(data, total)`，由 Command 层组装分页结构。
    pub fn search_paginated(
        &self,
        bank_id: i64,
        keyword: String,
        offset: u32,
        limit: u32,
        question_type: Option<String>,
    ) -> Result<(Vec<Question>, i64), AppError> {
        let data = self
            .repo
            .search(bank_id, keyword.clone(), question_type.clone(), offset, limit)?;
        let total = self.repo.count(bank_id, keyword, question_type)?;
        Ok((data, total))
    }
}
