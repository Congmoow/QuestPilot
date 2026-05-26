use rusqlite::{params, OptionalExtension};

use super::{
    queries::{
        add_operation_log, find_chat_history_by_id, find_prompt_by_id, map_chat_history, map_prompt,
    },
    schema::ensure_default_prompt,
    types::{ChatHistory, ChatHistoryInput, CreatePromptInput, Prompt},
    validation::{validate_messages, validate_non_blank},
    DatabaseStore,
};

impl DatabaseStore {
    /// 兼容入口保留；新主路径由 [`PromptRepository::list_all`] 直接访问 Connection。
    pub fn get_all_prompts(&self) -> Result<Vec<Prompt>, String> {
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        let mut statement = connection
            .prepare(
                "
                SELECT id, name, content, is_default, created_at, updated_at
                FROM ai_prompts
                ORDER BY is_default DESC, created_at DESC, id DESC
                ",
            )
            .map_err(|error| format!("准备 Prompt 列表查询失败: {error}"))?;
        let rows = statement
            .query_map([], map_prompt)
            .map_err(|error| format!("查询 Prompt 列表失败: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取 Prompt 列表失败: {error}"))
    }

    /// 兼容入口保留；新主路径由 [`PromptRepository::find_by_id`] 直接访问 Connection。
    pub fn get_prompt_by_id(&self, id: i64) -> Result<Option<Prompt>, String> {
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        connection
            .query_row(
                "
                SELECT id, name, content, is_default, created_at, updated_at
                FROM ai_prompts
                WHERE id = ?1
                ",
                params![id],
                map_prompt,
            )
            .optional()
            .map_err(|error| format!("读取 Prompt 失败: {error}"))
    }

    /// 兼容入口保留；新主路径由 [`PromptRepository::create`] 直接访问 Connection。
    pub fn create_prompt(&self, data: CreatePromptInput) -> Result<Prompt, String> {
        let name = validate_non_blank(data.name.as_str(), "名称不能为空")?;
        let content = validate_non_blank(data.content.as_str(), "内容不能为空")?;
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        connection
            .execute(
                "
                INSERT INTO ai_prompts (name, content, is_default, created_at, updated_at)
                VALUES (?1, ?2, 0, datetime('now'), datetime('now'))
                ",
                params![name.as_str(), content.as_str()],
            )
            .map_err(|error| format!("创建 Prompt 失败: {error}"))?;
        let id = connection.last_insert_rowid();
        add_operation_log(&connection, "创建 Prompt", format!("创建 Prompt: {name}"))?;
        find_prompt_by_id(&connection, id)?.ok_or_else(|| "Prompt 创建后不存在".to_string())
    }

    /// 兼容入口保留；新主路径由 [`PromptRepository::update`] 直接访问 Connection。
    pub fn update_prompt(
        &self,
        id: i64,
        data: CreatePromptInput,
    ) -> Result<Option<Prompt>, String> {
        let name = validate_non_blank(data.name.as_str(), "名称不能为空")?;
        let content = validate_non_blank(data.content.as_str(), "内容不能为空")?;
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        connection
            .execute(
                "
                UPDATE ai_prompts
                SET name = ?1, content = ?2, updated_at = datetime('now')
                WHERE id = ?3
                ",
                params![name.as_str(), content.as_str(), id],
            )
            .map_err(|error| format!("更新 Prompt 失败: {error}"))?;
        add_operation_log(&connection, "更新 Prompt", format!("更新 Prompt: {name}"))?;
        find_prompt_by_id(&connection, id)
    }

    /// 兼容入口保留；新主路径由 [`PromptRepository::delete`] 直接访问 Connection。
    pub fn delete_prompt(&self, id: i64) -> Result<(), String> {
        let connection = self.connection.borrow();
        ensure_default_prompt(&connection)?;
        let Some(prompt) = find_prompt_by_id(&connection, id)? else {
            return Ok(());
        };
        if prompt.is_default {
            return Err("不能删除默认 Prompt".to_string());
        }

        connection
            .execute("DELETE FROM ai_prompts WHERE id = ?1", params![id])
            .map_err(|error| format!("删除 Prompt 失败: {error}"))?;
        add_operation_log(&connection, "删除 Prompt", format!("删除 Prompt ID: {id}"))
    }

    /// 兼容入口保留；新主路径由 [`ChatHistoryRepository::save`] 直接访问 Connection。
    pub fn save_chat_history(&self, data: ChatHistoryInput) -> Result<ChatHistory, String> {
        validate_messages(&data.messages)?;
        let title = data
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("新对话")
            .to_string();
        let connection = self.connection.borrow();
        connection
            .execute(
                "
                INSERT INTO chat_history (title, messages, prompt_id, created_at, updated_at)
                VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))
                ",
                params![title.as_str(), data.messages.to_string(), data.prompt_id],
            )
            .map_err(|error| format!("保存聊天记录失败: {error}"))?;
        let id = connection.last_insert_rowid();
        find_chat_history_by_id(&connection, id, true)?
            .ok_or_else(|| "聊天记录保存后不存在".to_string())
    }

    /// 兼容入口保留；新主路径由 [`ChatHistoryRepository::update`] 直接访问 Connection。
    pub fn update_chat_history(
        &self,
        id: i64,
        messages: serde_json::Value,
    ) -> Result<Option<ChatHistory>, String> {
        validate_messages(&messages)?;
        let connection = self.connection.borrow();
        connection
            .execute(
                "
                UPDATE chat_history
                SET messages = ?1, updated_at = datetime('now')
                WHERE id = ?2
                ",
                params![messages.to_string(), id],
            )
            .map_err(|error| format!("更新聊天记录失败: {error}"))?;
        find_chat_history_by_id(&connection, id, true)
    }

    /// 兼容入口保留；新主路径由 [`ChatHistoryRepository::list_all`] 直接访问 Connection。
    pub fn get_all_chat_history(&self, limit: Option<u32>) -> Result<Vec<ChatHistory>, String> {
        let safe_limit = i64::from(limit.unwrap_or(50).clamp(1, 1000));
        let connection = self.connection.borrow();
        let mut statement = connection
            .prepare(
                "
                SELECT id, title, NULL AS messages, prompt_id, created_at, updated_at
                FROM chat_history
                ORDER BY updated_at DESC, id DESC
                LIMIT ?1
                ",
            )
            .map_err(|error| format!("准备聊天记录列表查询失败: {error}"))?;
        let rows = statement
            .query_map(params![safe_limit], map_chat_history)
            .map_err(|error| format!("查询聊天记录列表失败: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取聊天记录列表失败: {error}"))
    }

    /// 兼容入口保留；新主路径由 [`ChatHistoryRepository::find_by_id`] 直接访问 Connection。
    pub fn get_chat_history_by_id(&self, id: i64) -> Result<Option<ChatHistory>, String> {
        let connection = self.connection.borrow();
        find_chat_history_by_id(&connection, id, true)
    }

    /// 兼容入口保留；新主路径由 [`ChatHistoryRepository::delete`] 直接访问 Connection。
    pub fn delete_chat_history(&self, id: i64) -> Result<(), String> {
        let connection = self.connection.borrow();
        connection
            .execute("DELETE FROM chat_history WHERE id = ?1", params![id])
            .map_err(|error| format!("删除聊天记录失败: {error}"))?;
        Ok(())
    }
}
