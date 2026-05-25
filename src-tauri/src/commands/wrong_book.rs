use tauri::AppHandle;

use crate::database;

use super::{open_store, question::total_pages};

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedWrongBookItems {
    pub data: Vec<database::WrongBookItem>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
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
pub fn wrong_book_get_counts_by_bank(
    app: AppHandle,
) -> Result<Vec<database::WrongBookCount>, String> {
    open_store(&app)?.get_wrong_book_counts_by_bank()
}

#[tauri::command(rename_all = "camelCase")]
pub fn wrong_book_get_items(
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
pub fn wrong_book_get_random_questions(
    app: AppHandle,
    bank_id: Option<i64>,
    limit: Option<u32>,
) -> Result<Vec<database::Question>, String> {
    open_store(&app)?.get_random_wrong_questions(bank_id, limit)
}

#[tauri::command(rename_all = "camelCase")]
pub fn wrong_book_update_from_practice(
    app: AppHandle,
    results: Vec<database::WrongBookPracticeResult>,
    threshold: Option<i64>,
) -> Result<serde_json::Value, String> {
    open_store(&app)?.update_wrong_book_from_practice(results, threshold)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
pub fn wrong_book_remove_item(
    app: AppHandle,
    question_id: i64,
) -> Result<serde_json::Value, String> {
    open_store(&app)?.remove_wrong_book_item(question_id)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
pub fn wrong_book_clear(
    app: AppHandle,
    bank_id: Option<i64>,
) -> Result<serde_json::Value, String> {
    open_store(&app)?.clear_wrong_book(bank_id)?;
    Ok(serde_json::json!({ "success": true }))
}
