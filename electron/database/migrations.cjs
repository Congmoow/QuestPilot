const CURRENT_SCHEMA_VERSION = 1
const CURRENT_SCHEMA_MIGRATION_NAME = '001_initial_schema'

const MIGRATIONS = [
  {
    version: CURRENT_SCHEMA_VERSION,
    name: CURRENT_SCHEMA_MIGRATION_NAME,
    up() {
      // 当前版本是对既有初始化表结构的基线记录，业务表仍由 index.cjs 初始化。
    }
  }
]

function ensureSchemaMigrations(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  runPendingMigrations(database, MIGRATIONS)
}

function recordMigration(database, migration) {
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO schema_migrations (version, name)
    VALUES (?, ?)
  `)
  stmt.run([migration.version, migration.name])
  stmt.free()
}

function runPendingMigrations(database, migrations = MIGRATIONS) {
  const appliedVersions = new Set(getAppliedSchemaMigrations(database).map(({ version }) => version))
  const orderedMigrations = [...migrations].sort((a, b) => a.version - b.version)

  for (const migration of orderedMigrations) {
    if (appliedVersions.has(migration.version)) continue

    database.run('BEGIN TRANSACTION')
    try {
      migration.up(database)
      recordMigration(database, migration)
      database.run('COMMIT')
      appliedVersions.add(migration.version)
    } catch (error) {
      try {
        database.run('ROLLBACK')
      } catch {
        // 回滚失败时保留原始迁移错误，避免掩盖真正原因。
      }
      throw error
    }
  }
}

function getAppliedSchemaMigrations(database) {
  const result = database.exec(`
    SELECT version, name
    FROM schema_migrations
    ORDER BY version
  `)

  if (!result.length || !result[0].values.length) return []

  return result[0].values.map(([version, name]) => ({
    version: Number(version),
    name: String(name)
  }))
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  CURRENT_SCHEMA_MIGRATION_NAME,
  MIGRATIONS,
  ensureSchemaMigrations,
  getAppliedSchemaMigrations,
  runPendingMigrations
}
