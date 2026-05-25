use tauri::AppHandle;

use crate::ai;
use crate::error::AppError;

use super::{ai_config_from_database, open_store};

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app, content), err)]
pub async fn ai_parse_questions(
    app: AppHandle,
    content: String,
) -> Result<serde_json::Value, AppError> {
    let config = open_store(&app)?.get_api_config()?;
    ai::parse_questions_with_ai(&ai_config_from_database(config), content.as_str())
        .await
        .map_err(AppError::Ai)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app, messages), err)]
pub async fn ai_chat(
    app: AppHandle,
    messages: Vec<ai::AiMessage>,
    prompt_id: Option<i64>,
) -> Result<serde_json::Value, AppError> {
    let store = open_store(&app)?;
    let config = store.get_api_config()?;
    let custom_prompt = prompt_id
        .and_then(|id| store.get_prompt_by_id(id).ok().flatten())
        .map(|prompt| prompt.content);
    ai::chat_with_ai(&ai_config_from_database(config), messages, custom_prompt)
        .await
        .map_err(AppError::Ai)
}
