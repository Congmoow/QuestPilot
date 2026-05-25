use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OpenFlags};

const LEGACY_DATABASE_FILE_NAMES: [&str; 2] = ["questpilot.db", "question-bank.db"];
const LEGACY_USER_DATA_DIRS: [&str; 4] = [
    "QuestPilot",
    "questpilot",
    "question-bank-assistant",
    "题库助手",
];

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
