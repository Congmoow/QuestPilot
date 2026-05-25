use rusqlite::{params, OptionalExtension};

use super::{
    queries::{add_operation_log, get_setting, set_setting},
    types::ApiConfig,
    validation::default_if_blank,
    DatabaseStore,
};

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
        Ok(ApiConfig {
            api_key: get_setting(&connection, "ai_api_key")?.unwrap_or_default(),
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
        let next_api_key = if config.api_key.trim().is_empty() {
            get_setting(&connection, "ai_api_key")?.unwrap_or_default()
        } else {
            config.api_key.trim().to_string()
        };
        set_setting(&connection, "ai_api_key", next_api_key.as_str())?;
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
