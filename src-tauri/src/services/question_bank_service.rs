use crate::database::{
    CreateQuestionBankInput, DatabaseStore, QuestionBank, QuestionBankRepository,
};
use crate::error::AppError;

/// 题库业务服务。
///
/// 负责题库的增删改查，通过 [`QuestionBankRepository`] 访问数据库。
///
/// ## 层次结构
/// `QuestionBankCommand` → `QuestionBankService` → `QuestionBankRepository` → `DatabaseStore` → SQLite
pub struct QuestionBankService {
    repo: QuestionBankRepository,
}

impl QuestionBankService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `QuestionBankRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: QuestionBankRepository::new(store),
        }
    }

    /// 创建题库（含名称校验 + operation_log）。
    pub fn create(&self, data: CreateQuestionBankInput) -> Result<QuestionBank, AppError> {
        Ok(self.repo.create(data)?)
    }

    /// 查询所有题库（按最近更新时间倒序，含题目数量统计）。
    pub fn list_all(&self) -> Result<Vec<QuestionBank>, AppError> {
        Ok(self.repo.list_all()?)
    }

    /// 按 ID 查询题库。
    pub fn get_by_id(&self, id: i64) -> Result<Option<QuestionBank>, AppError> {
        Ok(self.repo.find_by_id(id)?)
    }

    /// 更新题库名称/描述。
    pub fn update(&self, id: i64, data: CreateQuestionBankInput) -> Result<Option<QuestionBank>, AppError> {
        Ok(self.repo.update(id, data)?)
    }

    /// 删除题库（事务内级联删除题目）。
    pub fn delete(&self, id: i64) -> Result<(), AppError> {
        Ok(self.repo.delete(id)?)
    }
}
