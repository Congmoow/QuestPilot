/**
 * AI 服务模块
 * 支持多种 AI API：OpenAI、Claude、Gemini、DeepSeek、通义千问等
 */

const https = require('https')
const http = require('http')
const { URL } = require('url')

const MAX_OUTPUT_TOKENS = 8192
const JSON_ERROR_PREVIEW_LENGTH = 500

// 提供商配置
const PROVIDER_CONFIG = {
  anthropic: {
    endpoint: '/v1/messages',
    authHeader: 'x-api-key',
    formatRequest: (model, messages, options = {}) => ({
      model,
      max_tokens: options.max_tokens || MAX_OUTPUT_TOKENS,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      system: messages.find(m => m.role === 'system')?.content || ''
    }),
    parseResponse: (data) => {
      if (data.content && data.content[0]) {
        return data.content[0].text
      }
      throw new Error('Claude API 返回格式异常')
    }
  },
  gemini: {
    endpoint: '/v1beta/models/{model}:generateContent',
    authHeader: 'x-goog-api-key',
    formatRequest: (model, messages, options = {}) => ({
      contents: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      systemInstruction: messages.find(m => m.role === 'system') ? {
        parts: [{ text: messages.find(m => m.role === 'system').content }]
      } : undefined,
      generationConfig: {
        maxOutputTokens: options.max_tokens || MAX_OUTPUT_TOKENS,
        temperature: options.temperature || 0.7
      }
    }),
    parseResponse: (data) => {
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text
      }
      throw new Error('Gemini API 返回格式异常')
    }
  }
}

/**
 * 调用 AI API 解析题目
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API 基础 URL
 * @param {string} model - 模型 ID
 * @param {string} content - 用户输入的题目文本
 * @returns {Promise<object>} 解析结果
 */
async function parseQuestionsWithAI(apiKey, baseUrl, model, content, options = {}) {
  const maxOutputTokens = options.maxOutputTokens || MAX_OUTPUT_TOKENS
  const chunkHint = options.chunkHint ? `\n\n当前输入分块：${options.chunkHint}。请只解析本块中的题目，不要编造其他分块内容。` : ''
  const systemPrompt = `你是一个专业的题目解析助手。用户会给你一段包含多道题目的文本，你需要将其解析为结构化的JSON格式。

请严格按照以下JSON格式输出，不要输出任何其他内容：
{
  "questions": [
    {
      "type": "single|multiple|boolean|fill|short",
      "content": "题干内容",
      "options": [
        {"id": "A", "text": "选项A内容"},
        {"id": "B", "text": "选项B内容"}
      ],
      "answer": "答案",
      "analysis": "解析（如果有）"
    }
  ]
}

题型说明：
- single: 单选题，answer 为单个选项如 "A"
- multiple: 多选题，answer 为多个选项用|分隔如 "A|B|C"
- boolean: 判断题，answer 为 "正确" 或 "错误"，不需要 options
- fill: 填空题，题干中用 ___、_、＿＿、（ ）或( ) 表示空，answer 为答案用|分隔（多个空时），不需要 options
- short: 简答题，answer 为参考答案，不需要 options

注意事项：
1. 仔细识别题型，根据题目特征判断
2. 选择题必须有 options 数组
3. 判断题、填空题、简答题不需要 options
4. 不要静默跳过题目；不确定题型时优先保留题干并按 short 输出，answer 可为空字符串
5. 忽略所有 Markdown 排版字符：#、>、*、_、\`、---、|（表格分隔符）等在解析时仅作为结构提示，最终输出的 content/options/answer 字段必须是纯文本，不保留 markdown 标记
6. 题号识别支持：1.、1、、(1)、【1】、第1题、Q1、## 1 等格式
7. 答案识别支持：答案：、Answer:、参考答案：、正确答案：、> 答案 等格式
8. 解析识别支持：解析：、分析：、Explanation:、> 解析 等格式
9. 围栏代码块如果出现在题干里，输出 content 时保留为纯文本，去掉 \`\`\` 并保持换行；如果出现在选项里，作为选项文本的一部分
10. 表格当作选项时，表头行可以忽略，每行第一列若是 A/B/C/D 则视为选项 id
11. 不要静默跳过题目；解析不出题型时按 short 输出，answer 留空字符串
12. 只输出JSON，不要有任何解释文字`

  const requestBody = {
    model: model || 'minimax-m2',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `请解析以下题目：${chunkHint}\n\n${content}`
      }
    ],
    temperature: 0.1,
    max_tokens: maxOutputTokens
  }

  return makeApiRequest(apiKey, baseUrl, requestBody, null, {
    expectJson: true,
    transport: options.transport
  })
}

/**
 * 测试 API 连接
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API 基础 URL
 * @param {string} model - 模型 ID
 * @returns {Promise<boolean>} 是否连接成功
 */
async function testConnection(apiKey, baseUrl, model) {
  const requestBody = {
    model: model || 'minimax-m2',
    messages: [
      {
        role: 'user',
        content: '你好'
      }
    ],
    max_tokens: 10
  }

  return makeApiRequest(apiKey, baseUrl, requestBody, null, { expectJson: false })
}

/**
 * 检测提供商类型
 */
function detectProvider(baseUrl) {
  if (baseUrl.includes('anthropic.com')) return 'anthropic'
  if (baseUrl.includes('generativelanguage.googleapis.com')) return 'gemini'
  return 'openai' // 默认使用 OpenAI 兼容格式
}

/**
 * 发送 API 请求（支持多种提供商）
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API 基础 URL
 * @param {object} requestBody - 请求体（OpenAI 格式）
 * @param {string} providerHint - 提供商提示
 * @returns {Promise<object>} 响应结果
 */
function makeApiRequest(apiKey, baseUrl, requestBody, providerHint = null, options = {}) {
  const expectJson = options.expectJson !== false
  const transport = options.transport

  return new Promise((resolve, reject) => {
    const provider = providerHint || detectProvider(baseUrl)
    const config = PROVIDER_CONFIG[provider]
    
    let url, finalBody, authHeader, authValue
    
    try {
      let fullUrl = baseUrl.replace(/\/+$/, '')
      
      if (config) {
        // 使用特定提供商配置
        let endpoint = config.endpoint
        if (endpoint.includes('{model}')) {
          endpoint = endpoint.replace('{model}', requestBody.model)
        }
        fullUrl = fullUrl + endpoint
        finalBody = config.formatRequest(requestBody.model, requestBody.messages, {
          max_tokens: requestBody.max_tokens,
          temperature: requestBody.temperature
        })
        authHeader = config.authHeader
        authValue = apiKey
      } else {
        // OpenAI 兼容格式
        if (!fullUrl.includes('/v1/chat/completions')) {
          fullUrl = fullUrl + '/v1/chat/completions'
        }
        finalBody = requestBody
        authHeader = 'Authorization'
        authValue = `Bearer ${apiKey}`
      }
      
      url = new URL(fullUrl)
    } catch (error) {
      reject(new Error(`无效的 API URL: ${baseUrl}`))
      return
    }

    if (typeof transport === 'function') {
      Promise.resolve()
        .then(() => transport(finalBody, { provider, url: url.toString(), headers: buildHeaders(authHeader, authValue, provider, finalBody) }))
        .then(response => {
          try {
            resolve(parseApiResponse(response, config, { expectJson }))
          } catch (error) {
            reject(error)
          }
        })
        .catch(reject)
      return
    }

    const postData = JSON.stringify(finalBody)
    
    const headers = buildHeaders(authHeader, authValue, provider, finalBody, postData)
    
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers
    }

    const protocol = url.protocol === 'https:' ? https : http

    const req = protocol.request(requestOptions, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        let response
        try {
          response = JSON.parse(data)
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}, 原始响应: ${data.substring(0, 200)}`))
          return
        }

        try {
          resolve(parseApiResponse(response, config, { expectJson }))
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`网络请求失败: ${error.message}`))
    })

    req.write(postData)
    req.end()
  })
}

function buildHeaders(authHeader, authValue, provider, finalBody, postData = null) {
  const bodyText = postData || JSON.stringify(finalBody)
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyText)
  }

  if (authHeader === 'Authorization') {
    headers.Authorization = authValue
  } else {
    headers[authHeader] = authValue
  }

  if (provider === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01'
  }

  return headers
}

function parseApiResponse(response, config, options = {}) {
  if (typeof response === 'string') {
    if (options.expectJson === false) {
      return { success: true, message: response, content: response }
    }
    return parseJsonFromAiContent(response)
  }

  if (response.error) {
    throw new Error(response.error.message || 'API 调用失败')
  }

  const content = extractResponseContent(response, config)

  if (options.expectJson === false) {
    return { success: true, message: content, content }
  }

  return parseJsonFromAiContent(content)
}

function extractResponseContent(response, config) {
  if (config && config.parseResponse) {
    return config.parseResponse(response)
  }

  if (response.choices && response.choices[0] && response.choices[0].message) {
    return response.choices[0].message.content
  }

  throw new Error('API 返回格式异常')
}

function parseJsonFromAiContent(content) {
  const rawContent = String(content || '')
  const candidates = extractJsonCandidates(rawContent)
  let lastError = null

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch (error) {
      lastError = error
    }
  }

  if (isLikelyTruncatedJson(rawContent) || candidates.some(isLikelyTruncatedJson)) {
    throw new Error(`AI 输出疑似被截断，请减少单次粘贴内容或提高 max_tokens。原始返回内容：${previewContent(rawContent)}`)
  }

  if (lastError) {
    throw new Error(`AI 返回非合法 JSON: ${lastError.message}。原始返回内容：${previewContent(rawContent)}`)
  }

  throw new Error(`AI 返回非合法 JSON，未找到可解析的 JSON 内容。原始返回内容：${previewContent(rawContent)}`)
}

function extractJsonCandidates(content) {
  const candidates = []
  const fenced = extractJsonFence(content)
  if (fenced) candidates.push(fenced)

  const firstBrace = content.indexOf('{')
  const lastBrace = content.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const braced = content.slice(firstBrace, lastBrace + 1).trim()
    if (braced && !candidates.includes(braced)) {
      candidates.push(braced)
    }
  }

  const trimmed = content.trim()
  if (trimmed && !candidates.includes(trimmed)) {
    candidates.push(trimmed)
  }

  return candidates
}

function extractJsonFence(content) {
  const fenceStart = /```json[^\n\r]*(?:\r?\n)?/i.exec(content)
  if (!fenceStart) return ''

  const bodyStart = fenceStart.index + fenceStart[0].length
  const body = content.slice(bodyStart)
  const closingFence = /^```\s*$/gm
  const positions = []
  let match

  while ((match = closingFence.exec(body)) !== null) {
    positions.push(match.index)
  }

  if (positions.length === 0) return ''
  return body.slice(0, positions[positions.length - 1]).trim()
}

function isLikelyTruncatedJson(content) {
  const value = String(content || '').trim()
  if (!value) return false
  if (value.endsWith(',')) return true
  return hasUnclosedJsonString(value)
}

function hasUnclosedJsonString(value) {
  let inString = false
  let escaped = false

  for (const char of value) {
    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
    }
  }

  return inString
}

function previewContent(content) {
  return String(content || '').trim().slice(0, JSON_ERROR_PREVIEW_LENGTH)
}

/**
 * AI 问答对话
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API 基础 URL
 * @param {string} model - 模型 ID
 * @param {Array} messages - 对话历史
 * @param {string} customPrompt - 自定义 system prompt（可选）
 * @returns {Promise<object>} AI 回复
 */
async function chatWithAI(apiKey, baseUrl, model, messages, customPrompt = null) {
  const modelName = model || 'minimax-m2'
  
  // 如果有自定义 prompt，使用自定义的；否则使用默认的
  const systemPrompt = customPrompt || `你是 ${modelName} 大语言模型，是一个智能学习助手，专门帮助用户解答学习相关的问题。

关于你的身份：
- 你的模型名称是 ${modelName}
- 如果用户询问模型提供方，请基于当前配置如实说明，无法确认时直接说明无法从本地配置判断

你可以：
1. 解答各学科的知识问题
2. 解释概念和原理
3. 提供学习建议和方法
4. 帮助分析和解决问题

请用简洁清晰的语言回答，必要时可以使用示例来说明。`

  const requestBody = {
    model: model || 'minimax-m2',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 2048
  }

  return makeApiRequest(apiKey, baseUrl, requestBody, null, { expectJson: false })
}

module.exports = {
  MAX_OUTPUT_TOKENS,
  makeApiRequest,
  parseJsonFromAiContent,
  parseQuestionsWithAI,
  testConnection,
  chatWithAI
}
