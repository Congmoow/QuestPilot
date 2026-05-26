use tauri::AppHandle;

use crate::database;
use crate::error::AppError;
use crate::services::practice_service::PracticeService;

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn practice_save_record(
    app: AppHandle,
    record: database::PracticeRecordInput,
) -> Result<serde_json::Value, AppError> {
    PracticeService::new(open_store(&app)?).save_record(record)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn practice_get_records(
    app: AppHandle,
    bank_id: i64,
    limit: Option<u32>,
) -> Result<Vec<database::PracticeRecord>, AppError> {
    Ok(PracticeService::new(open_store(&app)?).get_records(bank_id, limit)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn practice_get_all_stats(app: AppHandle) -> Result<Vec<database::PracticeStats>, AppError> {
    Ok(PracticeService::new(open_store(&app)?).get_all_stats()?)
}
