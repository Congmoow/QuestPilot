pub mod ai_cmd;
pub mod icon;
pub mod csv;
pub mod draft;
pub mod practice;
pub mod prompt_chat;
pub mod question;
pub mod question_bank;
pub mod settings;
pub mod stats;
pub mod toml;
pub mod window;
pub mod wrong_book;

use std::path::PathBuf;

use tauri::{AppHandle, Manager, WebviewWindow};

use crate::database;

pub(super) fn main_window(window: &WebviewWindow) -> Result<WebviewWindow, crate::error::AppError> {
    window
        .app_handle()
        .get_webview_window("main")
        .ok_or_else(|| crate::error::AppError::Config("主窗口不存在".into()))
}

pub(super) fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败: {error}"))
}

pub(super) fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(database::DATABASE_FILE_NAME))
}

pub(super) fn legacy_candidates(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    Ok(database::legacy_database_candidates(&database_path(app)?))
}

pub(super) fn open_store(app: &AppHandle) -> Result<database::DatabaseStore, String> {
    let path = database_path(app)?;
    let candidates = legacy_candidates(app)?;
    database::DatabaseStore::open_with_legacy_candidates(&path, &candidates)
}

pub(super) fn ai_config_from_database(config: database::ApiConfig) -> crate::ai::AiConfig {
    crate::ai::AiConfig {
        api_key: config.api_key,
        api_url: config.api_url,
        model_id: config.model_id,
    }
}
