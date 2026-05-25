use tauri::AppHandle;

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
pub fn draft_save(app: AppHandle, data: serde_json::Value) -> Result<serde_json::Value, String> {
    open_store(&app)?.save_draft(data)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
pub fn draft_load(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    open_store(&app)?.load_draft()
}

#[tauri::command(rename_all = "camelCase")]
pub fn draft_clear(app: AppHandle) -> Result<serde_json::Value, String> {
    open_store(&app)?.clear_draft()?;
    Ok(serde_json::json!({ "success": true }))
}
