use crate::database::DatabaseStore;

/// 题目导入业务服务（骨架）。
///
/// 未来将统一收口 CSV 导入、AI 导入、JSON 导入的业务编排逻辑。
/// 当前阶段仅建立结构，具体迁移在后续 Phase 中逐步完成。
///
/// # TODO (Phase 2+)
/// - 迁移 `csv_import` command 中的批量写入逻辑
/// - 迁移 AI 解析后的批量题目入库流程
/// - 统一导入结果（`ImportResult`）的业务校验规则
pub struct ImportService {
    #[allow(dead_code)]
    store: DatabaseStore,
}

impl ImportService {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }
}
