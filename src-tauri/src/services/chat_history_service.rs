use crate::database::{ChatHistory, ChatHistoryInput, ChatHistoryRepository, DatabaseStore};
use crate::error::AppError;

/// 聊天记录业务服务。
///
/// 负责聊天记录的增删改查，通过 [`ChatHistoryRepository`] 访问数据库。
///
/// ## 层次结构
/// `ChatHistoryCommand` → `ChatHistoryService` → `ChatHistoryRepository` → `DatabaseStore` → SQLite
pub struct ChatHistoryService {
    repo: ChatHistoryRepository,
}

impl ChatHistoryService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `ChatHistoryRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: ChatHistoryRepository::new(store),
        }
    }

    /// 保存新聊天记录（含消息格式校验）。
    pub fn save(&self, data: ChatHistoryInput) -> Result<ChatHistory, AppError> {
        Ok(self.repo.save(data)?)
    }

    /// 更新聊天记录消息内容。
    pub fn update(
        &self,
        id: i64,
        messages: serde_json::Value,
    ) -> Result<Option<ChatHistory>, AppError> {
        Ok(self.repo.update(id, messages)?)
    }

    /// 查询聊天记录列表（不含消息体，按最近更新倒序）。
    pub fn list_all(&self, limit: Option<u32>) -> Result<Vec<ChatHistory>, AppError> {
        Ok(self.repo.list_all(limit)?)
    }

    /// 按 ID 查询聊天记录（含完整消息体）。
    pub fn get_by_id(&self, id: i64) -> Result<Option<ChatHistory>, AppError> {
        Ok(self.repo.find_by_id(id)?)
    }

    /// 删除聊天记录。
    pub fn delete(&self, id: i64) -> Result<(), AppError> {
        Ok(self.repo.delete(id)?)
    }
}
