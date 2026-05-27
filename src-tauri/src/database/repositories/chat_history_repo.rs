use rusqlite::params;

use crate::database::{ChatHistory, ChatHistoryInput, DatabaseStore};

use super::super::validation::validate_messages;
use super::helpers::{find_chat_history_by_id, map_chat_history};

/// 聊天记录数据访问对象（Phase 2：通过 `DatabaseStore::with_connection` 直接执行 SQL）。
///
/// 封装 `chat_history` 表的 CRUD 操作。
pub struct ChatHistoryRepository {
    store: DatabaseStore,
}

impl ChatHistoryRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 保存一条新聊天记录（含消息格式校验；title 为空时默认"新对话"）。
    pub fn save(&self, data: ChatHistoryInput) -> Result<ChatHistory, String> {
        validate_messages(&data.messages)?;
        let title = data
            .title
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .unwrap_or("新对话")
            .to_string();
        self.store.with_connection(|conn| {
            conn.execute(
                "INSERT INTO chat_history (title, messages, prompt_id, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
                params![title.as_str(), data.messages.to_string(), data.prompt_id],
            )
            .map_err(|e| format!("保存聊天记录失败: {e}"))?;
            let id = conn.last_insert_rowid();
            find_chat_history_by_id(conn, id, true)?
                .ok_or_else(|| "聊天记录保存后不存在".to_string())
        })
    }

    /// 更新聊天记录消息内容（含格式校验）。
    pub fn update(
        &self,
        id: i64,
        messages: serde_json::Value,
    ) -> Result<Option<ChatHistory>, String> {
        validate_messages(&messages)?;
        self.store.with_connection(|conn| {
            conn.execute(
                "UPDATE chat_history \
                 SET messages = ?1, updated_at = datetime('now') \
                 WHERE id = ?2",
                params![messages.to_string(), id],
            )
            .map_err(|e| format!("更新聊天记录失败: {e}"))?;
            find_chat_history_by_id(conn, id, true)
        })
    }

    /// 查询聊天记录列表（不含消息体，按最近更新倒序，`limit` 默认 50）。
    pub fn list_all(&self, limit: Option<u32>) -> Result<Vec<ChatHistory>, String> {
        let safe_limit = i64::from(limit.unwrap_or(50).clamp(1, 1000));
        self.store.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT id, title, NULL AS messages, prompt_id, created_at, updated_at \
                     FROM chat_history \
                     ORDER BY updated_at DESC, id DESC \
                     LIMIT ?1",
                )
                .map_err(|e| format!("准备聊天记录列表查询失败: {e}"))?;
            let rows = stmt
                .query_map(params![safe_limit], map_chat_history)
                .map_err(|e| format!("查询聊天记录列表失败: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取聊天记录列表失败: {e}"))
        })
    }

    /// 按 ID 查询聊天记录（含完整消息体）；不存在则返回 `None`。
    pub fn find_by_id(&self, id: i64) -> Result<Option<ChatHistory>, String> {
        self.store
            .with_connection(|conn| find_chat_history_by_id(conn, id, true))
    }

    /// 删除聊天记录。
    pub fn delete(&self, id: i64) -> Result<(), String> {
        self.store.with_connection(|conn| {
            conn.execute("DELETE FROM chat_history WHERE id = ?1", params![id])
                .map_err(|e| format!("删除聊天记录失败: {e}"))?;
            Ok(())
        })
    }
}
