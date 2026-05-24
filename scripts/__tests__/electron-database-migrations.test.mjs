import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'

import initSqlJs from 'sql.js'

const require = createRequire(import.meta.url)
const {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  ensureSchemaMigrations,
  getAppliedSchemaMigrations,
  runPendingMigrations
} = require('../../electron/database/migrations.cjs')

let SQL

async function createDatabase() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (fileName) => {
        if (fileName === 'sql-wasm.wasm') {
          return path.resolve('node_modules/sql.js/dist/sql-wasm.wasm')
        }

        return fileName
      }
    })
  }

  return new SQL.Database()
}

test('Electron 数据库迁移记录当前版本且重复执行保持幂等', async () => {
  const db = await createDatabase()

  ensureSchemaMigrations(db)
  ensureSchemaMigrations(db)

  assert.deepEqual(getAppliedSchemaMigrations(db), [
    {
      version: CURRENT_SCHEMA_VERSION,
      name: '001_initial_schema'
    }
  ])

  db.close()
})

test('Electron 迁移列表显式声明当前基线版本', () => {
  assert.deepEqual(
    MIGRATIONS.map(({ version, name }) => ({ version, name })),
    [
      {
        version: CURRENT_SCHEMA_VERSION,
        name: '001_initial_schema'
      }
    ]
  )
})

test('Electron 只执行未记录的迁移并在成功后记录版本', async () => {
  const db = await createDatabase()
  let runs = 0

  const testMigration = {
    version: 2,
    name: '002_test_probe',
    up(database) {
      runs += 1
      database.run('CREATE TABLE migration_probe (id INTEGER PRIMARY KEY)')
    }
  }

  ensureSchemaMigrations(db)
  runPendingMigrations(db, [testMigration])
  runPendingMigrations(db, [testMigration])

  assert.equal(runs, 1)
  assert.deepEqual(getAppliedSchemaMigrations(db), [
    {
      version: 1,
      name: '001_initial_schema'
    },
    {
      version: 2,
      name: '002_test_probe'
    }
  ])
  assert.equal(db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'").length, 1)

  db.close()
})
