pub mod database;

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

fn main_window(window: &WebviewWindow) -> Result<WebviewWindow, String> {
    window
        .app_handle()
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败: {error}"))
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(database::DATABASE_FILE_NAME))
}

fn open_store(app: &AppHandle) -> Result<database::DatabaseStore, String> {
    let path = database_path(app)?;
    let legacy_candidates = database::legacy_database_candidates(&path);
    database::DatabaseStore::open_with_legacy_candidates(&path, &legacy_candidates)
}

#[tauri::command(rename_all = "camelCase")]
fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    main_window(&window)?
        .minimize()
        .map_err(|error| error.to_string())
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
    main_window(&window)?
        .close()
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    main_window(&window)?
        .is_maximized()
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn question_bank_create(
    app: AppHandle,
    data: database::CreateQuestionBankInput,
) -> Result<database::QuestionBank, String> {
    open_store(&app)?.create_bank(data)
}

#[tauri::command(rename_all = "camelCase")]
fn question_bank_get_all(app: AppHandle) -> Result<Vec<database::QuestionBank>, String> {
    open_store(&app)?.get_all_banks()
}

#[tauri::command(rename_all = "camelCase")]
fn question_create_batch(
    app: AppHandle,
    bank_id: i64,
    questions: Vec<database::CreateQuestionInput>,
) -> Result<database::ImportResult, String> {
    open_store(&app)?.create_questions_batch(bank_id, questions)
}

#[tauri::command(rename_all = "camelCase")]
fn question_get_random(
    app: AppHandle,
    bank_id: i64,
    limit: Option<u32>,
    question_type: Option<String>,
) -> Result<Vec<database::Question>, String> {
    open_store(&app)?.get_random_questions(bank_id, limit, question_type)
}

#[tauri::command(rename_all = "camelCase")]
fn settings_get_theme(app: AppHandle) -> Result<String, String> {
    open_store(&app)?.get_theme()
}

#[tauri::command(rename_all = "camelCase")]
fn settings_set_theme(app: AppHandle, theme: String) -> Result<(), String> {
    open_store(&app)?.set_theme(theme)
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
    let path = Path::new(&file_path);
    let mut reader = csv::Reader::from_path(path).map_err(|error| error.to_string())?;
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
            question_bank_create,
            question_bank_get_all,
            question_create_batch,
            question_get_random,
            settings_get_theme,
            settings_set_theme,
            csv_select_file,
            csv_parse_file
        ])
        .run(tauri::generate_context!())
        .expect("启动 QuestPilot Tauri PoC 失败");
}
