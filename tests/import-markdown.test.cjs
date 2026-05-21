const test = require('node:test')
const assert = require('node:assert/strict')

test('splitMarkdownIntoChunks 会优先在标题和题号边界切分', () => {
  const { splitMarkdownIntoChunks } = require('../electron/ai-import-chunker.cjs')

  const content = [
    '# 第一章',
    '',
    '1. Markdown 是什么？',
    'A. 标记语言',
    'B. 数据库',
    '答案：A',
    '',
    '## 第二章',
    '',
    '2. React 是什么？',
    '答案：前端库'
  ].join('\n')

  const chunks = splitMarkdownIntoChunks(content, { maxCharsPerChunk: 65 })

  assert.equal(chunks.length, 2)
  assert.match(chunks[0], /^# 第一章/)
  assert.match(chunks[1], /^## 第二章/)
})

test('splitMarkdownIntoChunks 单块过长时按字符兜底硬切', () => {
  const { splitMarkdownIntoChunks } = require('../electron/ai-import-chunker.cjs')

  const chunks = splitMarkdownIntoChunks('x'.repeat(250), { maxCharsPerChunk: 100 })

  assert.deepEqual(chunks.map(chunk => chunk.length), [100, 100, 50])
})

test('splitMarkdownIntoChunks 不会在题目正文中间切开下一道题', () => {
  const { splitMarkdownIntoChunks } = require('../electron/ai-import-chunker.cjs')

  const content = [
    '1. 下面关于事件循环的说法正确的是？',
    'A. ' + '浏览器任务队列'.repeat(12),
    'B. 微任务总是在宏任务之后全部执行',
    '答案：A',
    '',
    '2. Node.js 使用什么模块系统？',
    '答案：CommonJS'
  ].join('\n')

  const chunks = splitMarkdownIntoChunks(content, { maxCharsPerChunk: 140 })

  assert.equal(chunks.length, 2)
  assert.match(chunks[0], /^1\./)
  assert.doesNotMatch(chunks[0], /\n2\./)
  assert.match(chunks[1], /^2\./)
})

test('parseQuestionsWithAI 遇到疑似截断 JSON 时会 reject 并提示截断', async () => {
  const { parseQuestionsWithAI } = require('../electron/ai/index.cjs')
  const transport = async () => ({
    choices: [
      {
        message: {
          content: '{"questions":[{"type":"single","content":"题干","options":[{"id":"A","text":"选项"}],"answer":"A"},'
        }
      }
    ]
  })

  await assert.rejects(
    () => parseQuestionsWithAI('key', 'https://example.test', 'model', '1. 题干', { transport }),
    /疑似被截断/
  )
})

test('parseQuestionsWithAI 默认使用可导出的 MAX_OUTPUT_TOKENS', async () => {
  const { MAX_OUTPUT_TOKENS, parseQuestionsWithAI } = require('../electron/ai/index.cjs')
  let sentBody = null
  const transport = async (body) => {
    sentBody = body
    return {
      choices: [
        {
          message: {
            content: '{"questions":[]}'
          }
        }
      ]
    }
  }

  await parseQuestionsWithAI('key', 'https://example.test', 'model', '1. 题干', { transport })

  assert.equal(MAX_OUTPUT_TOKENS, 8192)
  assert.equal(sentBody.max_tokens, MAX_OUTPUT_TOKENS)
})

test('parseQuestionsWithAI 能提取 markdown json 代码块中的合法 JSON', async () => {
  const { parseQuestionsWithAI } = require('../electron/ai/index.cjs')
  const transport = async () => [
    '```json',
    '{"questions":[{"type":"single","content":"题干","options":[{"id":"A","text":"正确"}],"answer":"A","analysis":""}]}',
    '```'
  ].join('\n')

  const result = await parseQuestionsWithAI('key', 'https://example.test', 'model', '1. 题干', { transport })

  assert.equal(result.questions.length, 1)
  assert.equal(result.questions[0].answer, 'A')
})

test('parseQuestionsWithAI 能处理题干里包含嵌套围栏代码块的返回内容', async () => {
  const { parseQuestionsWithAI } = require('../electron/ai/index.cjs')
  const nestedFenceContent = [
    '```json',
    '{',
    '  "questions": [',
    '    {',
    '      "type": "short",',
    '      "content": "阅读代码：\\n```python\\nprint(1)\\n```",',
    '      "answer": "输出 1",',
    '      "analysis": ""',
    '    }',
    '  ]',
    '}',
    '```'
  ].join('\n')
  const transport = async () => ({
    choices: [{ message: { content: nestedFenceContent } }]
  })

  const result = await parseQuestionsWithAI('key', 'https://example.test', 'model', '阅读代码', { transport })

  assert.equal(result.questions.length, 1)
  assert.match(result.questions[0].content, /```python/)
})
