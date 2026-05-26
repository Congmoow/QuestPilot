use crate::database::{ChatHistory, ChatHistoryInput, DatabaseStore};

/// 聊天记录数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装所有与 `chat_history` 表相关的 SQL 操作，向 [`crate::services::chat_history_service::ChatHistoryService`] 提供纯数据访问接口。
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection`，消除对 `DatabaseStore` 的依赖。
pub struct ChatHistoryRepository {
    store: DatabaseStore,
}

impl ChatHistoryRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 保存一条新聊天记录（含消息格式校验）。
    pub fn save(&self, data: ChatHistoryInput) -> Result<ChatHistory, String> {
        self.store.save_chat_history(data)
    }

    /// 更新聊天记录消息内容。
    pub fn update(&self, id: i64, messages: serde_json::Value) -> Result<Option<ChatHistory>, String> {
        self.store.update_chat_history(id, messages)
    }

    /// 查询聊天记录列表（不含消息体，按最近更新倒序）。
    pub fn list_all(&self, limit: Option<u32>) -> Result<Vec<ChatHistory>, String> {
        self.store.get_all_chat_history(limit)
    }

    /// 按 ID 查询聊天记录（含完整消息体）。
    pub fn find_by_id(&self, id: i64) -> Result<Option<ChatHistory>, String> {
        self.store.get_chat_history_by_id(id)
    }

    /// 删除聊天记录。
    pub fn delete(&self, id: i64) -> Result<(), String> {
        self.store.delete_chat_history(id)
    }
}
