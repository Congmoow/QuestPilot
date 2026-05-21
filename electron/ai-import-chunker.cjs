const DEFAULT_MAX_CHARS_PER_CHUNK = 3000

const TOP_HEADING_RE = /^#{1,2}\s+/
const QUESTION_LINE_RE = /^\s*(?:\d+[.、)]|[（(]\d+[）)]|【\d+】|第\s*\d+\s*题|Q\d+\b)/i

function splitMarkdownIntoChunks(content, options = {}) {
  const maxCharsPerChunk = normalizeMaxChars(options.maxCharsPerChunk)
  const text = String(content || '').replace(/\r\n?/g, '\n').trim()

  if (!text) return []
  if (text.length <= maxCharsPerChunk) return [text]

  const boundaries = collectBoundaries(text)
  const chunks = []
  let start = 0

  while (start < text.length) {
    const remaining = text.length - start
    if (remaining <= maxCharsPerChunk) {
      pushChunk(chunks, text.slice(start))
      break
    }

    const limit = start + maxCharsPerChunk
    const splitAt = chooseBoundary(boundaries, start, limit) || limit
    pushChunk(chunks, text.slice(start, splitAt))
    start = skipLeadingWhitespace(text, splitAt)
  }

  return chunks
}

function normalizeMaxChars(value) {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed)
  }
  return DEFAULT_MAX_CHARS_PER_CHUNK
}

function collectBoundaries(text) {
  const boundaries = []
  const lines = text.split('\n')
  let offset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isTopHeading = TOP_HEADING_RE.test(line)
    const isQuestionLine = QUESTION_LINE_RE.test(line)

    if (isTopHeading) {
      boundaries.push({ position: offset, priority: 1 })
    }

    if (isQuestionLine) {
      boundaries.push({ position: offset, priority: 2 })

      if (i > 0 && lines[i - 1].trim() === '') {
        const blankLineStart = offset - lines[i - 1].length - 1
        if (blankLineStart >= 0) {
          boundaries.push({ position: blankLineStart, priority: 3 })
        }
      }
    }

    offset += line.length + 1
  }

  return boundaries
    .filter(boundary => boundary.position > 0)
    .sort((a, b) => a.position - b.position || a.priority - b.priority)
}

function chooseBoundary(boundaries, start, limit) {
  const candidates = boundaries.filter(boundary => boundary.position > start && boundary.position <= limit)
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return b.position - a.position
  })

  return candidates[0].position
}

function pushChunk(chunks, chunk) {
  const value = chunk.trim()
  if (value) chunks.push(value)
}

function skipLeadingWhitespace(text, index) {
  let next = index
  while (next < text.length && /\s/.test(text[next])) {
    next++
  }
  return next
}

exports.splitMarkdownIntoChunks = splitMarkdownIntoChunks
exports.DEFAULT_MAX_CHARS_PER_CHUNK = DEFAULT_MAX_CHARS_PER_CHUNK
