pub mod ai;
pub mod csv_tools;
pub mod database;

use std::fs;
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

fn legacy_candidates(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    Ok(database::legacy_database_candidates(&database_path(app)?))
}

fn open_store(app: &AppHandle) -> Result<database::DatabaseStore, String> {
    let path = database_path(app)?;
    let legacy_candidates = legacy_candidates(app)?;
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

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PaginatedWrongBookItems {
    data: Vec<database::WrongBookItem>,
    total: i64,
    page: u32,
    page_size: u32,
    total_pages: u32,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicApiConfig {
    api_key: String,
    api_key_preview: String,
    has_api_key: bool,
    api_url: String,
    model_id: String,
    provider: String,
}

fn paginated_questions(
    data: Vec<database::Question>,
    total: i64,
    page: u32,
    page_size: u32,
) -> PaginatedQuestions {
    PaginatedQuestions {
        data,
        total,
        page,
        page_size,
        total_pages: total_pages(total, page_size),
    }
}

fn total_pages(total: i64, page_size: u32) -> u32 {
    if page_size == 0 {
        0
    } else {
        ((total + i64::from(page_size) - 1) / i64::from(page_size)) as u32
    }
}

fn paginated_wrong_book_items(
    data: Vec<database::WrongBookItem>,
    total: i64,
    page: u32,
    page_size: u32,
) -> PaginatedWrongBookItems {
    PaginatedWrongBookItems {
        data,
        total,
        page,
        page_size,
        total_pages: total_pages(total, page_size),
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
fn stats_get_dashboard(app: AppHandle) -> Result<database::DashboardStats, String> {
    open_store(&app)?.get_dashboard_stats()
}

#[tauri::command(rename_all = "camelCase")]
fn stats_get_operation_logs(
    app: AppHandle,
    limit: Option<u32>,
) -> Result<Vec<database::OperationLog>, String> {
    open_store(&app)?.get_operation_logs(limit)
}

#[tauri::command(rename_all = "camelCase")]
fn stats_get_type_distribution(
    app: AppHandle,
    bank_id: Option<i64>,
) -> Result<Vec<database::TypeDistribution>, String> {
    open_store(&app)?.get_question_count_by_type(bank_id)
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
fn settings_get_wrong_book_threshold(app: AppHandle) -> Result<i64, String> {
    open_store(&app)?.get_wrong_book_threshold()
}

#[tauri::command(rename_all = "camelCase")]
fn settings_set_wrong_book_threshold(app: AppHandle, threshold: i64) -> Result<(), String> {
    open_store(&app)?.set_wrong_book_threshold(threshold)
}

#[tauri::command(rename_all = "camelCase")]
fn settings_get_api_config(app: AppHandle) -> Result<PublicApiConfig, String> {
    open_store(&app)?
        .get_api_config()
        .map(public_api_config_from_database)
}

#[tauri::command(rename_all = "camelCase")]
fn settings_set_api_config(
    app: AppHandle,
    config: database::ApiConfig,
) -> Result<serde_json::Value, String> {
    open_store(&app)?.set_api_config(config)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
async fn settings_test_api_connection(app: AppHandle) -> Result<serde_json::Value, String> {
    let config = open_store(&app)?.get_api_config()?;
    ai::test_connection(&ai_config_from_database(config)).await
}

#[tauri::command(rename_all = "camelCase")]
fn migration_get_legacy_status(app: AppHandle) -> Result<database::LegacyDatabaseStatus, String> {
    let target_path = database_path(&app)?;
    let candidates = legacy_candidates(&app)?;
    database::legacy_database_status(&target_path, &candidates)
}

#[tauri::command(rename_all = "camelCase")]
fn migration_backup_and_replace_from_legacy(
    app: AppHandle,
    legacy_path: String,
    confirmation: String,
) -> Result<database::LegacyDatabaseReplaceResult, String> {
    let target_path = database_path(&app)?;
    let candidates = legacy_candidates(&app)?;
    database::replace_target_with_legacy_candidate(
        &target_path,
        Path::new(legacy_path.as_str()),
        &candidates,
        confirmation.as_str(),
    )
}

#[tauri::command(rename_all = "camelCase")]
async fn ai_parse_questions(app: AppHandle, content: String) -> Result<serde_json::Value, String> {
    let config = open_store(&app)?.get_api_config()?;
    ai::parse_questions_with_ai(&ai_config_from_database(config), content.as_str()).await
}

#[tauri::command(rename_all = "camelCase")]
async fn ai_chat(
    app: AppHandle,
    messages: Vec<ai::AiMessage>,
    prompt_id: Option<i64>,
) -> Result<serde_json::Value, String> {
    let store = open_store(&app)?;
    let config = store.get_api_config()?;
    let custom_prompt = prompt_id
        .and_then(|id| store.get_prompt_by_id(id).ok().flatten())
        .map(|prompt| prompt.content);
    ai::chat_with_ai(&ai_config_from_database(config), messages, custom_prompt).await
}

fn ai_config_from_database(config: database::ApiConfig) -> ai::AiConfig {
    ai::AiConfig {
        api_key: config.api_key,
        api_url: config.api_url,
        model_id: config.model_id,
    }
}

fn public_api_config_from_database(config: database::ApiConfig) -> PublicApiConfig {
    let api_key = config.api_key.trim().to_string();
    PublicApiConfig {
        api_key: String::new(),
        api_key_preview: mask_api_key(api_key.as_str()),
        has_api_key: !api_key.is_empty(),
        api_url: config.api_url,
        model_id: config.model_id,
        provider: config.provider,
    }
}

fn mask_api_key(api_key: &str) -> String {
    let value = api_key.trim();
    if value.is_empty() {
        return String::new();
    }
    if value.chars().count() <= 8 {
        return "••••".to_string();
    }

    let prefix: String = value.chars().take(4).collect();
    let suffix: String = value
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("{prefix}••••{suffix}")
}

#[tauri::command(rename_all = "camelCase")]
fn draft_save(app: AppHandle, data: serde_json::Value) -> Result<serde_json::Value, String> {
    open_store(&app)?.save_draft(data)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
fn draft_load(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    open_store(&app)?.load_draft()
}

#[tauri::command(rename_all = "camelCase")]
fn draft_clear(app: AppHandle) -> Result<serde_json::Value, String> {
    open_store(&app)?.clear_draft()?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
fn prompt_get_all(app: AppHandle) -> Result<Vec<database::Prompt>, String> {
    open_store(&app)?.get_all_prompts()
}

#[tauri::command(rename_all = "camelCase")]
fn prompt_get_by_id(app: AppHandle, id: i64) -> Result<Option<database::Prompt>, String> {
    open_store(&app)?.get_prompt_by_id(id)
}

#[tauri::command(rename_all = "camelCase")]
fn prompt_create(
    app: AppHandle,
    data: database::CreatePromptInput,
) -> Result<database::Prompt, String> {
    open_store(&app)?.create_prompt(data)
}

#[tauri::command(rename_all = "camelCase")]
fn prompt_update(
    app: AppHandle,
    id: i64,
    data: database::CreatePromptInput,
) -> Result<Option<database::Prompt>, String> {
    open_store(&app)?.update_prompt(id, data)
}

#[tauri::command(rename_all = "camelCase")]
fn prompt_delete(app: AppHandle, id: i64) -> Result<serde_json::Value, String> {
    open_store(&app)?.delete_prompt(id)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
fn chat_history_save(
    app: AppHandle,
    data: database::ChatHistoryInput,
) -> Result<database::ChatHistory, String> {
    open_store(&app)?.save_chat_history(data)
}

#[tauri::command(rename_all = "camelCase")]
fn chat_history_update(
    app: AppHandle,
    id: i64,
    messages: serde_json::Value,
) -> Result<Option<database::ChatHistory>, String> {
    open_store(&app)?.update_chat_history(id, messages)
}

#[tauri::command(rename_all = "camelCase")]
fn chat_history_get_all(
    app: AppHandle,
    limit: Option<u32>,
) -> Result<Vec<database::ChatHistory>, String> {
    open_store(&app)?.get_all_chat_history(limit)
}

#[tauri::command(rename_all = "camelCase")]
fn chat_history_get_by_id(
    app: AppHandle,
    id: i64,
) -> Result<Option<database::ChatHistory>, String> {
    open_store(&app)?.get_chat_history_by_id(id)
}

#[tauri::command(rename_all = "camelCase")]
fn chat_history_delete(app: AppHandle, id: i64) -> Result<serde_json::Value, String> {
    open_store(&app)?.delete_chat_history(id)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
fn practice_save_record(
    app: AppHandle,
    record: database::PracticeRecordInput,
) -> Result<serde_json::Value, String> {
    open_store(&app)?.save_practice_record(record)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
fn practice_get_records(
    app: AppHandle,
    bank_id: i64,
    limit: Option<u32>,
) -> Result<Vec<database::PracticeRecord>, String> {
    open_store(&app)?.get_practice_records(bank_id, limit)
}

#[tauri::command(rename_all = "camelCase")]
fn practice_get_all_stats(app: AppHandle) -> Result<Vec<database::PracticeStats>, String> {
    open_store(&app)?.get_all_practice_stats()
}

#[tauri::command(rename_all = "camelCase")]
fn wrong_book_get_counts_by_bank(app: AppHandle) -> Result<Vec<database::WrongBookCount>, String> {
    open_store(&app)?.get_wrong_book_counts_by_bank()
}

#[tauri::command(rename_all = "camelCase")]
fn wrong_book_get_items(
    app: AppHandle,
    bank_id: Option<i64>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<PaginatedWrongBookItems, String> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 1000);
    let offset = (page - 1) * page_size;
    let store = open_store(&app)?;
    let data = store.get_wrong_book_items(bank_id, offset, page_size)?;
    let total = store.count_wrong_book_items(bank_id)?;
    Ok(paginated_wrong_book_items(data, total, page, page_size))
}

#[tauri::command(rename_all = "camelCase")]
fn wrong_book_get_random_questions(
    app: AppHandle,
    bank_id: Option<i64>,
    limit: Option<u32>,
) -> Result<Vec<database::Question>, String> {
    open_store(&app)?.get_random_wrong_questions(bank_id, limit)
}

#[tauri::command(rename_all = "camelCase")]
fn wrong_book_update_from_practice(
    app: AppHandle,
    results: Vec<database::WrongBookPracticeResult>,
    threshold: Option<i64>,
) -> Result<serde_json::Value, String> {
    open_store(&app)?.update_wrong_book_from_practice(results, threshold)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
fn wrong_book_remove_item(app: AppHandle, question_id: i64) -> Result<serde_json::Value, String> {
    open_store(&app)?.remove_wrong_book_item(question_id)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
fn wrong_book_clear(app: AppHandle, bank_id: Option<i64>) -> Result<serde_json::Value, String> {
    open_store(&app)?.clear_wrong_book(bank_id)?;
    Ok(serde_json::json!({ "success": true }))
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
fn csv_download_template(window: WebviewWindow) -> Result<serde_json::Value, String> {
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
        .map_err(|error| format!("保存 CSV 模板失败: {error}"))?;

    Ok(serde_json::json!({
        "success": true,
        "filePath": file_path.to_string(),
    }))
}

#[tauri::command(rename_all = "camelCase")]
fn csv_parse_file(file_path: String) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(Path::new(&file_path))
        .map_err(|error| format!("读取 CSV 文件失败: {error}"))?;
    serde_json::to_value(csv_tools::parse_csv_content(content.as_str())?)
        .map_err(|error| format!("序列化 CSV 解析结果失败: {error}"))
}

#[tauri::command(rename_all = "camelCase")]
fn csv_import(
    app: AppHandle,
    bank_id: i64,
    questions: Vec<database::CreateQuestionInput>,
) -> Result<database::ImportResult, String> {
    open_store(&app)?.create_questions_batch(bank_id, questions)
}

#[tauri::command(rename_all = "camelCase")]
fn csv_export(
    app: AppHandle,
    window: WebviewWindow,
    bank_id: i64,
) -> Result<serde_json::Value, String> {
    let store = open_store(&app)?;
    let bank = store
        .get_bank_by_id(bank_id)?
        .ok_or_else(|| "题库不存在".to_string())?;
    let total = store.count_questions(bank_id, String::new(), None)?;
    if total <= 0 {
        return Err("题库中没有题目可导出".to_string());
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
        .map_err(|error| format!("保存 CSV 文件失败: {error}"))?;

    Ok(serde_json::json!({
        "success": true,
        "filePath": file_path.to_string(),
        "count": questions.len(),
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
            stats_get_dashboard,
            stats_get_operation_logs,
            stats_get_type_distribution,
            settings_get_theme,
            settings_set_theme,
            settings_get_api_config,
            settings_set_api_config,
            settings_test_api_connection,
            migration_get_legacy_status,
            migration_backup_and_replace_from_legacy,
            ai_parse_questions,
            ai_chat,
            settings_get_wrong_book_threshold,
            settings_set_wrong_book_threshold,
            draft_save,
            draft_load,
            draft_clear,
            prompt_get_all,
            prompt_get_by_id,
            prompt_create,
            prompt_update,
            prompt_delete,
            chat_history_save,
            chat_history_update,
            chat_history_get_all,
            chat_history_get_by_id,
            chat_history_delete,
            practice_save_record,
            practice_get_records,
            practice_get_all_stats,
            wrong_book_get_counts_by_bank,
            wrong_book_get_items,
            wrong_book_get_random_questions,
            wrong_book_update_from_practice,
            wrong_book_remove_item,
            wrong_book_clear,
            csv_download_template,
            csv_select_file,
            csv_parse_file,
            csv_import,
            csv_export
        ])
        .run(tauri::generate_context!())
        .expect("启动 QuestPilot Tauri 应用失败");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_api_config_does_not_expose_full_api_key() {
        let raw_key = "token-test-1234567890abcdef".to_string();
        let public_config = public_api_config_from_database(database::ApiConfig {
            api_key: raw_key.clone(),
            api_url: "https://api.example.com".to_string(),
            model_id: "model-x".to_string(),
            provider: "openai".to_string(),
        });

        assert_eq!(public_config.api_key, "");
        assert!(public_config.has_api_key);
        assert_eq!(public_config.api_url, "https://api.example.com");
        assert_eq!(public_config.model_id, "model-x");
        assert_eq!(public_config.provider, "openai");
        assert_ne!(public_config.api_key_preview, raw_key);
        assert!(!public_config.api_key_preview.contains(raw_key.as_str()));
        assert!(public_config.api_key_preview.starts_with("toke"));
        assert!(public_config.api_key_preview.ends_with("cdef"));
    }
}
