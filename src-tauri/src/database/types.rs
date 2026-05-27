use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionBank {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub question_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub id: i64,
    pub bank_id: i64,
    pub r#type: String,
    pub content: String,
    pub options: Option<serde_json::Value>,
    pub answer: String,
    pub analysis: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQuestionBankInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQuestionInput {
    pub r#type: String,
    pub content: String,
    pub options: Option<serde_json::Value>,
    pub answer: String,
    pub analysis: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: usize,
    pub failed: usize,
    pub errors: Vec<ImportError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportError {
    pub index: usize,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeRecordInput {
    pub bank_id: i64,
    pub total: i64,
    pub correct: i64,
    pub wrong: i64,
    pub accuracy: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeRecord {
    pub id: i64,
    pub bank_id: i64,
    pub total: i64,
    pub correct: i64,
    pub wrong: i64,
    pub accuracy: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeStats {
    pub bank_id: i64,
    pub bank_name: String,
    pub practice_count: i64,
    pub avg_accuracy: i64,
    pub last_practice: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeDistribution {
    pub r#type: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_questions: i64,
    pub today_questions: i64,
    pub week_questions: i64,
    pub type_distribution: Vec<TypeDistribution>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationLog {
    pub id: i64,
    pub action: String,
    pub detail: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WrongBookCount {
    pub bank_id: i64,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WrongBookItem {
    pub question_id: i64,
    pub bank_id: i64,
    pub wrong_count: i64,
    pub correct_count: i64,
    pub added_at: String,
    pub last_wrong_at: String,
    pub question: Question,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WrongBookPracticeResult {
    pub question_id: i64,
    pub bank_id: i64,
    pub is_correct: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiConfig {
    pub api_key: String,
    pub api_url: String,
    pub model_id: String,
    pub provider: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePromptInput {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Prompt {
    pub id: i64,
    pub name: String,
    pub content: String,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistoryInput {
    pub title: Option<String>,
    pub messages: serde_json::Value,
    pub prompt_id: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub keep_id: i64,
    pub duplicate_ids: Vec<i64>,
    pub sample_content: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DedupResult {
    pub groups: Vec<DuplicateGroup>,
    pub total_duplicate_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistory {
    pub id: i64,
    pub title: String,
    pub messages: Option<serde_json::Value>,
    pub prompt_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}
