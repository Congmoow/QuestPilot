use rusqlite::{params, OptionalExtension};

use crate::database::{CreatePromptInput, DatabaseStore, Prompt};

use super::super::validation::validate_non_blank;
use super::helpers::{add_operation_log, ensure_default_prompt, find_prompt_by_id, map_prompt};

/// Prompt 数据访问对象（Phase 2：通过 `DatabaseStore::with_connection` 直接执行 SQL）。
///
/// 封装 `ai_prompts` 表的 CRUD 操作。
pub struct PromptRepository {
    store: DatabaseStore,
}

impl PromptRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 查询所有 Prompt（默认 Prompt 优先，其余按创建时间倒序）。
    pub fn list_all(&self) -> Result<Vec<Prompt>, String> {
        self.store.with_connection(|conn| {
            ensure_default_prompt(conn)?;
            let mut stmt = conn
                .prepare(
                    "SELECT id, name, content, is_default, created_at, updated_at \
                     FROM ai_prompts \
                     ORDER BY is_default DESC, created_at DESC, id DESC",
                )
                .map_err(|e| format!("准备 Prompt 列表查询失败: {e}"))?;
            let rows = stmt
                .query_map([], map_prompt)
                .map_err(|e| format!("查询 Prompt 列表失败: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取 Prompt 列表失败: {e}"))
        })
    }

    /// 按 ID 查询单条 Prompt；不存在则返回 `None`。
    pub fn find_by_id(&self, id: i64) -> Result<Option<Prompt>, String> {
        self.store.with_connection(|conn| {
            ensure_default_prompt(conn)?;
            conn.query_row(
                "SELECT id, name, content, is_default, created_at, updated_at \
                 FROM ai_prompts WHERE id = ?1",
                params![id],
                map_prompt,
            )
            .optional()
            .map_err(|e| format!("读取 Prompt 失败: {e}"))
        })
    }

    /// 创建 Prompt（含名称/内容非空校验 + operation_log）。
    pub fn create(&self, data: CreatePromptInput) -> Result<Prompt, String> {
        let name = validate_non_blank(data.name.as_str(), "名称不能为空")?;
        let content = validate_non_blank(data.content.as_str(), "内容不能为空")?;
        self.store.with_connection(|conn| {
            ensure_default_prompt(conn)?;
            conn.execute(
                "INSERT INTO ai_prompts (name, content, is_default, created_at, updated_at) \
                 VALUES (?1, ?2, 0, datetime('now'), datetime('now'))",
                params![name.as_str(), content.as_str()],
            )
            .map_err(|e| format!("创建 Prompt 失败: {e}"))?;
            let id = conn.last_insert_rowid();
            add_operation_log(conn, "创建 Prompt", format!("创建 Prompt: {name}"))?;
            find_prompt_by_id(conn, id)?.ok_or_else(|| "Prompt 创建后不存在".to_string())
        })
    }

    /// 更新 Prompt 名称/内容；不存在则返回 `None`。
    pub fn update(&self, id: i64, data: CreatePromptInput) -> Result<Option<Prompt>, String> {
        let name = validate_non_blank(data.name.as_str(), "名称不能为空")?;
        let content = validate_non_blank(data.content.as_str(), "内容不能为空")?;
        self.store.with_connection(|conn| {
            ensure_default_prompt(conn)?;
            conn.execute(
                "UPDATE ai_prompts \
                 SET name = ?1, content = ?2, updated_at = datetime('now') \
                 WHERE id = ?3",
                params![name.as_str(), content.as_str(), id],
            )
            .map_err(|e| format!("更新 Prompt 失败: {e}"))?;
            add_operation_log(conn, "更新 Prompt", format!("更新 Prompt: {name}"))?;
            find_prompt_by_id(conn, id)
        })
    }

    /// 删除 Prompt（不能删除默认 Prompt；不存在则忽略）。
    pub fn delete(&self, id: i64) -> Result<(), String> {
        self.store.with_connection(|conn| {
            ensure_default_prompt(conn)?;
            let Some(prompt) = find_prompt_by_id(conn, id)? else {
                return Ok(());
            };
            if prompt.is_default {
                return Err("不能删除默认 Prompt".to_string());
            }
            conn.execute("DELETE FROM ai_prompts WHERE id = ?1", params![id])
                .map_err(|e| format!("删除 Prompt 失败: {e}"))?;
            add_operation_log(conn, "删除 Prompt", format!("删除 Prompt ID: {id}"))
        })
    }
}
