use tauri::AppHandle;

use crate::database;

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
pub fn practice_save_record(
    app: AppHandle,
    record: database::PracticeRecordInput,
) -> Result<serde_json::Value, String> {
    open_store(&app)?.save_practice_record(record)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
pub fn practice_get_records(
    app: AppHandle,
    bank_id: i64,
    limit: Option<u32>,
) -> Result<Vec<database::PracticeRecord>, String> {
    open_store(&app)?.get_practice_records(bank_id, limit)
}

#[tauri::command(rename_all = "camelCase")]
pub fn practice_get_all_stats(app: AppHandle) -> Result<Vec<database::PracticeStats>, String> {
    open_store(&app)?.get_all_practice_stats()
}
