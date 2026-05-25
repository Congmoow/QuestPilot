use tauri::AppHandle;

use crate::database;

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
pub fn prompt_get_all(app: AppHandle) -> Result<Vec<database::Prompt>, String> {
    open_store(&app)?.get_all_prompts()
}

#[tauri::command(rename_all = "camelCase")]
pub fn prompt_get_by_id(app: AppHandle, id: i64) -> Result<Option<database::Prompt>, String> {
    open_store(&app)?.get_prompt_by_id(id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn prompt_create(
    app: AppHandle,
    data: database::CreatePromptInput,
) -> Result<database::Prompt, String> {
    open_store(&app)?.create_prompt(data)
}

#[tauri::command(rename_all = "camelCase")]
pub fn prompt_update(
    app: AppHandle,
    id: i64,
    data: database::CreatePromptInput,
) -> Result<Option<database::Prompt>, String> {
    open_store(&app)?.update_prompt(id, data)
}

#[tauri::command(rename_all = "camelCase")]
pub fn prompt_delete(app: AppHandle, id: i64) -> Result<serde_json::Value, String> {
    open_store(&app)?.delete_prompt(id)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
pub fn chat_history_save(
    app: AppHandle,
    data: database::ChatHistoryInput,
) -> Result<database::ChatHistory, String> {
    open_store(&app)?.save_chat_history(data)
}

#[tauri::command(rename_all = "camelCase")]
pub fn chat_history_update(
    app: AppHandle,
    id: i64,
    messages: serde_json::Value,
) -> Result<Option<database::ChatHistory>, String> {
    open_store(&app)?.update_chat_history(id, messages)
}

#[tauri::command(rename_all = "camelCase")]
pub fn chat_history_get_all(
    app: AppHandle,
    limit: Option<u32>,
) -> Result<Vec<database::ChatHistory>, String> {
    open_store(&app)?.get_all_chat_history(limit)
}

#[tauri::command(rename_all = "camelCase")]
pub fn chat_history_get_by_id(
    app: AppHandle,
    id: i64,
) -> Result<Option<database::ChatHistory>, String> {
    open_store(&app)?.get_chat_history_by_id(id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn chat_history_delete(app: AppHandle, id: i64) -> Result<serde_json::Value, String> {
    open_store(&app)?.delete_chat_history(id)?;
    Ok(serde_json::json!({ "success": true }))
}
