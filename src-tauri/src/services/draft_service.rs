use crate::database::{DatabaseStore, DraftRepository};
use crate::error::AppError;

/// 草稿业务服务。
///
/// 负责草稿的保存、读取和清除，通过 [`DraftRepository`] 访问数据库。
/// 草稿使用 SQLite `drafts` 表单行持久化，用于 AI 对话导入等场景的暂存。
///
/// ## 层次结构
/// `DraftCommand` → `DraftService` → `DraftRepository` → `DatabaseStore` → SQLite
pub struct DraftService {
    repo: DraftRepository,
}

impl DraftService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `DraftRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: DraftRepository::new(store),
        }
    }

    /// 保存草稿（覆盖已有草稿）。
    pub fn save(&self, data: serde_json::Value) -> Result<(), AppError> {
        Ok(self.repo.save(data)?)
    }

    /// 读取草稿（不存在时返回 `None`）。
    pub fn load(&self) -> Result<Option<serde_json::Value>, AppError> {
        Ok(self.repo.load()?)
    }

    /// 清除草稿。
    pub fn clear(&self) -> Result<(), AppError> {
        Ok(self.repo.clear()?)
    }
}
