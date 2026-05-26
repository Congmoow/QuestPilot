use tauri::AppHandle;

use crate::database;
use crate::error::AppError;
use crate::services::stats_service::StatsService;

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn stats_get_dashboard(app: AppHandle) -> Result<database::DashboardStats, AppError> {
    StatsService::new(open_store(&app)?).get_dashboard()
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn stats_get_operation_logs(
    app: AppHandle,
    limit: Option<u32>,
) -> Result<Vec<database::OperationLog>, AppError> {
    StatsService::new(open_store(&app)?).get_operation_logs(limit)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn stats_get_type_distribution(
    app: AppHandle,
    bank_id: Option<i64>,
) -> Result<Vec<database::TypeDistribution>, AppError> {
    StatsService::new(open_store(&app)?).get_type_distribution(bank_id)
}
