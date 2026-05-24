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
fn question_bank_get_by_id(
    app: AppHandle,
    id: i64,
) -> Result<Option<database::QuestionBank>, String> {
    open_store(&app)?.get_bank_by_id(id)
}

#[tauri::command(rename_all = "camelCase")]
fn question_bank_update(
    app: AppHandle,
    id: i64,
    data: database::CreateQuestionBankInput,
) -> Result<Option<database::QuestionBank>, String> {
    open_store(&app)?.update_bank(id, data)
}

#[tauri::command(rename_all = "camelCase")]
fn question_bank_delete(app: AppHandle, id: i64) -> Result<(), String> {
    open_store(&app)?.delete_bank(id)
}

#[tauri::command(rename_all = "camelCase")]
fn question_create(
    app: AppHandle,
    data: database::CreateQuestionInput,
    bank_id: i64,
) -> Result<database::Question, String> {
    open_store(&app)?.create_question(bank_id, data)
}

#[tauri::command(rename_all = "camelCase")]
fn question_create_batch(
    app: AppHandle,
    bank_id: i64,
    questions: Vec<database::CreateQuestionInput>,
) -> Result<database::ImportResult, String> {
    open_store(&app)?.create_questions_batch(bank_id, questions)
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PaginatedQuestions {
    data: Vec<database::Question>,
    total: i64,
    page: u32,
    page_size: u32,
    total_pages: u32,
}

fn paginated_questions(
    data: Vec<database::Question>,
    total: i64,
    page: u32,
    page_size: u32,
) -> PaginatedQuestions {
    let total_pages = if page_size == 0 {
        0
    } else {
        ((total + i64::from(page_size) - 1) / i64::from(page_size)) as u32
    };

    PaginatedQuestions {
        data,
        total,
        page,
        page_size,
        total_pages,
    }
}

#[tauri::command(rename_all = "camelCase")]
fn question_get_by_bank_id(
    app: AppHandle,
    bank_id: i64,
    page: Option<u32>,
    page_size: Option<u32>,
    question_type: Option<String>,
) -> Result<PaginatedQuestions, String> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 1000);
    let offset = (page - 1) * page_size;
    let store = open_store(&app)?;
    let data = store.get_questions_by_bank_id(bank_id, offset, page_size, question_type.clone())?;
    let total = store.count_questions(bank_id, String::new(), question_type)?;
    Ok(paginated_questions(data, total, page, page_size))
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
fn question_get_by_id(app: AppHandle, id: i64) -> Result<Option<database::Question>, String> {
    open_store(&app)?.get_question_by_id(id)
}

#[tauri::command(rename_all = "camelCase")]
fn question_update(
    app: AppHandle,
    id: i64,
    data: database::CreateQuestionInput,
) -> Result<Option<database::Question>, String> {
    open_store(&app)?.update_question(id, data)
}

#[tauri::command(rename_all = "camelCase")]
fn question_delete(app: AppHandle, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("请选择要删除的题目".to_string());
    }

    open_store(&app)?.delete_questions(&ids)
}

#[tauri::command(rename_all = "camelCase")]
fn question_search(
    app: AppHandle,
    bank_id: i64,
    keyword: String,
    page: Option<u32>,
    page_size: Option<u32>,
    question_type: Option<String>,
) -> Result<PaginatedQuestions, String> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 1000);
    let offset = (page - 1) * page_size;
    let store = open_store(&app)?;
    let data = store.search_questions(
        bank_id,
        keyword.clone(),
        question_type.clone(),
        offset,
        page_size,
    )?;
    let total = store.count_questions(bank_id, keyword, question_type)?;
    Ok(paginated_questions(data, total, page, page_size))
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
            question_bank_get_by_id,
            question_bank_update,
            question_bank_delete,
            question_create,
            question_create_batch,
            question_get_by_bank_id,
            question_get_random,
            question_get_by_id,
            question_update,
            question_delete,
            question_search,
            settings_get_theme,
            settings_set_theme,
            csv_select_file,
            csv_parse_file
        ])
        .run(tauri::generate_context!())
        .expect("启动 QuestPilot Tauri PoC 失败");
}
