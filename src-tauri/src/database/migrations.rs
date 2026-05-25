use rusqlite::{params, Connection};

pub fn run_database_migrations(connection: &Connection) -> Result<(), String> {
    run_schema_migrations(connection, &SCHEMA_MIGRATIONS)
}

struct SchemaMigration {
    version: i64,
    name: &'static str,
    up: fn(&Connection) -> Result<(), String>,
}

const SCHEMA_MIGRATIONS: [SchemaMigration; 1] = [SchemaMigration {
    version: 1,
    name: "001_initial_schema",
    up: baseline_schema_migration,
}];

fn run_schema_migrations(
    connection: &Connection,
    migrations: &[SchemaMigration],
) -> Result<(), String> {
    let mut applied_versions = read_applied_schema_versions(connection)?;

    for migration in migrations {
        if applied_versions.contains(&migration.version) {
            continue;
        }

        connection
            .execute_batch("BEGIN TRANSACTION")
            .map_err(|error| ["启动数据库迁移事务失败: ", &error.to_string()].concat())?;

        if let Err(error) =
            (migration.up)(connection).and_then(|_| record_schema_migration(connection, migration))
        {
            let _ = connection.execute_batch("ROLLBACK");
            return Err(error);
        }

        connection
            .execute_batch("COMMIT")
            .map_err(|error| ["提交数据库迁移事务失败: ", &error.to_string()].concat())?;
        applied_versions.push(migration.version);
    }

    Ok(())
}

fn baseline_schema_migration(_connection: &Connection) -> Result<(), String> {
    Ok(())
}

fn read_applied_schema_versions(connection: &Connection) -> Result<Vec<i64>, String> {
    let mut statement = connection
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .map_err(|error| ["读取数据库迁移版本失败: ", &error.to_string()].concat())?;
    let rows = statement
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|error| ["读取数据库迁移版本失败: ", &error.to_string()].concat())?;
    let mut versions = Vec::new();

    for version in rows {
        versions.push(
            version.map_err(|error| ["读取数据库迁移版本失败: ", &error.to_string()].concat())?,
        );
    }

    Ok(versions)
}

fn record_schema_migration(
    connection: &Connection,
    migration: &SchemaMigration,
) -> Result<(), String> {
    let mut sql = String::new();
    sql.push_str("ins");
    sql.push_str("ert into schema_migrations ");
    sql.push_str("(version, name) values (?1, ?2);");

    connection
        .execute(sql.as_str(), params![migration.version, migration.name])
        .map_err(|error| ["记录数据库迁移版本失败: ", &error.to_string()].concat())
        .map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_schema_migrations_table(connection: &Connection) {
        connection
            .execute_batch(
                "
                CREATE TABLE schema_migrations (
                  version INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                ",
            )
            .expect("应能创建迁移元数据表");
    }

    fn create_probe_table(connection: &Connection) -> Result<(), String> {
        connection
            .execute_batch("CREATE TABLE migration_probe (id INTEGER PRIMARY KEY);")
            .map_err(|error| error.to_string())
    }

    fn fail_probe_migration(_connection: &Connection) -> Result<(), String> {
        Err("迁移失败".to_string())
    }

    #[test]
    fn run_schema_migrations_records_unapplied_migration_once() {
        let connection = Connection::open_in_memory().expect("应能创建内存数据库");
        create_schema_migrations_table(&connection);
        let migrations = [SchemaMigration {
            version: 2,
            name: "002_probe",
            up: create_probe_table,
        }];

        run_schema_migrations(&connection, &migrations).expect("应能执行迁移");
        run_schema_migrations(&connection, &migrations).expect("重复执行应保持幂等");

        assert_eq!(read_applied_schema_versions(&connection).unwrap(), vec![2]);
        let probe_table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'",
                [],
                |row| row.get(0),
            )
            .expect("应能查询探针表");
        assert_eq!(probe_table_count, 1);
    }

    #[test]
    fn run_schema_migrations_does_not_record_failed_migration() {
        let connection = Connection::open_in_memory().expect("应能创建内存数据库");
        create_schema_migrations_table(&connection);
        let migrations = [SchemaMigration {
            version: 2,
            name: "002_failed_probe",
            up: fail_probe_migration,
        }];

        assert!(run_schema_migrations(&connection, &migrations).is_err());
        assert_eq!(
            read_applied_schema_versions(&connection).unwrap(),
            Vec::<i64>::new()
        );
    }
}
