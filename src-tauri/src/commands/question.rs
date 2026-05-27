use tauri::AppHandle;

use crate::database;
use crate::error::AppError;
use crate::services::import_service::ImportService;
use crate::services::question_service::QuestionService;

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
    QuestionService::new(open_store(&app)?).create(bank_id, data)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_create_batch(
    app: AppHandle,
    bank_id: i64,
    questions: Vec<database::CreateQuestionInput>,
) -> Result<database::ImportResult, AppError> {
    Ok(ImportService::new(open_store(&app)?).import_questions(bank_id, questions)?)
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
    let (data, total) = QuestionService::new(open_store(&app)?).get_by_bank_paginated(
        bank_id,
        offset,
        page_size,
        question_type,
    )?;
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
    QuestionService::new(open_store(&app)?).get_random(bank_id, limit, question_type)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_get_by_id(app: AppHandle, id: i64) -> Result<Option<database::Question>, AppError> {
    QuestionService::new(open_store(&app)?).get_by_id(id)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_update(
    app: AppHandle,
    id: i64,
    data: database::CreateQuestionInput,
) -> Result<Option<database::Question>, AppError> {
    QuestionService::new(open_store(&app)?).update(id, data)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn question_delete(app: AppHandle, ids: Vec<i64>) -> Result<(), AppError> {
    QuestionService::new(open_store(&app)?).delete(&ids)
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
    let (data, total) = QuestionService::new(open_store(&app)?).search_paginated(
        bank_id,
        keyword,
        offset,
        page_size,
        question_type,
    )?;
    Ok(paginated_questions(data, total, page, page_size))
}
