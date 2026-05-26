use crate::database::{CreatePromptInput, DatabaseStore, Prompt, PromptRepository};
use crate::error::AppError;

/// Prompt 业务服务。
///
/// 负责 AI 对话提示词的增删改查，通过 [`PromptRepository`] 访问数据库。
///
/// ## 层次结构
/// `PromptCommand` / `ai_chat` → `PromptService` → `PromptRepository` → `DatabaseStore` → SQLite
pub struct PromptService {
    repo: PromptRepository,
}

impl PromptService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `PromptRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: PromptRepository::new(store),
        }
    }

    /// 查询所有 Prompt（默认 Prompt 优先）。
    pub fn list_all(&self) -> Result<Vec<Prompt>, AppError> {
        Ok(self.repo.list_all()?)
    }

    /// 按 ID 查询单条 Prompt。
    pub fn get_by_id(&self, id: i64) -> Result<Option<Prompt>, AppError> {
        Ok(self.repo.find_by_id(id)?)
    }

    /// 创建 Prompt。
    pub fn create(&self, data: CreatePromptInput) -> Result<Prompt, AppError> {
        Ok(self.repo.create(data)?)
    }

    /// 更新 Prompt 名称/内容。
    pub fn update(&self, id: i64, data: CreatePromptInput) -> Result<Option<Prompt>, AppError> {
        Ok(self.repo.update(id, data)?)
    }

    /// 删除 Prompt（默认 Prompt 不可删除）。
    pub fn delete(&self, id: i64) -> Result<(), AppError> {
        Ok(self.repo.delete(id)?)
    }
}
