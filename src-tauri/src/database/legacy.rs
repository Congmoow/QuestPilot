use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OpenFlags};
use serde::Serialize;

const LEGACY_DATABASE_FILE_NAMES: [&str; 2] = ["questpilot.db", "question-bank.db"];
const LEGACY_USER_DATA_DIRS: [&str; 4] = [
    "QuestPilot",
    "questpilot",
    "question-bank-assistant",
    "题库助手",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyDatabaseCandidate {
    pub path: String,
    pub exists: bool,
    pub has_user_data: bool,
    pub inspect_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyDatabaseStatus {
    pub target_path: String,
    pub target_exists: bool,
    pub target_has_user_data: bool,
    pub candidates: Vec<LegacyDatabaseCandidate>,
    pub recommended_action: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyDatabaseReplaceResult {
    pub success: bool,
    pub backup_path: Option<PathBuf>,
    pub source_path: PathBuf,
    pub target_path: PathBuf,
}

pub fn legacy_database_candidates(target_path: &Path) -> Vec<PathBuf> {
    let Some(target_dir) = target_path.parent() else {
        return Vec::new();
    };

    let mut candidates = Vec::new();
    for file_name in LEGACY_DATABASE_FILE_NAMES {
        candidates.push(target_dir.join(file_name));
    }

    if let Some(app_data_dir) = target_dir.parent() {
        for dir_name in LEGACY_USER_DATA_DIRS {
            for file_name in LEGACY_DATABASE_FILE_NAMES {
                candidates.push(app_data_dir.join(dir_name).join(file_name));
            }
        }
    }

    candidates
        .into_iter()
        .filter(|candidate| candidate != target_path)
        .fold(Vec::new(), |mut unique, candidate| {
            if !unique.contains(&candidate) {
                unique.push(candidate);
            }
            unique
        })
}

pub fn legacy_database_status(
    target_path: &Path,
    legacy_candidates: &[PathBuf],
) -> Result<LegacyDatabaseStatus, String> {
    let target_exists = target_path.exists();
    let target_has_user_data = target_exists && database_has_user_data(target_path)?;
    let candidates = legacy_candidates
        .iter()
        .map(|candidate| {
            let exists = candidate.exists();
            let inspection = if exists {
                database_has_user_data(candidate)
            } else {
                Ok(false)
            };
            let (has_user_data, inspect_error) = match inspection {
                Ok(value) => (value, None),
                Err(error) => (false, Some(error)),
            };
            LegacyDatabaseCandidate {
                path: candidate.to_string_lossy().to_string(),
                exists,
                has_user_data,
                inspect_error,
            }
        })
        .collect::<Vec<_>>();

    let has_legacy_user_data = candidates.iter().any(|candidate| candidate.has_user_data);
    let recommended_action = if !has_legacy_user_data {
        "none"
    } else if !target_exists || !target_has_user_data {
        "auto_migrate"
    } else {
        "requires_explicit_reset"
    }
    .to_string();

    Ok(LegacyDatabaseStatus {
        target_path: target_path.to_string_lossy().to_string(),
        target_exists,
        target_has_user_data,
        candidates,
        recommended_action,
    })
}

pub fn migrate_legacy_database(
    target_path: &Path,
    legacy_candidates: &[PathBuf],
) -> Result<(), String> {
    if target_path.exists() && database_has_user_data(target_path)? {
        return Ok(());
    }

    let Some(legacy_path) = legacy_candidates
        .iter()
        .find(|candidate| candidate.exists() && database_has_user_data(candidate).unwrap_or(false))
    else {
        return Ok(());
    };

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建数据库目录失败: {error}"))?;
    }

    fs::copy(legacy_path, target_path).map_err(|error| format!("迁移旧数据库失败: {error}"))?;
    Ok(())
}

pub fn replace_target_with_legacy_candidate(
    target_path: &Path,
    legacy_path: &Path,
    legacy_candidates: &[PathBuf],
    confirmation: &str,
) -> Result<LegacyDatabaseReplaceResult, String> {
    if confirmation != "BACKUP_AND_REPLACE" {
        return Err("请确认备份并替换现有 Tauri 数据库".to_string());
    }

    if !is_allowed_legacy_candidate(legacy_path, legacy_candidates)? {
        return Err("旧数据库路径不在候选列表中".to_string());
    }

    if !legacy_path.exists() || !database_has_user_data(legacy_path)? {
        return Err("旧数据库不存在或没有可迁移的用户数据".to_string());
    }

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建数据库目录失败: {error}"))?;
    }

    let temp_path = temporary_replace_path(target_path)?;
    fs::copy(legacy_path, &temp_path).map_err(|error| format!("准备替换数据库失败: {error}"))?;

    let backup_path = if target_path.exists() {
        let backup_path = backup_path_for(target_path)?;
        fs::rename(target_path, &backup_path)
            .map_err(|error| format!("备份现有 Tauri 数据库失败: {error}"))?;
        match fs::rename(&temp_path, target_path) {
            Ok(_) => Some(backup_path),
            Err(error) => {
                let restore_result = fs::rename(&backup_path, target_path);
                let _ = fs::remove_file(&temp_path);
                let restore_message = restore_result
                    .err()
                    .map(|restore_error| format!("；恢复原库失败: {restore_error}"))
                    .unwrap_or_default();
                return Err(format!("替换 Tauri 数据库失败: {error}{restore_message}"));
            }
        }
    } else {
        fs::rename(&temp_path, target_path).map_err(|error| {
            let _ = fs::remove_file(&temp_path);
            format!("替换 Tauri 数据库失败: {error}")
        })?;
        None
    };

    Ok(LegacyDatabaseReplaceResult {
        success: true,
        backup_path,
        source_path: legacy_path.to_path_buf(),
        target_path: target_path.to_path_buf(),
    })
}

fn backup_path_for(target_path: &Path) -> Result<PathBuf, String> {
    let file_name = target_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "目标数据库路径无效".to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("生成备份时间戳失败: {error}"))?
        .as_millis();

    for index in 0..1000 {
        let suffix = if index == 0 {
            String::new()
        } else {
            format!("-{index}")
        };
        let candidate =
            target_path.with_file_name(format!("{file_name}.backup-{timestamp}{suffix}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err("无法生成唯一的数据库备份路径".to_string())
}

fn temporary_replace_path(target_path: &Path) -> Result<PathBuf, String> {
    let file_name = target_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "目标数据库路径无效".to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("生成替换临时文件时间戳失败: {error}"))?
        .as_millis();

    for index in 0..1000 {
        let candidate =
            target_path.with_file_name(format!("{file_name}.replace-{timestamp}-{index}.tmp"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err("无法生成唯一的数据库替换临时路径".to_string())
}

fn is_allowed_legacy_candidate(
    legacy_path: &Path,
    legacy_candidates: &[PathBuf],
) -> Result<bool, String> {
    let selected = legacy_path
        .canonicalize()
        .map_err(|error| format!("解析旧数据库路径失败: {error}"))?;

    for candidate in legacy_candidates {
        if !candidate.exists() {
            continue;
        }
        let canonical = candidate
            .canonicalize()
            .map_err(|error| format!("解析候选旧数据库路径失败: {error}"))?;
        if canonical == selected {
            return Ok(true);
        }
    }

    Ok(false)
}

fn database_has_user_data(path: &Path) -> Result<bool, String> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("检查数据库内容失败: {error}"))?;

    let checks = [
        (
            "question_banks",
            "SELECT EXISTS(SELECT 1 FROM question_banks LIMIT 1)",
        ),
        (
            "questions",
            "SELECT EXISTS(SELECT 1 FROM questions LIMIT 1)",
        ),
        (
            "practice_records",
            "SELECT EXISTS(SELECT 1 FROM practice_records LIMIT 1)",
        ),
        (
            "wrong_book",
            "SELECT EXISTS(SELECT 1 FROM wrong_book LIMIT 1)",
        ),
        ("settings", "SELECT EXISTS(SELECT 1 FROM settings LIMIT 1)"),
        ("drafts", "SELECT EXISTS(SELECT 1 FROM drafts LIMIT 1)"),
        (
            "chat_history",
            "SELECT EXISTS(SELECT 1 FROM chat_history LIMIT 1)",
        ),
        (
            "operation_logs",
            "SELECT EXISTS(SELECT 1 FROM operation_logs LIMIT 1)",
        ),
        (
            "ai_prompts",
            "SELECT EXISTS(SELECT 1 FROM ai_prompts WHERE is_default = 0 LIMIT 1)",
        ),
    ];

    for (table_name, row_check_sql) in checks {
        if table_exists(&connection, table_name)? && query_exists(&connection, row_check_sql)? {
            return Ok(true);
        }
    }

    Ok(false)
}

fn table_exists(connection: &Connection, table_name: &str) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
            params![table_name],
            |row| row.get::<_, i64>(0),
        )
        .map(|exists| exists == 1)
        .map_err(|error| format!("检查数据表失败: {error}"))
}

fn query_exists(connection: &Connection, sql: &str) -> Result<bool, String> {
    connection
        .query_row(sql, [], |row| row.get::<_, i64>(0))
        .map(|exists| exists == 1)
        .map_err(|error| format!("检查数据表内容失败: {error}"))
}
