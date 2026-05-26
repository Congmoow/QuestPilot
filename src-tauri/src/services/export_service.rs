use rusqlite::{params, OptionalExtension};

use crate::database::repositories::helpers::{count_questions, query_questions};
use crate::database::{DatabaseStore, Question};
use crate::error::AppError;

/// CSV 导出业务服务。
///
/// 负责题库导出的业务编排：查询题库信息 + 获取题目列表 + 业务规则校验。
/// 文件系统操作（对话框、写文件）保留在 Command 层，Service 只负责 DB 查询和业务规则。
///
/// ## 层次结构
/// `CsvExportCommand` → `ExportService` → `DatabaseStore::with_connection` → SQLite
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
        let (bank_name, total) = self.store.with_connection(|conn| {
            // 查询题库名称
            let name = conn
                .query_row(
                    "SELECT qb.name FROM question_banks qb WHERE qb.id = ?1",
                    params![bank_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()
                .map_err(|e| format!("读取题库失败: {e}"))?;
            let bank_name = name.ok_or_else(|| "题库不存在".to_string())?;
            let total = count_questions(conn, bank_id, "", None)?;
            Ok((bank_name, total))
        })?;

        if total <= 0 {
            return Err(AppError::Database("题库中没有题目可导出".into()));
        }

        let questions = self.store.with_connection(|conn| {
            query_questions(conn, bank_id, "", None, 0, total.min(100_000) as u32)
        })?;

        Ok((bank_name, questions))
    }
}
