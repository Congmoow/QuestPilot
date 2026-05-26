use std::cell::RefCell;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};

mod legacy;
mod migrations;
mod queries;
mod schema;
mod types;
mod validation;

mod ai;
mod practice;
mod question;
mod question_bank;
mod settings;
mod stats;
mod wrong_book;

pub use legacy::{
    legacy_database_candidates, legacy_database_status, replace_target_with_legacy_candidate,
    LegacyDatabaseCandidate, LegacyDatabaseReplaceResult, LegacyDatabaseStatus,
};
pub use types::{
    ApiConfig, ChatHistory, ChatHistoryInput, CreatePromptInput, CreateQuestionBankInput,
    CreateQuestionInput, DashboardStats, ImportError, ImportResult, OperationLog, PracticeRecord,
    PracticeRecordInput, PracticeStats, Prompt, Question, QuestionBank, TypeDistribution,
    WrongBookCount, WrongBookItem, WrongBookPracticeResult,
};

use legacy::migrate_legacy_database;
use schema::initialize_database_schema;

pub const DATABASE_FILE_NAME: &str = "questpilot.db";

pub struct DatabaseStore {
    connection: RefCell<Connection>,
}

impl DatabaseStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        open_database_at(path.as_ref())
    }

    pub fn open_with_legacy_candidates(
        target_path: impl AsRef<Path>,
        legacy_candidates: &[PathBuf],
    ) -> Result<Self, String> {
        let target_path = target_path.as_ref();
        migrate_legacy_database(target_path, legacy_candidates)?;
        open_database_at(target_path)
    }

    pub fn table_count(&self, table_names: &[&str]) -> Result<usize, String> {
        let connection = self.connection.borrow();
        let mut count = 0;

        for table_name in table_names {
            let exists = connection
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
                    params![table_name],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|error| format!("检查数据表失败: {error}"))?;
            if exists == 1 {
                count += 1;
            }
        }

        Ok(count)
    }
}

fn open_database_at(path: &Path) -> Result<DatabaseStore, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建数据库目录失败: {error}"))?;
    }

    let connection = Connection::open(path).map_err(|error| format!("打开数据库失败: {error}"))?;
    initialize_database_schema(&connection)?;
    Ok(DatabaseStore {
        connection: RefCell::new(connection),
    })
}
