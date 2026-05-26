use crate::database::{DatabaseStore, Question};
use crate::error::AppError;

/// CSV 导出业务服务。
///
/// 负责题库导出的业务编排：查询题库信息 + 获取题目列表 + 业务规则校验。
/// 文件系统操作（对话框、写文件）保留在 Command 层，Service 只负责 DB 查询和业务规则。
///
/// ## 设计说明
/// Export 是跨题库（`question_banks`）和题目（`questions`）的聚合读操作。
/// Phase 1 直接持有 `DatabaseStore` 进行跨域查询，避免为只读聚合引入多 Store 实例。
/// 后续可拆分为持有 `QuestionBankRepository` + `QuestionRepository` 的双 Repo 模式。
///
/// ## 层次结构
/// `CsvExportCommand` → `ExportService` → `DatabaseStore` → SQLite
pub struct ExportService {
    store: DatabaseStore,
}

impl ExportService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容）。
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 准备导出数据：校验题库和题目是否存在，返回 `(bank_name, questions)`。
    ///
    /// ## 业务规则
    /// - 题库不存在 → `AppError::Database("题库不存在")`
    /// - 题库无题目 → `AppError::Database("题库中没有题目可导出")`
    /// - 单次最多导出 10 万道题目（业务上限）
    ///
    /// 文件对话框、CSV 序列化、文件写入保留在 Command 层。
    pub fn prepare_export(&self, bank_id: i64) -> Result<(String, Vec<Question>), AppError> {
        let bank = self
            .store
            .get_bank_by_id(bank_id)?
            .ok_or_else(|| AppError::Database("题库不存在".into()))?;

        let total = self
            .store
            .count_questions(bank_id, String::new(), None)?;
        if total <= 0 {
            return Err(AppError::Database("题库中没有题目可导出".into()));
        }

        let questions = self
            .store
            .get_questions_by_bank_id(bank_id, 0, total.min(100_000) as u32, None)?;

        Ok((bank.name, questions))
    }
}
