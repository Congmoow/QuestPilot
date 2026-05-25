import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const databaseSource = fs.readFileSync(
  path.resolve('electron/database/index.cjs'),
  'utf8'
)

const forbiddenPatterns = [
  {
    label: '题库 ID 查询不能拼接 id',
    pattern: /WHERE\s+qb\.id\s*=\s*\$\{id\}/
  },
  {
    label: '题目列表不能拼接 bankId',
    pattern: /WHERE\s+bank_id\s*=\s*\$\{bankId\}/
  },
  {
    label: '批量删除不能拼接 idList',
    pattern: /IN\s*\(\$\{idList\}\)/
  },
  {
    label: '搜索关键字不能拼接 LIKE',
    pattern: /LIKE\s+'%\$\{escapedKeyword\}%'/ 
  },
  {
    label: '题型不能直接拼接',
    pattern: /type\s*=\s*'\$\{type\}'/
  },
  {
    label: '分页 limit offset 不能直接拼接',
    pattern: /LIMIT\s+\$\{limit\}\s+OFFSET\s+\$\{offset\}/
  }
]

test('Electron 题库题目核心 SQL 不再拼接 renderer 输入', () => {
  const hits = forbiddenPatterns
    .filter(({ pattern }) => pattern.test(databaseSource))
    .map(({ label }) => label)

  assert.deepEqual(hits, [])
})
