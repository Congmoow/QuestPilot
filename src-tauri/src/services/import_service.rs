use crate::database::{CreateQuestionInput, DatabaseStore, ImportResult};
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

    /// AI 解析结果导入入口（预留，Phase 5+ 实现）。
    ///
    /// # TODO (Phase 5)
    /// 当前 AI 导入流程：
    ///   前端调 `ai_parse_questions` → AI 返回解析 JSON → 前端展示预览 → 调 `question_create_batch` 保存
    ///
    /// 未来可在此处直接接受 AI 原始响应字符串，完成：
    /// - 调用 `ai::parse_questions_with_ai` 解析
    /// - 解析结果字段标准化
    /// - 调用 `import_questions` 批量入库
    /// - 返回统一的 `ImportResult`
    ///
    /// 当前 `ai_parse_questions` / `ai_chat` command 不写 DB，无需迁移，保持现状。
    #[allow(dead_code)]
    fn import_from_ai_placeholder(&self) {
        // TODO: Phase 5 实现
    }
}
