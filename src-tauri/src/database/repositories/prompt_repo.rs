use crate::database::{CreatePromptInput, DatabaseStore, Prompt};

/// Prompt 数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装所有与 `ai_prompts` 表相关的 SQL 操作，向 [`crate::services::prompt_service::PromptService`] 提供纯数据访问接口。
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection`，消除对 `DatabaseStore` 的依赖。
pub struct PromptRepository {
    store: DatabaseStore,
}

impl PromptRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 查询所有 Prompt（默认 Prompt 优先，其余按创建时间倒序）。
    pub fn list_all(&self) -> Result<Vec<Prompt>, String> {
        self.store.get_all_prompts()
    }

    /// 按 ID 查询单条 Prompt。
    pub fn find_by_id(&self, id: i64) -> Result<Option<Prompt>, String> {
        self.store.get_prompt_by_id(id)
    }

    /// 创建 Prompt（含名称/内容非空校验 + operation_log）。
    pub fn create(&self, data: CreatePromptInput) -> Result<Prompt, String> {
        self.store.create_prompt(data)
    }

    /// 更新 Prompt 名称/内容。
    pub fn update(&self, id: i64, data: CreatePromptInput) -> Result<Option<Prompt>, String> {
        self.store.update_prompt(id, data)
    }

    /// 删除 Prompt（不能删除默认 Prompt）。
    pub fn delete(&self, id: i64) -> Result<(), String> {
        self.store.delete_prompt(id)
    }
}
