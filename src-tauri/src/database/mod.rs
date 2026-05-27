use std::cell::RefCell;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};

mod legacy;
mod migrations;
mod schema;
mod types;
mod validation;

pub mod repositories;

pub use legacy::{
    legacy_database_candidates, legacy_database_status, replace_target_with_legacy_candidate,
    LegacyDatabaseCandidate, LegacyDatabaseReplaceResult, LegacyDatabaseStatus,
};
pub use repositories::{
    ChatHistoryRepository, DraftRepository, PracticeRepository, PromptRepository,
    QuestionBankRepository, QuestionRepository, SettingsRepository, StatsRepository,
    WrongBookRepository,
};
pub use types::{
    ApiConfig, ChatHistory, ChatHistoryInput, CreatePromptInput, CreateQuestionBankInput,
    CreateQuestionInput, DashboardStats, DedupResult, DuplicateGroup, ImportError, ImportResult,
    OperationLog, PracticeRecord, PracticeRecordInput, PracticeStats, Prompt, Question,
    QuestionBank, TypeDistribution, WrongBookCount, WrongBookItem, WrongBookPracticeResult,
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

    /// 以只读（或单条非事务写）方式访问底层 Connection。
    ///
    /// Repository 层用此方法直接执行 SQL，无需再委托 DatabaseStore 的领域方法。
    /// 闭包内不得再调用任何会重新 borrow `self.connection` 的方法，以免 RefCell 重复借用 panic。
    pub(crate) fn with_connection<T, F>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, String>,
    {
        let conn = self.connection.borrow();
        f(&conn)
    }

    /// 在单个 rusqlite 事务内执行闭包，成功则 commit，任一失败则 rollback。
    ///
    /// Repository 层用此方法执行批量原子写入（如 wrong_book 批量练习结果更新）。
    /// 闭包内只能通过 `tx` 直接执行 SQL，不得再调用会重新 borrow `self.connection` 的方法。
    pub(crate) fn with_transaction<T, F>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&rusqlite::Transaction<'_>) -> Result<T, String>,
    {
        let mut conn = self.connection.borrow_mut();
        let tx = conn
            .transaction()
            .map_err(|e| format!("开启事务失败: {e}"))?;
        let result = f(&tx)?;
        tx.commit().map_err(|e| format!("提交事务失败: {e}"))?;
        Ok(result)
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
