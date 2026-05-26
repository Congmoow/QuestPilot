use crate::database::{CreateQuestionInput, DatabaseStore, ImportResult, Question};

/// 题目数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装所有与 `questions` 表相关的 SQL 操作，向 `QuestionService` 和 `ImportService` 提供纯数据访问接口。
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection`，消除对 `DatabaseStore` 的依赖。
pub struct QuestionRepository {
    store: DatabaseStore,
}

impl QuestionRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 创建单道题目（含 bank_exists 校验 + operation_log）。
    pub fn create(&self, bank_id: i64, question: CreateQuestionInput) -> Result<Question, String> {
        self.store.create_question(bank_id, question)
    }

    /// 批量创建题目（含逐题字段校验 + 事务写入）。
    pub fn create_batch(
        &self,
        bank_id: i64,
        questions: Vec<CreateQuestionInput>,
    ) -> Result<ImportResult, String> {
        self.store.create_questions_batch(bank_id, questions)
    }

    /// 分页查询某题库的题目列表。
    pub fn list_by_bank(
        &self,
        bank_id: i64,
        offset: u32,
        limit: u32,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, String> {
        self.store
            .get_questions_by_bank_id(bank_id, offset, limit, question_type)
    }

    /// 随机抽取题目。
    pub fn get_random(
        &self,
        bank_id: i64,
        limit: Option<u32>,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, String> {
        self.store.get_random_questions(bank_id, limit, question_type)
    }

    /// 按 ID 查询单道题目。
    pub fn find_by_id(&self, id: i64) -> Result<Option<Question>, String> {
        self.store.get_question_by_id(id)
    }

    /// 更新题目内容。
    pub fn update(&self, id: i64, question: CreateQuestionInput) -> Result<Option<Question>, String> {
        self.store.update_question(id, question)
    }

    /// 批量删除题目（含级联 wrong_book 清理，由 store 事务保证）。
    pub fn delete_batch(&self, ids: &[i64]) -> Result<(), String> {
        self.store.delete_questions(ids)
    }

    /// 按关键词搜索题目（分页）。
    pub fn search(
        &self,
        bank_id: i64,
        keyword: String,
        question_type: Option<String>,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Question>, String> {
        self.store
            .search_questions(bank_id, keyword, question_type, offset, limit)
    }

    /// 统计符合条件的题目总数。
    pub fn count(
        &self,
        bank_id: i64,
        keyword: String,
        question_type: Option<String>,
    ) -> Result<i64, String> {
        self.store.count_questions(bank_id, keyword, question_type)
    }
}
