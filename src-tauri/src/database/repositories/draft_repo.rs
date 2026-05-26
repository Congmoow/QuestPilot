use rusqlite::{params, OptionalExtension};

use crate::database::DatabaseStore;

/// 草稿数据访问对象（Phase 2：通过 `DatabaseStore::with_connection` 直接执行 SQL）。
///
/// 草稿使用单行持久化（`id = 1`），是 AI 对话导入场景的暂存机制。
pub struct DraftRepository {
    store: DatabaseStore,
}

impl DraftRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 保存草稿（覆盖已有草稿，`INSERT OR REPLACE`，key = 1）。
    pub fn save(&self, data: serde_json::Value) -> Result<(), String> {
        if !data.is_object() {
            return Err("草稿数据无效".to_string());
        }
        self.store.with_connection(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO drafts (id, data, saved_at) \
                 VALUES (1, ?1, datetime('now'))",
                params![data.to_string()],
            )
            .map_err(|e| format!("保存草稿失败: {e}"))?;
            Ok(())
        })
    }

    /// 读取草稿（不存在时返回 `None`；存在时附加 `savedAt` 字段）。
    pub fn load(&self) -> Result<Option<serde_json::Value>, String> {
        self.store.with_connection(|conn| {
            let row = conn
                .query_row(
                    "SELECT data, saved_at FROM drafts WHERE id = 1",
                    [],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
                )
                .optional()
                .map_err(|e| format!("读取草稿失败: {e}"))?;

            let Some((data, saved_at)) = row else {
                return Ok(None);
            };

            let mut value = serde_json::from_str::<serde_json::Value>(&data)
                .map_err(|e| format!("解析草稿失败: {e}"))?;
            if let Some(obj) = value.as_object_mut() {
                obj.insert("savedAt".to_string(), serde_json::Value::String(saved_at));
            }
            Ok(Some(value))
        })
    }

    /// 清除草稿。
    pub fn clear(&self) -> Result<(), String> {
        self.store.with_connection(|conn| {
            conn.execute("DELETE FROM drafts WHERE id = 1", [])
                .map_err(|e| format!("清除草稿失败: {e}"))?;
            Ok(())
        })
    }
}
