use tauri::AppHandle;

use crate::database;

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
pub fn stats_get_dashboard(app: AppHandle) -> Result<database::DashboardStats, String> {
    open_store(&app)?.get_dashboard_stats()
}

#[tauri::command(rename_all = "camelCase")]
pub fn stats_get_operation_logs(
    app: AppHandle,
    limit: Option<u32>,
) -> Result<Vec<database::OperationLog>, String> {
    open_store(&app)?.get_operation_logs(limit)
}

#[tauri::command(rename_all = "camelCase")]
pub fn stats_get_type_distribution(
    app: AppHandle,
    bank_id: Option<i64>,
) -> Result<Vec<database::TypeDistribution>, String> {
    open_store(&app)?.get_question_count_by_type(bank_id)
}
