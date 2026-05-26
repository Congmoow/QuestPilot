use tauri::AppHandle;

use crate::error::AppError;
use crate::services::draft_service::DraftService;

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app, data), err)]
pub fn draft_save(app: AppHandle, data: serde_json::Value) -> Result<serde_json::Value, AppError> {
    DraftService::new(open_store(&app)?).save(data)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn draft_load(app: AppHandle) -> Result<Option<serde_json::Value>, AppError> {
    DraftService::new(open_store(&app)?).load()
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn draft_clear(app: AppHandle) -> Result<serde_json::Value, AppError> {
    DraftService::new(open_store(&app)?).clear()?;
    Ok(serde_json::json!({ "success": true }))
}
