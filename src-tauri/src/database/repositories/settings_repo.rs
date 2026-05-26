use crate::database::{ApiConfig, DatabaseStore};

/// 设置数据访问对象（Phase 1：包装 DatabaseStore）。
///
/// 封装 `settings`、`drafts` 表以及 keychain API Key 相关的 SQL 操作，
/// 向 `SettingsService` 提供纯数据访问接口。
///
/// ## async !Send 约束说明
/// `SettingsRepository` 内含 `RefCell<Connection>`（`!Send`）。
/// 在 async command 中需在 `.await` 前让 `SettingsRepository`（及其持有的 `SettingsService`）析构：
/// ```rust
/// let config = SettingsService::new(open_store(&app)?).get_api_config()?;
/// // SettingsService 已析构 → await 不跨越 !Send 类型
/// crate::ai::test_connection(&...).await...
/// ```
///
/// ## 演进路径
/// Phase 1：持有 `DatabaseStore`，委托现有方法。
/// Phase 2+：直接持有 `Connection`，消除对 `DatabaseStore` 的依赖。
pub struct SettingsRepository {
    store: DatabaseStore,
}

impl SettingsRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 读取主题设置（light / dark / system，默认 system）。
    pub fn get_theme(&self) -> Result<String, String> {
        self.store.get_theme()
    }

    /// 保存主题设置。
    pub fn set_theme(&self, theme: String) -> Result<(), String> {
        self.store.set_theme(theme)
    }

    /// 读取错题本移除阈值（默认 3）。
    pub fn get_wrong_book_threshold(&self) -> Result<i64, String> {
        self.store.get_wrong_book_threshold()
    }

    /// 保存错题本移除阈值。
    pub fn set_wrong_book_threshold(&self, threshold: i64) -> Result<(), String> {
        self.store.set_wrong_book_threshold(threshold)
    }

    /// 读取 AI API 配置（优先从 keychain 读取 API Key）。
    pub fn get_api_config(&self) -> Result<ApiConfig, String> {
        self.store.get_api_config()
    }

    /// 保存 AI API 配置（同时写入 keychain 和 SQLite）。
    pub fn set_api_config(&self, config: ApiConfig) -> Result<(), String> {
        self.store.set_api_config(config)
    }
}
