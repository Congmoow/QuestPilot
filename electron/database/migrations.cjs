const CURRENT_SCHEMA_VERSION = 1
const CURRENT_SCHEMA_MIGRATION_NAME = '001_initial_schema'

function ensureSchemaMigrations(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const stmt = database.prepare(`
    INSERT OR IGNORE INTO schema_migrations (version, name)
    VALUES (?, ?)
  `)
  stmt.run([CURRENT_SCHEMA_VERSION, CURRENT_SCHEMA_MIGRATION_NAME])
  stmt.free()
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
  ensureSchemaMigrations,
  getAppliedSchemaMigrations
}
