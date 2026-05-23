use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use tauri::{Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize)]
struct QuestionBank {
    id: i64,
    name: String,
    description: Option<String>,
    question_count: i64,
}

#[derive(Debug, Deserialize)]
struct CreateQuestionInput {
    r#type: String,
    content: String,
    options: Option<serde_json::Value>,
    answer: String,
    analysis: Option<String>,
}

#[derive(Debug, Serialize)]
struct ImportResult {
    success: usize,
    failed: usize,
    errors: Vec<ImportError>,
}

#[derive(Debug, Serialize)]
struct ImportError {
    index: usize,
    message: String,
}

fn main_window(window: &WebviewWindow) -> Result<WebviewWindow, String> {
    window
        .app_handle()
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    main_window(&window)?.minimize().map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn window_maximize(window: WebviewWindow) -> Result<(), String> {
    let main = main_window(&window)?;
    let is_maximized = main.is_maximized().map_err(|error| error.to_string())?;
    if is_maximized {
        main.unmaximize().map_err(|error| error.to_string())
    } else {
        main.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command(rename_all = "camelCase")]
fn window_close(window: WebviewWindow) -> Result<(), String> {
    main_window(&window)?.close().map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    main_window(&window)?.is_maximized().map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn question_bank_get_all() -> Result<Vec<QuestionBank>, String> {
    Ok(Vec::new())
}

#[tauri::command(rename_all = "camelCase")]
fn question_create_batch(
    bank_id: i64,
    questions: Vec<CreateQuestionInput>,
) -> Result<ImportResult, String> {
    let mut errors = Vec::new();
    let mut valid_count = 0;

    for (index, question) in questions.iter().enumerate() {
        if question.content.trim().is_empty() {
            errors.push(ImportError {
                index,
                message: "题目内容不能为空".to_string(),
            });
            continue;
        }

        if question.answer.trim().is_empty() {
            errors.push(ImportError {
                index,
                message: "答案不能为空".to_string(),
            });
            continue;
        }

        valid_count += 1;
    }

    let _ = bank_id;

    Ok(ImportResult {
        success: valid_count,
        failed: errors.len(),
        errors,
    })
}

#[tauri::command(rename_all = "camelCase")]
fn question_get_random(
    bank_id: i64,
    limit: Option<u32>,
    question_type: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let _ = (bank_id, limit, question_type);
    Ok(Vec::new())
}

#[tauri::command(rename_all = "camelCase")]
fn csv_select_file(window: WebviewWindow) -> Result<Option<String>, String> {
    let file_path = window
        .dialog()
        .file()
        .add_filter("CSV 文件", &["csv"])
        .blocking_pick_file();

    Ok(file_path.map(|path| path.to_string()))
}

#[tauri::command(rename_all = "camelCase")]
fn csv_parse_file(file_path: String) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(file_path);
    let mut reader = csv::Reader::from_path(&path).map_err(|error| error.to_string())?;
    let headers = reader
        .headers()
        .map_err(|error| error.to_string())?
        .iter()
        .map(str::to_string)
        .collect::<Vec<_>>();
    let total_rows = reader
        .records()
        .try_fold(0usize, |count, row| row.map(|_| count + 1))
        .map_err(|error| error.to_string())?;

    Ok(serde_json::json!({
        "valid": [],
        "errors": [],
        "headers": headers,
        "totalRows": total_rows
    }))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            question_bank_get_all,
            question_create_batch,
            question_get_random,
            csv_select_file,
            csv_parse_file
        ])
        .run(tauri::generate_context!())
        .expect("启动 QuestPilot Tauri PoC 失败");
}
