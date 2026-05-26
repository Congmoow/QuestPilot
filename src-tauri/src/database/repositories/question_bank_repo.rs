use crate::database::DatabaseStore;

/// 题库数据访问对象骨架（Phase 1：尚无 service 直接依赖，仅建立结构）。
///
/// Phase 1 无任何 service 直接依赖此 Repository，故只建骨架。
/// 当 `commands/question_bank.rs` 的直接 store 调用被迁移进 service 层后，
/// 在此处补齐具体方法。
///
/// ## 演进路径
/// Phase 1：空骨架，`store` 字段标注 `#[allow(dead_code)]`。
/// Phase next：补齐 `list`、`find_by_id`、`create`、`update`、`delete` 方法，
///   并将对应 service 的依赖从 `DatabaseStore` 切换到此 Repository。
pub struct QuestionBankRepository {
    #[allow(dead_code)]
    store: DatabaseStore,
}

impl QuestionBankRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    // TODO (Phase next): 迁移 commands/question_bank.rs 中的直接 store 调用：
    // - list()          → store.get_all_banks()
    // - find_by_id()    → store.get_bank_by_id()
    // - create()        → store.create_bank()
    // - update()        → store.update_bank()
    // - delete()        → store.delete_bank()
}
