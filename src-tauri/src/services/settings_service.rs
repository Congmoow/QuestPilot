use crate::database::{ApiConfig, DatabaseStore, SettingsRepository};
use crate::error::AppError;

/// 设置业务服务。
///
/// 负责主题、AI API 配置、错题本阈值的读写，通过 [`SettingsRepository`] 访问数据库。
///
/// ## async !Send 使用模式
/// 在 async command 中（如 `settings_test_api_connection`、`ai_parse_questions`），
/// 必须确保 `SettingsService`（含 `!Send` 的 `SettingsRepository`）在 `.await` 前析构：
/// ```rust
/// let config = SettingsService::new(open_store(&app)?).get_api_config()?;
/// // ← SettingsService 临时值在语句末析构
/// some_async_call().await  // ← 此时无 !Send 类型存活
/// ```
///
/// ## 层次结构
/// `SettingsCommand` → `SettingsService` → `SettingsRepository` → `DatabaseStore` → SQLite
pub struct SettingsService {
    repo: SettingsRepository,
}

impl SettingsService {
    /// 接收 `DatabaseStore`（与 command 层接口保持兼容），内部创建 `SettingsRepository`。
    pub fn new(store: DatabaseStore) -> Self {
        Self {
            repo: SettingsRepository::new(store),
        }
    }

    /// 读取主题设置（light / dark / system，默认 system）。
    pub fn get_theme(&self) -> Result<String, AppError> {
        Ok(self.repo.get_theme()?)
    }

    /// 保存主题设置。
    pub fn set_theme(&self, theme: String) -> Result<(), AppError> {
        Ok(self.repo.set_theme(theme)?)
    }

    /// 读取错题本移除阈值（默认 3）。
    pub fn get_wrong_book_threshold(&self) -> Result<i64, AppError> {
        Ok(self.repo.get_wrong_book_threshold()?)
    }

    /// 保存错题本移除阈值。
    pub fn set_wrong_book_threshold(&self, threshold: i64) -> Result<(), AppError> {
        Ok(self.repo.set_wrong_book_threshold(threshold)?)
    }

    /// 读取 AI API 配置（优先从 keychain 读取 API Key）。
    pub fn get_api_config(&self) -> Result<ApiConfig, AppError> {
        Ok(self.repo.get_api_config()?)
    }

    /// 保存 AI API 配置（同时写入 keychain 和 SQLite）。
    pub fn set_api_config(&self, config: ApiConfig) -> Result<(), AppError> {
        Ok(self.repo.set_api_config(config)?)
    }
}
