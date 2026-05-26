use tauri::AppHandle;

use crate::database;
use crate::error::AppError;

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_bank_create(
    app: AppHandle,
    data: database::CreateQuestionBankInput,
) -> Result<database::QuestionBank, AppError> {
    Ok(open_store(&app)?.create_bank(data)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_bank_get_all(app: AppHandle) -> Result<Vec<database::QuestionBank>, AppError> {
    Ok(open_store(&app)?.get_all_banks()?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_bank_get_by_id(
    app: AppHandle,
    id: i64,
) -> Result<Option<database::QuestionBank>, AppError> {
    Ok(open_store(&app)?.get_bank_by_id(id)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_bank_update(
    app: AppHandle,
    id: i64,
    data: database::CreateQuestionBankInput,
) -> Result<Option<database::QuestionBank>, AppError> {
    Ok(open_store(&app)?.update_bank(id, data)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_bank_delete(app: AppHandle, id: i64) -> Result<(), AppError> {
    Ok(open_store(&app)?.delete_bank(id)?)
}
