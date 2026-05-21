const { countFillBlanks } = require('./fillBlank.cjs')

function normalizeAiParseResult(result) {
  const questions = Array.isArray(result?.questions) ? result.questions : []
  return {
    ...result,
    questions: questions.map(normalizeAiQuestion).filter(Boolean)
  }
}

function normalizeAiQuestion(q) {
  if (!q || typeof q !== 'object') return null

  const type = typeof q.type === 'string' ? q.type.trim() : q.type
  const normalizedType = normalizeAiType(type)

  const normalized = {
    ...q,
    type: normalizedType
  }

  if (normalizedType === 'single' || normalizedType === 'multiple') {
    normalized.options = normalizeAiOptions(q.options)
  }

  normalized.answer = normalizeAiAnswer(normalizedType, q.answer, normalized.options)

  return normalized
}

function normalizeAiType(type) {
  const typeMap = {
    '单选题': 'single',
    '单选': 'single',
    single: 'single',
    '多选题': 'multiple',
    '多选': 'multiple',
    multiple: 'multiple',
    '判断题': 'boolean',
    '判断': 'boolean',
    boolean: 'boolean',
    '填空题': 'fill',
    '填空': 'fill',
    fill: 'fill',
    '简答题': 'short',
    '简答': 'short',
    short: 'short'
  }
  return typeMap[type] || type
}

function normalizeAiOptions(options) {
  if (!Array.isArray(options)) return options
  return options
    .map((opt, i) => normalizeAiOption(opt, i))
    .filter(Boolean)
}

function normalizeAiOption(opt, index) {
  const fallbackId = String.fromCharCode(65 + index)

  if (typeof opt === 'string' || typeof opt === 'number') {
    const raw = String(opt).trim()
    if (!raw) return null

    const match = raw.match(/^([A-Za-z])\s*[.、．:：)]\s*(.+)$/)
    if (match) {
      return {
        id: match[1].toUpperCase(),
        text: match[2].trim()
      }
    }

    return { id: fallbackId, text: raw }
  }

  if (!opt || typeof opt !== 'object') return null

  const rawId = opt.id ?? fallbackId
  const id = extractOptionLetter(rawId) || fallbackId
  const rawText = opt.text ?? opt.content ?? opt.label ?? ''
  const text = String(rawText).trim()

  return { ...opt, id, text }
}

function normalizeAiAnswer(type, answer, options = []) {
  if (type === 'multiple') {
    return normalizeMultipleAnswer(answer, options)
  }
  if (type === 'single') {
    return normalizeSingleAnswer(answer, options)
  }
  if (type === 'boolean') {
    return normalizeBooleanAnswer(answer)
  }
  if (type === 'fill') {
    return normalizeFillAnswer(answer)
  }
  return answer
}

function normalizeSingleAnswer(answer, options = []) {
  if (answer == null) return answer

  const s = String(answer).trim()
  if (!s) return s

  const optionIds = getOptionIds(options)
  const letter = extractOptionLetter(s, optionIds)
  return letter || s.toUpperCase()
}

function normalizeMultipleAnswer(answer, options = []) {
  if (answer == null) return answer

  const optionIds = getOptionIds(options)
  const rawParts = Array.isArray(answer)
    ? answer.map(a => String(a ?? ''))
    : splitAnswerParts(String(answer))

  const letters = []
  for (const part of rawParts) {
    const value = String(part ?? '').trim()
    if (!value) continue

    const compact = value.toUpperCase()
    if (/^[A-Z]+$/.test(compact) && compact.length > 1) {
      letters.push(...compact.split('').filter(id => optionIds.length === 0 || optionIds.includes(id)))
      continue
    }

    const letter = extractOptionLetter(value, optionIds)
    if (letter) letters.push(letter)
  }

  const seen = new Set()
  return letters
    .filter(x => {
      if (seen.has(x)) return false
      seen.add(x)
      return true
    })
    .join('|')
}

function normalizeBooleanAnswer(answer) {
  if (answer == null) return answer
  if (answer === true) return '正确'
  if (answer === false) return '错误'

  const s = String(answer).trim()
  const lower = s.toLowerCase()
  const trueValues = new Set(['正确', '对', '是', '√', 'true', 't', 'yes', 'y', '1'])
  const falseValues = new Set(['错误', '错', '否', '×', 'false', 'f', 'no', 'n', '0'])

  if (trueValues.has(s) || trueValues.has(lower)) return '正确'
  if (falseValues.has(s) || falseValues.has(lower)) return '错误'

  return s
}

function normalizeFillAnswer(answer) {
  if (Array.isArray(answer)) {
    return answer.map(a => String(a ?? '').trim()).join('|')
  }
  return answer
}

function splitAnswerParts(value) {
  return value
    .trim()
    .replace(/[，,、;；\s]+/g, '|')
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
}

function getOptionIds(options) {
  if (!Array.isArray(options)) return []
  return options
    .map(opt => opt?.id)
    .filter(id => id != null)
    .map(id => String(id).trim().toUpperCase())
    .filter(Boolean)
}

function extractOptionLetter(value, allowedIds = []) {
  if (value == null) return ''

  const s = String(value).trim().toUpperCase()
  if (!s) return ''

  const allowed = Array.isArray(allowedIds) ? allowedIds : []
  if (/^[A-Z]$/.test(s) && (allowed.length === 0 || allowed.includes(s))) {
    return s
  }

  const leading = s.match(/^([A-Z])(?:\s*[.、．:：)]|\s|$)/)
  if (leading && (allowed.length === 0 || allowed.includes(leading[1]))) {
    return leading[1]
  }

  for (const id of allowed) {
    const pattern = new RegExp(`(^|[^A-Z])${id}([^A-Z]|$)`)
    if (pattern.test(s)) return id
  }

  const loose = s.match(/[A-Z]/)
  if (loose && allowed.length === 0) return loose[0]

  return ''
}

module.exports = {
  countFillBlanks,
  normalizeAiParseResult,
  normalizeAiQuestion,
  normalizeAiType,
  normalizeAiOptions,
  normalizeAiOption,
  normalizeAiAnswer,
  normalizeSingleAnswer,
  normalizeMultipleAnswer,
  normalizeBooleanAnswer,
  normalizeFillAnswer,
  extractOptionLetter
}
