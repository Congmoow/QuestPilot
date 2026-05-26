use std::fs;
use std::path::Path;

use tauri::{AppHandle, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::error::AppError;
use crate::{csv_tools, database};

use super::open_store;

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(window), err)]
pub fn csv_select_file(window: WebviewWindow) -> Result<Option<String>, AppError> {
    let file_path = window
        .dialog()
        .file()
        .add_filter("CSV 文件", &["csv"])
        .blocking_pick_file();

    Ok(file_path.map(|path| path.to_string()))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(window), err)]
pub fn csv_download_template(window: WebviewWindow) -> Result<serde_json::Value, AppError> {
    let Some(file_path) = window
        .dialog()
        .file()
        .add_filter("CSV 文件", &["csv"])
        .set_file_name("题目导入模板.csv")
        .blocking_save_file()
    else {
        return Ok(serde_json::json!({ "success": false, "cancelled": true }));
    };

    let content = csv_tools::generate_template()?;
    let file_path = file_path.to_string();
    fs::write(&file_path, format!("\u{feff}{content}"))
        .map_err(|e| AppError::Config(format!("保存 CSV 模板失败: {e}")))?;

    Ok(serde_json::json!({
        "success": true,
        "filePath": file_path.to_string(),
    }))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(err)]
pub fn csv_parse_file(file_path: String) -> Result<serde_json::Value, AppError> {
    let content = fs::read_to_string(Path::new(&file_path))
        .map_err(|e| AppError::Config(format!("读取 CSV 文件失败: {e}")))?;
    serde_json::to_value(csv_tools::parse_csv_content(content.as_str())?)
        .map_err(|e| AppError::Config(format!("序列化 CSV 解析结果失败: {e}")))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn csv_import(
    app: AppHandle,
    bank_id: i64,
    questions: Vec<database::CreateQuestionInput>,
) -> Result<database::ImportResult, AppError> {
    Ok(open_store(&app)?.create_questions_batch(bank_id, questions)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app, window), err)]
pub fn csv_export(
    app: AppHandle,
    window: WebviewWindow,
    bank_id: i64,
) -> Result<serde_json::Value, AppError> {
    let store = open_store(&app)?;
    let bank = store
        .get_bank_by_id(bank_id)?
        .ok_or_else(|| AppError::Database("题库不存在".into()))?;
    let total = store.count_questions(bank_id, String::new(), None)?;
    if total <= 0 {
        return Err(AppError::Database("题库中没有题目可导出".into()));
    }
    let questions = store.get_questions_by_bank_id(bank_id, 0, total.min(100_000) as u32, None)?;
    let Some(file_path) = window
        .dialog()
        .file()
        .add_filter("CSV 文件", &["csv"])
        .set_file_name(format!("{}.csv", bank.name))
        .blocking_save_file()
    else {
        return Ok(serde_json::json!({ "success": false, "cancelled": true }));
    };

    let content = csv_tools::export_questions_to_csv(&questions)?;
    let file_path = file_path.to_string();
    fs::write(&file_path, format!("\u{feff}{content}"))
        .map_err(|e| AppError::Config(format!("保存 CSV 文件失败: {e}")))?;

    Ok(serde_json::json!({
        "success": true,
        "filePath": file_path.to_string(),
        "count": questions.len(),
    }))
}
