use rusqlite::{params, OptionalExtension};

use super::{
    queries::{add_operation_log, get_setting, set_setting},
    types::ApiConfig,
    validation::default_if_blank,
    DatabaseStore,
};

const KEYCHAIN_SERVICE: &str = "questpilot";
const KEYCHAIN_ACCOUNT: &str = "ai_api_key";

/// 从系统密钥库读取 API Key。失败时返回 `None`，不抛异常。
fn read_keychain_key() -> Option<String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .ok()
        .and_then(|e| e.get_password().ok())
        .filter(|k| !k.trim().is_empty())
}

/// 将 API Key 写入系统密钥库，并用新 Entry 实例回读验证持久化成功。
fn write_keychain_key(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|e| format!("初始化密钥库条目失败: {e}"))?;
    entry
        .set_password(key)
        .map_err(|e| format!("写入系统密钥库失败: {e}"))?;
    // 用独立 Entry 实例从 OS 回读（不依赖同一实例的缓存），验证真正持久化
    if read_keychain_key().as_deref() != Some(key) {
        return Err("系统密钥库写入验证失败（OS 未能持久化，将回退到 SQLite）".into());
    }
    Ok(())
}

/// 删除系统密钥库中的 API Key。失败时只记志警告，不中断流程。
#[allow(dead_code)]
fn delete_keychain_key() {
    if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT) {
        let _ = entry.delete_credential();
    }
}

impl DatabaseStore {
    pub fn get_theme(&self) -> Result<String, String> {
        let connection = self.connection.borrow();
        let theme = connection
            .query_row(
                "SELECT value FROM settings WHERE key = 'theme'",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("读取主题设置失败: {error}"))?;

        if matches!(theme.as_deref(), Some("light" | "dark" | "system")) {
            Ok(theme.unwrap())
        } else {
            Ok("system".to_string())
        }
    }

    pub fn set_theme(&self, theme: String) -> Result<(), String> {
        if !matches!(theme.as_str(), "light" | "dark" | "system") {
            return Err("无效的主题设置".to_string());
        }

        let connection = self.connection.borrow();
        connection
            .execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?1)",
                params![theme.as_str()],
            )
            .map_err(|error| format!("保存主题设置失败: {error}"))?;
        Ok(())
    }

    pub fn get_wrong_book_threshold(&self) -> Result<i64, String> {
        let connection = self.connection.borrow();
        get_setting(&connection, "wrong_book_threshold")?
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0)
            .map_or(Ok(3), Ok)
    }

    pub fn set_wrong_book_threshold(&self, threshold: i64) -> Result<(), String> {
        let safe_threshold = if threshold > 0 { threshold } else { 3 };
        let connection = self.connection.borrow();
        set_setting(
            &connection,
            "wrong_book_threshold",
            safe_threshold.to_string().as_str(),
        )?;
        add_operation_log(
            &connection,
            "更改设置",
            format!("错题移除阈值设置为 {safe_threshold}"),
        )
    }

    pub fn get_api_config(&self) -> Result<ApiConfig, String> {
        let connection = self.connection.borrow();

        // 优先从系统密钥库读取 API Key
        let api_key = match read_keychain_key() {
            Some(key) => key,
            None => {
                // 密钥库中不存在，检查 SQLite 中是否有旧版明文 Key
                let legacy = get_setting(&connection, "ai_api_key")?
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                if !legacy.is_empty() {
                    // 尝试迁移到密钥库
                    match write_keychain_key(&legacy) {
                        Ok(()) => {
                            tracing::info!("已将 API Key 迁移至系统密钥库");
                            // 迁移成功：清除 SQLite 明文
                            let _ = set_setting(&connection, "ai_api_key", "");
                        }
                        Err(e) => {
                            // 迁移失败：保留 SQLite 中的旧 Key 作为备用
                            tracing::warn!("API Key 迁移失败（将保留原有存储）: {}", e);
                        }
                    }
                }
                legacy
            }
        };

        Ok(ApiConfig {
            api_key,
            api_url: get_setting(&connection, "ai_api_url")?
                .unwrap_or_else(|| "https://api.openai.com".to_string()),
            model_id: get_setting(&connection, "ai_model_id")?
                .unwrap_or_else(|| "gpt-3.5-turbo".to_string()),
            provider: get_setting(&connection, "ai_provider")?
                .unwrap_or_else(|| "custom".to_string()),
        })
    }

    pub fn set_api_config(&self, config: ApiConfig) -> Result<(), String> {
        let connection = self.connection.borrow();

        // 非空 Key：SQLite 作为可靠存储（必须成功），Keychain 作为安全增强（尽力而为）
        if !config.api_key.trim().is_empty() {
            let key = config.api_key.trim().to_string();
            // 先写 SQLite 确保可靠性
            set_setting(&connection, "ai_api_key", &key)?;
            // 同时尝试写入系统密钥库（失败只记录警告，不影响流程）
            if let Err(e) = write_keychain_key(&key) {
                tracing::warn!("写入系统密钥库失败（非致命，仍保存于 SQLite）: {}", e);
            }
        }
        // api_key 为空时保留已存密钥，不覆盖

        set_setting(
            &connection,
            "ai_api_url",
            default_if_blank(config.api_url.as_str(), "https://api.openai.com").as_str(),
        )?;
        set_setting(
            &connection,
            "ai_model_id",
            default_if_blank(config.model_id.as_str(), "gpt-3.5-turbo").as_str(),
        )?;
        set_setting(
            &connection,
            "ai_provider",
            default_if_blank(config.provider.as_str(), "custom").as_str(),
        )?;
        add_operation_log(&connection, "更改设置", "更新 AI API 配置")
    }

    pub fn save_draft(&self, data: serde_json::Value) -> Result<(), String> {
        if !data.is_object() {
            return Err("草稿数据无效".to_string());
        }

        let connection = self.connection.borrow();
        connection
            .execute(
                "
                INSERT OR REPLACE INTO drafts (id, data, saved_at)
                VALUES (1, ?1, datetime('now'))
                ",
                params![data.to_string()],
            )
            .map_err(|error| format!("保存草稿失败: {error}"))?;
        Ok(())
    }

    pub fn load_draft(&self) -> Result<Option<serde_json::Value>, String> {
        let connection = self.connection.borrow();
        let row = connection
            .query_row(
                "SELECT data, saved_at FROM drafts WHERE id = 1",
                [],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|error| format!("读取草稿失败: {error}"))?;

        let Some((data, saved_at)) = row else {
            return Ok(None);
        };

        let mut value = serde_json::from_str::<serde_json::Value>(&data)
            .map_err(|error| format!("解析草稿失败: {error}"))?;
        if let Some(object) = value.as_object_mut() {
            object.insert("savedAt".to_string(), serde_json::Value::String(saved_at));
        }
        Ok(Some(value))
    }

    pub fn clear_draft(&self) -> Result<(), String> {
        let connection = self.connection.borrow();
        connection
            .execute("DELETE FROM drafts WHERE id = 1", [])
            .map_err(|error| format!("清除草稿失败: {error}"))?;
        Ok(())
    }
}
