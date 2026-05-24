import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  normalizeIdList,
  normalizePagination,
  normalizePositiveInteger,
  normalizeQuestionType
} = require('../../electron/database/queryGuards.cjs')

test('normalizePositiveInteger 拒绝非正整数和注入字符串', () => {
  assert.equal(normalizePositiveInteger('42', '题库 ID'), 42)

  assert.throws(
    () => normalizePositiveInteger('1 OR 1=1', '题库 ID'),
    /题库 ID必须是正整数/
  )
  assert.throws(
    () => normalizePositiveInteger(0, '题库 ID'),
    /题库 ID必须是正整数/
  )
})

test('normalizePagination 归一化分页并限制最大 pageSize', () => {
  assert.deepEqual(normalizePagination({ page: '2', pageSize: '2000' }), {
    page: 2,
    pageSize: 1000,
    offset: 1000,
    limit: 1000
  })

  assert.deepEqual(normalizePagination({ page: -1, pageSize: 'abc' }), {
    page: 1,
    pageSize: 20,
    offset: 0,
    limit: 20
  })
})

test('normalizeQuestionType 只允许已知题型', () => {
  assert.equal(normalizeQuestionType('single'), 'single')
  assert.equal(normalizeQuestionType(''), null)
  assert.equal(normalizeQuestionType(null), null)

  assert.throws(
    () => normalizeQuestionType("single' OR '1'='1"),
    /题型无效/
  )
})

test('normalizeIdList 拒绝混入非数字的批量 ID', () => {
  assert.deepEqual(normalizeIdList([1, '2', 2], '题目 ID'), [1, 2])

  assert.throws(
    () => normalizeIdList([1, '2); DROP TABLE questions; --'], '题目 ID'),
    /题目 ID必须是正整数/
  )
  assert.throws(
    () => normalizeIdList([], '题目 ID'),
    /请选择要处理的题目 ID/
  )
})
