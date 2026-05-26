use crate::database::DatabaseStore;

/// 草稿数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装草稿的 SQLite 读写操作（`drafts` 表），向 [`crate::services::draft_service::DraftService`] 提供纯数据访问接口。
/// 草稿使用单行持久化（`id = 1`），是 AI 对话导入场景的暂存机制。
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection`，消除对 `DatabaseStore` 的依赖。
pub struct DraftRepository {
    store: DatabaseStore,
}

impl DraftRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 保存草稿（覆盖已有草稿，`INSERT OR REPLACE`）。
    pub fn save(&self, data: serde_json::Value) -> Result<(), String> {
        self.store.save_draft(data)
    }

    /// 读取草稿（不存在时返回 `None`）。
    pub fn load(&self) -> Result<Option<serde_json::Value>, String> {
        self.store.load_draft()
    }

    /// 清除草稿。
    pub fn clear(&self) -> Result<(), String> {
        self.store.clear_draft()
    }
}
