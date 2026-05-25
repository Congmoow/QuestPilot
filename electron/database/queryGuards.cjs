const QUESTION_TYPES = new Set(['single', 'multiple', 'boolean', 'fill', 'short'])

function normalizePositiveInteger(value, fieldName = 'ID') {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
    throw new Error(`${fieldName}必须是正整数`)
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName}必须是正整数`)
  }

  return parsed
}

function normalizeNonNegativeInteger(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return defaultValue

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return defaultValue
  return parsed
}

function normalizePagination(options = {}) {
  const rawPage = normalizeNonNegativeInteger(options.page, 1)
  const rawPageSize = normalizeNonNegativeInteger(options.pageSize, 20)
  const page = Math.max(1, rawPage)
  const pageSize = Math.max(1, Math.min(rawPageSize || 20, 1000))
  const offset = (page - 1) * pageSize

  return {
    page,
    pageSize,
    offset,
    limit: pageSize
  }
}

function normalizeLimit(value, defaultValue = 20, maxValue = 1000) {
  const parsed = normalizeNonNegativeInteger(value, defaultValue)
  return Math.max(1, Math.min(parsed || defaultValue, maxValue))
}

function normalizeOffset(value) {
  return normalizeNonNegativeInteger(value, 0)
}

function normalizeQuestionType(type) {
  if (type === undefined || type === null || type === '') return null

  const normalized = String(type).trim()
  if (!QUESTION_TYPES.has(normalized)) {
    throw new Error('题型无效')
  }

  return normalized
}

function normalizeSearchKeyword(keyword) {
  if (keyword === undefined || keyword === null) return ''
  return String(keyword).trim()
}

function normalizeIdList(ids, fieldName = 'ID') {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error(`请选择要处理的${fieldName}`)
  }

  return [...new Set(ids.map((id) => normalizePositiveInteger(id, fieldName)))]
}

function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(', ')
}

module.exports = {
  normalizeIdList,
  normalizeLimit,
  normalizeOffset,
  normalizePagination,
  normalizePositiveInteger,
  normalizeQuestionType,
  normalizeSearchKeyword,
  placeholders
}
