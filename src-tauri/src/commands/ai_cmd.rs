use tauri::AppHandle;

use crate::ai;
use crate::error::AppError;
use crate::services::import_service::{AiImportResult, ImportService};
use crate::services::settings_service::SettingsService;

use super::{ai_config_from_database, open_store};

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app, content), err)]
pub async fn ai_parse_questions(
    app: AppHandle,
    content: String,
) -> Result<serde_json::Value, AppError> {
    // SettingsService 临时值在语句末析构，确保 !Send 类型不跨越 .await
    let config = SettingsService::new(open_store(&app)?).get_api_config()?;
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

/// 新增：AI 解析 + 批量入库，端到端快速导入（一次 invoke）。
///
/// ## 与旧流程的关系
/// - 旧流程：`ai_parse_questions` → 前端预览/编辑 → `question_create_batch`（保持不变）
/// - 新流程：此 command → `ImportService` 两阶段 → 跳过预览直接写库
///
/// ## 两阶段设计（解决 `RefCell<Connection>: !Send` 限制）
/// `DatabaseStore` 含 `RefCell<Connection>` 不实现 `Send`，若在持有 store 时跨越 `.await`
/// 会导致 future `!Send`，Tauri invoke_handler 拒绝编译。
///
/// 解决方案：参考现有 `ai_chat` command 的模式——
/// - Phase 1：在 `await` 前 drop store，只保留 `Send` 的 `AiConfig`
/// - Phase 2：`await` 后重新 open store，同步写库
#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app, content), err)]
pub async fn ai_import_questions_direct(
    app: AppHandle,
    content: String,
    bank_id: i64,
) -> Result<AiImportResult, AppError> {
    // Phase 1：SettingsService 临时值在语句末析构，await 前无 !Send 类型存活
    let ai_config = ai_config_from_database(SettingsService::new(open_store(&app)?).get_api_config()?);

    // AI 解析（异步，不持有 DatabaseStore）
    let ai_result = ai::parse_questions_with_ai(&ai_config, &content)
        .await
        .map_err(AppError::Ai)?;

    // 纯数据转换（Service 静态方法，无 I/O）
    let (questions, chunk_errors, parsed_count) = ImportService::extract_ai_response(ai_result);

    // Phase 2：await 后重新打开 store，同步写库
    ImportService::new(open_store(&app)?)
        .import_from_ai_result(bank_id, questions, chunk_errors, parsed_count)
}
