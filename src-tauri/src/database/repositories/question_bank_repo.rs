use crate::database::{CreateQuestionBankInput, DatabaseStore, QuestionBank};

/// 题库数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装所有与 `question_banks` 表相关的 SQL 操作，向 `QuestionBankService` 提供纯数据访问接口。
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection`，消除对 `DatabaseStore` 的依赖。
pub struct QuestionBankRepository {
    store: DatabaseStore,
}

impl QuestionBankRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 创建题库（含名称校验 + operation_log）。
    pub fn create(&self, data: CreateQuestionBankInput) -> Result<QuestionBank, String> {
        self.store.create_bank(data)
    }

    /// 查询所有题库，按最近更新时间倒序，含题目数量统计。
    pub fn list_all(&self) -> Result<Vec<QuestionBank>, String> {
        self.store.get_all_banks()
    }

    /// 按 ID 查询题库。
    pub fn find_by_id(&self, id: i64) -> Result<Option<QuestionBank>, String> {
        self.store.get_bank_by_id(id)
    }

    /// 更新题库名称/描述。
    pub fn update(&self, id: i64, data: CreateQuestionBankInput) -> Result<Option<QuestionBank>, String> {
        self.store.update_bank(id, data)
    }

    /// 删除题库（事务内级联删除题目）。
    pub fn delete(&self, id: i64) -> Result<(), String> {
        self.store.delete_bank(id)
    }
}
