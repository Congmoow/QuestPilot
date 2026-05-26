use crate::database::{CreateQuestionInput, DatabaseStore, ImportResult};

/// 题目数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装所有与 `questions` 表相关的 SQL 操作，向 [`crate::services::import_service::ImportService`] 提供纯数据访问接口。
///
/// Phase 1 只暴露 `ImportService` 当前所需的方法（`create_batch`）。
/// 其余方法（`create`、`update`、`delete`、`get_by_id`、`list`）作为 TODO，待后续
/// 将 `commands/question.rs` 中剩余的直接 store 调用迁移进来时补齐。
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

    /// 批量创建题目（含逐题字段校验 + 事务写入）。
    ///
    /// 对应 `DatabaseStore::create_questions_batch`。
    pub fn create_batch(
        &self,
        bank_id: i64,
        questions: Vec<CreateQuestionInput>,
    ) -> Result<ImportResult, String> {
        self.store.create_questions_batch(bank_id, questions)
    }

    // TODO (Phase next): 迁移 commands/question.rs 中的其余直接 store 调用：
    // - create_question       → create()
    // - update_question       → update()
    // - delete_questions      → delete_batch()
    // - get_question_by_id    → find_by_id()
    // - get_questions_by_bank → list_by_bank()
    // - count_questions       → count()
    // - search_questions      → search()
}
