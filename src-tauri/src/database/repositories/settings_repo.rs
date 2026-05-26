use rusqlite::{params, OptionalExtension};

use crate::database::{ApiConfig, DatabaseStore};
use super::super::validation::default_if_blank;

const KEYCHAIN_SERVICE: &str = "questpilot";
const KEYCHAIN_ACCOUNT: &str = "ai_api_key";

/// 设置数据访问对象（Phase 2：通过 `DatabaseStore::with_connection` 直接执行 SQL）。
///
/// 封装 `settings` 表读写及 keychain API Key 操作。
///
/// ## async !Send 约束说明
/// 在 async command 中需在 `.await` 前让 `SettingsRepository`（及 `SettingsService`）析构：
/// ```rust,ignore
/// let config = SettingsService::new(open_store(&app)?).get_api_config()?;
/// // SettingsService 已析构 → await 不跨越 !Send 类型
/// ```
pub struct SettingsRepository {
    store: DatabaseStore,
}

impl SettingsRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 读取主题设置（light / dark / system，默认 system）。
    pub fn get_theme(&self) -> Result<String, String> {
        self.store.with_connection(|conn| {
            let theme = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'theme'",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .optional()
                .map_err(|e| format!("读取主题设置失败: {e}"))?;
            if matches!(theme.as_deref(), Some("light" | "dark" | "system")) {
                Ok(theme.unwrap())
            } else {
                Ok("system".to_string())
            }
        })
    }

    /// 保存主题设置（light / dark / system）。
    pub fn set_theme(&self, theme: String) -> Result<(), String> {
        if !matches!(theme.as_str(), "light" | "dark" | "system") {
            return Err("无效的主题设置".to_string());
        }
        self.store.with_connection(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?1)",
                params![theme.as_str()],
            )
            .map_err(|e| format!("保存主题设置失败: {e}"))?;
            Ok(())
        })
    }

    /// 读取错题本移除阈值（默认 3）。
    pub fn get_wrong_book_threshold(&self) -> Result<i64, String> {
        self.store.with_connection(|conn| {
            let raw = get_setting_sql(conn, "wrong_book_threshold")?;
            Ok(raw
                .and_then(|v| v.parse::<i64>().ok())
                .filter(|v| *v > 0)
                .unwrap_or(3))
        })
    }

    /// 保存错题本移除阈值（≤0 时存 3），并写操作日志。
    pub fn set_wrong_book_threshold(&self, threshold: i64) -> Result<(), String> {
        let safe = if threshold > 0 { threshold } else { 3 };
        self.store.with_connection(|conn| {
            set_setting_sql(conn, "wrong_book_threshold", &safe.to_string())?;
            add_operation_log_sql(
                conn,
                "更改设置",
                format!("错题移除阈值设置为 {safe}"),
            )
        })
    }

    /// 读取完整 AI API 配置。
    ///
    /// 优先从系统密钥库读取 API Key；不存在时检查 SQLite 旧版明文 Key 并尝试迁移。
    pub fn get_api_config(&self) -> Result<ApiConfig, String> {
        self.store.with_connection(|conn| {
            let api_key = match read_keychain_key() {
                Some(key) => key,
                None => {
                    let legacy = get_setting_sql(conn, "ai_api_key")?
                        .unwrap_or_default()
                        .trim()
                        .to_string();
                    if !legacy.is_empty() {
                        match write_keychain_key(&legacy) {
                            Ok(()) => {
                                tracing::info!("已将 API Key 迁移至系统密钥库");
                                let _ = set_setting_sql(conn, "ai_api_key", "");
                            }
                            Err(e) => {
                                tracing::warn!("API Key 迁移失败（将保留原有存储）: {}", e);
                            }
                        }
                    }
                    legacy
                }
            };
            Ok(ApiConfig {
                api_key,
                api_url: get_setting_sql(conn, "ai_api_url")?
                    .unwrap_or_else(|| "https://api.openai.com".to_string()),
                model_id: get_setting_sql(conn, "ai_model_id")?
                    .unwrap_or_else(|| "gpt-3.5-turbo".to_string()),
                provider: get_setting_sql(conn, "ai_provider")?
                    .unwrap_or_else(|| "custom".to_string()),
            })
        })
    }

    /// 保存 AI API 配置。
    ///
    /// 非空 Key：SQLite 作可靠存储（必须成功），Keychain 作安全增强（尽力而为）。
    /// 空 Key：跳过 Key 写入，保留已有密钥。
    pub fn set_api_config(&self, config: ApiConfig) -> Result<(), String> {
        self.store.with_connection(|conn| {
            if !config.api_key.trim().is_empty() {
                let key = config.api_key.trim().to_string();
                set_setting_sql(conn, "ai_api_key", &key)?;
                if let Err(e) = write_keychain_key(&key) {
                    tracing::warn!("写入系统密钥库失败（非致命，仍保存于 SQLite）: {}", e);
                }
            }
            set_setting_sql(
                conn,
                "ai_api_url",
                &default_if_blank(&config.api_url, "https://api.openai.com"),
            )?;
            set_setting_sql(
                conn,
                "ai_model_id",
                &default_if_blank(&config.model_id, "gpt-3.5-turbo"),
            )?;
            set_setting_sql(
                conn,
                "ai_provider",
                &default_if_blank(&config.provider, "custom"),
            )?;
            add_operation_log_sql(conn, "更改设置", "更新 AI API 配置")
        })
    }
}

// ── Keychain helper（与 database/settings.rs 中函数行为完全一致）──────────────

fn read_keychain_key() -> Option<String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .ok()
        .and_then(|e| e.get_password().ok())
        .filter(|k| !k.trim().is_empty())
}

fn write_keychain_key(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|e| format!("初始化密钥库条目失败: {e}"))?;
    entry
        .set_password(key)
        .map_err(|e| format!("写入系统密钥库失败: {e}"))?;
    if read_keychain_key().as_deref() != Some(key) {
        return Err("系统密钥库写入验证失败（OS 未能持久化，将回退到 SQLite）".into());
    }
    Ok(())
}

// ── SQLite settings helper ───────────────────────────────────────────────────

fn get_setting_sql(conn: &rusqlite::Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| format!("读取设置失败: {e}"))
}

fn set_setting_sql(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| format!("保存设置失败: {e}"))?;
    Ok(())
}

fn add_operation_log_sql(
    conn: &rusqlite::Connection,
    action: &str,
    detail: impl AsRef<str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO operation_logs (action, detail, created_at) VALUES (?1, ?2, datetime('now'))",
        params![action, detail.as_ref()],
    )
    .map_err(|e| format!("写入操作日志失败: {e}"))?;
    Ok(())
}

