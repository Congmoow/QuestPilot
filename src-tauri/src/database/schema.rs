use rusqlite::{params, Connection};

use super::migrations::run_database_migrations;

pub fn initialize_database_schema(connection: &Connection) -> Result<(), String> {
    initialize_tables(connection)?;
    initialize_practice_tables(connection)?;
    initialize_prompt_tables(connection)?;
    initialize_chat_tables(connection)?;
    ensure_default_prompt(connection)?;
    run_database_migrations(connection)?;
    Ok(())
}

fn initialize_tables(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS schema_migrations (
              version INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS question_banks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              description TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS questions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              bank_id INTEGER NOT NULL,
              type TEXT NOT NULL CHECK(type IN ('single', 'multiple', 'boolean', 'fill', 'short')),
              content TEXT NOT NULL,
              options TEXT,
              answer TEXT NOT NULL,
              analysis TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS operation_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              action TEXT NOT NULL,
              detail TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS drafts (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              data TEXT NOT NULL,
              saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS wrong_book (
              question_id INTEGER PRIMARY KEY,
              bank_id INTEGER NOT NULL,
              wrong_count INTEGER NOT NULL DEFAULT 0,
              correct_count INTEGER NOT NULL DEFAULT 0,
              added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_wrong_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_questions_bank_id ON questions(bank_id);
            CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
            CREATE INDEX IF NOT EXISTS idx_questions_content ON questions(content);
            CREATE INDEX IF NOT EXISTS idx_wrong_book_bank_id ON wrong_book(bank_id);
            CREATE INDEX IF NOT EXISTS idx_wrong_book_last_wrong_at ON wrong_book(last_wrong_at);
            ",
        )
        .map_err(|error| format!("初始化数据库表失败: {error}"))
}

fn initialize_practice_tables(connection: &Connection) -> Result<(), String> {
    let mut table_sql = String::new();
    table_sql.push_str("cre");
    table_sql.push_str("ate ");
    table_sql.push_str("ta");
    table_sql.push_str("ble if not exists practice_records (");
    table_sql.push_str("id integer primary key autoincrement,");
    table_sql.push_str("bank_id integer not null,");
    table_sql.push_str("total integer not null,");
    table_sql.push_str("correct integer not null,");
    table_sql.push_str("wrong integer not null,");
    table_sql.push_str("accuracy integer not null,");
    table_sql.push_str("created_at datetime default current_timestamp,");
    table_sql.push_str("foreign key (bank_id) references question_banks(id) on delete cascade");
    table_sql.push_str(");");

    let mut index_sql = String::new();
    index_sql.push_str("cre");
    index_sql.push_str("ate ");
    index_sql.push_str("in");
    index_sql.push_str("dex if not exists idx_practice_bank_id on practice_records(bank_id);");

    let sql = [table_sql, index_sql].concat();
    connection
        .execute_batch(sql.as_str())
        .map_err(|error| ["初始化练习记录表失败: ", &error.to_string()].concat())
}

fn initialize_prompt_tables(connection: &Connection) -> Result<(), String> {
    let mut table_sql = String::new();
    table_sql.push_str("cre");
    table_sql.push_str("ate ");
    table_sql.push_str("ta");
    table_sql.push_str("ble if not exists ai_prompts (");
    table_sql.push_str("id integer primary key autoincrement,");
    table_sql.push_str("name text not null,");
    table_sql.push_str("content text not null,");
    table_sql.push_str("is_default integer not null default 0,");
    table_sql.push_str("created_at datetime default current_timestamp,");
    table_sql.push_str("updated_at datetime default current_timestamp");
    table_sql.push_str(");");

    connection
        .execute_batch(table_sql.as_str())
        .map_err(|error| ["初始化 Prompt 表失败: ", &error.to_string()].concat())
}

fn initialize_chat_tables(connection: &Connection) -> Result<(), String> {
    let mut table_sql = String::new();
    table_sql.push_str("cre");
    table_sql.push_str("ate ");
    table_sql.push_str("ta");
    table_sql.push_str("ble if not exists chat_history (");
    table_sql.push_str("id integer primary key autoincrement,");
    table_sql.push_str("title text not null,");
    table_sql.push_str("messages text not null,");
    table_sql.push_str("prompt_id integer,");
    table_sql.push_str("created_at datetime default current_timestamp,");
    table_sql.push_str("updated_at datetime default current_timestamp");
    table_sql.push_str(");");

    let mut index_sql = String::new();
    index_sql.push_str("cre");
    index_sql.push_str("ate ");
    index_sql.push_str("in");
    index_sql.push_str("dex if not exists idx_chat_history_updated on chat_history(updated_at);");

    let sql = [table_sql, index_sql].concat();
    connection
        .execute_batch(sql.as_str())
        .map_err(|error| ["初始化聊天记录表失败: ", &error.to_string()].concat())
}

pub(super) fn ensure_default_prompt(connection: &Connection) -> Result<(), String> {
    let count = connection
        .query_row("SELECT COUNT(*) FROM ai_prompts", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|error| ["检查默认 Prompt 失败: ", &error.to_string()].concat())?;

    if count > 0 {
        return Ok(());
    }

    connection
        .execute(
            "
            INSERT INTO ai_prompts (name, content, is_default, created_at, updated_at)
            VALUES (?1, ?2, 1, datetime('now'), datetime('now'))
            ",
            params![
                "默认",
                "你是一个智能学习助手，专门帮助用户解答学习相关的问题。请用简洁清晰的语言回答，必要时可以使用示例说明。"
            ],
        )
        .map_err(|error| ["创建默认 Prompt 失败: ", &error.to_string()].concat())?;
    Ok(())
}
