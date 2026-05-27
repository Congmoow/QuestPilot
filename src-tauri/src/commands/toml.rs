use std::fs;
use std::path::Path;

use tauri::WebviewWindow;
use tauri_plugin_dialog::DialogExt;

use crate::error::AppError;
use crate::toml_tools;

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(window), err)]
pub fn toml_select_file(window: WebviewWindow) -> Result<Option<String>, AppError> {
    let file_path = window
        .dialog()
        .file()
        .add_filter("TOML 文件", &["toml"])
        .blocking_pick_file();

    Ok(file_path.map(|path| path.to_string()))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(err)]
pub fn toml_parse_file(file_path: String) -> Result<serde_json::Value, AppError> {
    let content = fs::read_to_string(Path::new(&file_path))
        .map_err(|e| AppError::Config(format!("读取 TOML 文件失败: {e}")))?;
    serde_json::to_value(toml_tools::parse_toml_content(content.as_str())?)
        .map_err(|e| AppError::Config(format!("序列化 TOML 解析结果失败: {e}")))
}
