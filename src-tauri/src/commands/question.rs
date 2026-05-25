use tauri::AppHandle;

use crate::database;
use crate::error::AppError;

use super::open_store;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedQuestions {
    pub data: Vec<database::Question>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
}

pub fn total_pages(total: i64, page_size: u32) -> u32 {
    if page_size == 0 {
        0
    } else {
        ((total + i64::from(page_size) - 1) / i64::from(page_size)) as u32
    }
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

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_create(
    app: AppHandle,
    data: database::CreateQuestionInput,
    bank_id: i64,
) -> Result<database::Question, AppError> {
    Ok(open_store(&app)?.create_question(bank_id, data)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_create_batch(
    app: AppHandle,
    bank_id: i64,
    questions: Vec<database::CreateQuestionInput>,
) -> Result<database::ImportResult, AppError> {
    Ok(open_store(&app)?.create_questions_batch(bank_id, questions)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_get_by_bank_id(
    app: AppHandle,
    bank_id: i64,
    page: Option<u32>,
    page_size: Option<u32>,
    question_type: Option<String>,
) -> Result<PaginatedQuestions, AppError> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 1000);
    let offset = (page - 1) * page_size;
    let store = open_store(&app)?;
    let data = store.get_questions_by_bank_id(bank_id, offset, page_size, question_type.clone())?;
    let total = store.count_questions(bank_id, String::new(), question_type)?;
    Ok(paginated_questions(data, total, page, page_size))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_get_random(
    app: AppHandle,
    bank_id: i64,
    limit: Option<u32>,
    question_type: Option<String>,
) -> Result<Vec<database::Question>, AppError> {
    Ok(open_store(&app)?.get_random_questions(bank_id, limit, question_type)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_get_by_id(app: AppHandle, id: i64) -> Result<Option<database::Question>, AppError> {
    Ok(open_store(&app)?.get_question_by_id(id)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_update(
    app: AppHandle,
    id: i64,
    data: database::CreateQuestionInput,
) -> Result<Option<database::Question>, AppError> {
    Ok(open_store(&app)?.update_question(id, data)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_delete(app: AppHandle, ids: Vec<i64>) -> Result<(), AppError> {
    if ids.is_empty() {
        return Err(AppError::Database("请选择要删除的题目".into()));
    }
    Ok(open_store(&app)?.delete_questions(&ids)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_search(
    app: AppHandle,
    bank_id: i64,
    keyword: String,
    page: Option<u32>,
    page_size: Option<u32>,
    question_type: Option<String>,
) -> Result<PaginatedQuestions, AppError> {
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
