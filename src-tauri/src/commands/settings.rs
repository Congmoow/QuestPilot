use std::path::Path;

use tauri::AppHandle;

use crate::database;
use crate::error::AppError;

use super::{ai_config_from_database, database_path, legacy_candidates, open_store};

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicApiConfig {
    pub api_key: String,
    pub api_key_preview: String,
    pub has_api_key: bool,
    pub api_url: String,
    pub model_id: String,
    pub provider: String,
}

pub fn public_api_config_from_database(config: database::ApiConfig) -> PublicApiConfig {
    let api_key = config.api_key.trim().to_string();
    PublicApiConfig {
        api_key: String::new(),
        api_key_preview: mask_api_key(api_key.as_str()),
        has_api_key: !api_key.is_empty(),
        api_url: config.api_url,
        model_id: config.model_id,
        provider: config.provider,
    }
}

pub fn mask_api_key(api_key: &str) -> String {
    let value = api_key.trim();
    if value.is_empty() {
        return String::new();
    }
    if value.chars().count() <= 8 {
        return "••••".to_string();
    }

    let prefix: String = value.chars().take(4).collect();
    let suffix: String = value
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("{prefix}••••{suffix}")
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn settings_get_theme(app: AppHandle) -> Result<String, AppError> {
    Ok(open_store(&app)?.get_theme()?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn settings_set_theme(app: AppHandle, theme: String) -> Result<(), AppError> {
    Ok(open_store(&app)?.set_theme(theme)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn settings_get_wrong_book_threshold(app: AppHandle) -> Result<i64, AppError> {
    Ok(open_store(&app)?.get_wrong_book_threshold()?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn settings_set_wrong_book_threshold(app: AppHandle, threshold: i64) -> Result<(), AppError> {
    Ok(open_store(&app)?.set_wrong_book_threshold(threshold)?)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn settings_get_api_config(app: AppHandle) -> Result<PublicApiConfig, AppError> {
    open_store(&app)?
        .get_api_config()
        .map(public_api_config_from_database)
        .map_err(AppError::from)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app, config), err)]
pub fn settings_set_api_config(
    app: AppHandle,
    config: database::ApiConfig,
) -> Result<serde_json::Value, AppError> {
    open_store(&app)?.set_api_config(config)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub async fn settings_test_api_connection(app: AppHandle) -> Result<serde_json::Value, AppError> {
    let config = open_store(&app)?.get_api_config()?;
    crate::ai::test_connection(&ai_config_from_database(config))
        .await
        .map_err(AppError::Ai)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn migration_get_legacy_status(
    app: AppHandle,
) -> Result<database::LegacyDatabaseStatus, AppError> {
    let target_path = database_path(&app)?;
    let candidates = legacy_candidates(&app)?;
    database::legacy_database_status(&target_path, &candidates).map_err(AppError::from)
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(app), err)]
pub fn migration_backup_and_replace_from_legacy(
    app: AppHandle,
    legacy_path: String,
    confirmation: String,
) -> Result<database::LegacyDatabaseReplaceResult, AppError> {
    let target_path = database_path(&app)?;
    let candidates = legacy_candidates(&app)?;
    database::replace_target_with_legacy_candidate(
        &target_path,
        Path::new(legacy_path.as_str()),
        &candidates,
        confirmation.as_str(),
    )
    .map_err(AppError::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_api_config_does_not_expose_full_api_key() {
        let raw_key = "token-test-1234567890abcdef".to_string();
        let public_config = public_api_config_from_database(database::ApiConfig {
            api_key: raw_key.clone(),
            api_url: "https://api.example.com".to_string(),
            model_id: "model-x".to_string(),
            provider: "openai".to_string(),
        });

        assert_eq!(public_config.api_key, "");
        assert!(public_config.has_api_key);
        assert_eq!(public_config.api_url, "https://api.example.com");
        assert_eq!(public_config.model_id, "model-x");
        assert_eq!(public_config.provider, "openai");
        assert_ne!(public_config.api_key_preview, raw_key);
        assert!(!public_config.api_key_preview.contains(raw_key.as_str()));
        assert!(public_config.api_key_preview.starts_with("toke"));
        assert!(public_config.api_key_preview.ends_with("cdef"));
    }
}
