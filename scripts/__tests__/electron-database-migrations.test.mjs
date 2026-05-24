import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'

import initSqlJs from 'sql.js'

const require = createRequire(import.meta.url)
const {
  CURRENT_SCHEMA_VERSION,
  ensureSchemaMigrations,
  getAppliedSchemaMigrations
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
