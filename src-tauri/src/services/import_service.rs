use crate::database::{CreateQuestionInput, DatabaseStore, ImportError, ImportResult};
use crate::error::AppError;

/// 题目导入业务服务。
///
/// 统一收口 CSV、JSON、AI 解析结果的批量导入业务编排：
/// - 接收前端传入的结构化题目列表
/// - 委托 [`DatabaseStore::create_questions_batch`] 完成校验 + 事务写入
/// - 汇总导入结果（成功数 / 失败数 / 错误原因）
///
/// Command 层只负责接收参数并调用此 Service，不再直接操作 DatabaseStore。
pub struct ImportService {
    store: DatabaseStore,
}

impl ImportService {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 批量导入题目（CSV、JSON、AI 解析结果均走此入口）。
    ///
    /// ## 业务流程
    /// 1. 基础参数校验（bank_id > 0、questions 非空）由 `DatabaseStore::create_questions_batch` 负责
    /// 2. 逐题字段校验（`validate_question`），收集 `ImportError`
    /// 3. 有效题目在单个事务中批量写入，失败则整体回滚
    /// 4. 返回 `ImportResult` 包含 success / failed / errors
    ///
    /// ## 复用的 DatabaseStore 方法
    /// - `create_questions_batch`：含校验 + 事务 + operation_log
    pub fn import_questions(
        &self,
        bank_id: i64,
        questions: Vec<CreateQuestionInput>,
    ) -> Result<ImportResult, AppError> {
        Ok(self.store.create_questions_batch(bank_id, questions)?)
    }

    /// 从 AI 解析返回的 JSON 中提取题目列表、分块错误和解析计数。
    ///
    /// 静态方法，纯数据转换，无 I/O。可在 `await` 前后任意位置调用，不涉及
    /// `DatabaseStore`，因此不会引发 `!Send` 编译错误。
    ///
    /// - 反序列化失败的单条目（AI 格式异常）静默跳过
    /// - 返回 `(questions, chunk_errors, parsed_count)`
    pub fn extract_ai_response(
        ai_result: serde_json::Value,
    ) -> (Vec<CreateQuestionInput>, Vec<serde_json::Value>, usize) {
        let questions_json = ai_result
            .get("questions")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        let parsed_count = questions_json.len();

        let chunk_errors = ai_result
            .get("chunkErrors")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let questions: Vec<CreateQuestionInput> = questions_json
            .into_iter()
            .filter_map(|q| serde_json::from_value(q).ok())
            .collect();

        (questions, chunk_errors, parsed_count)
    }

    /// 将已提取的 AI 题目写入数据库，返回组合结果 [`AiImportResult`]。
    ///
    /// ## 设计说明
    /// `DatabaseStore` 内含 `RefCell<Connection>`（`!Send`），若将 AI 网络调用（`async`）
    /// 与 DB 写入合并在同一个 `async &self` 方法中，会因 `self` 跨越 `.await`
    /// 而导致 future `!Send`，Tauri invoke_handler 无法接受。
    ///
    /// 因此将 AI 解析（异步，command 层负责）与 DB 写入（同步，此方法）分离：
    /// - Command 层：drop store → AI `.await` → 重新 open store → 调用此方法
    /// - Service 层：只做同步的空判断 + 批量写入编排
    ///
    /// ## 参数
    /// - `bank_id`：目标题库 ID
    /// - `questions`：已反序列化的题目列表（来自 `extract_ai_response`）
    /// - `chunk_errors`：AI 分块错误（透传至返回结果）
    /// - `parsed_count`：AI 原始解析数量（透传至返回结果）
    pub fn import_from_ai_result(
        &self,
        bank_id: i64,
        questions: Vec<CreateQuestionInput>,
        chunk_errors: Vec<serde_json::Value>,
        parsed_count: usize,
    ) -> Result<AiImportResult, AppError> {
        // 无有效题目时直接返回，不触发 create_questions_batch 的空数组错误
        if questions.is_empty() {
            return Ok(AiImportResult {
                import: ImportResult {
                    success: 0,
                    failed: 0,
                    errors: Vec::<ImportError>::new(),
                },
                chunk_errors,
                parsed_count,
            });
        }

        // 批量入库（含字段校验 + 事务）
        let import = self.import_questions(bank_id, questions)?;

        Ok(AiImportResult {
            import,
            chunk_errors,
            parsed_count,
        })
    }
}

/// AI 解析 + 批量导入的组合结果。
///
/// 包含 DB 导入细节与 AI 分块解析统计，供 `ai_import_questions_direct` command 返回给前端。
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiImportResult {
    /// DB 批量导入结果（success / failed / errors）
    pub import: ImportResult,
    /// AI 分块解析错误（每块的 chunkIndex + message）
    pub chunk_errors: Vec<serde_json::Value>,
    /// AI 解析出的题目总数（入库前）
    pub parsed_count: usize,
}
