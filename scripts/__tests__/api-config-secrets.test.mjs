import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  createPublicApiConfig,
  normalizeApiConfigUpdate
} = require('../../electron/security/apiConfig.cjs')

test('Electron 对外 API 配置不返回完整 Key', () => {
  const rawKey = 'token-test-1234567890abcdef'
  const publicConfig = createPublicApiConfig({
    apiKey: rawKey,
    apiUrl: 'https://api.example.com',
    modelId: 'model-x',
    provider: 'openai'
  })

  assert.equal(publicConfig.apiKey, '')
  assert.equal(publicConfig.hasApiKey, true)
  assert.equal(publicConfig.apiUrl, 'https://api.example.com')
  assert.equal(publicConfig.modelId, 'model-x')
  assert.equal(publicConfig.provider, 'openai')
  assert.notEqual(publicConfig.apiKeyPreview, rawKey)
  assert.equal(publicConfig.apiKeyPreview.includes(rawKey), false)
  assert.match(publicConfig.apiKeyPreview, /^toke.*cdef$/)
})

test('Electron 保存空 Key 时保留已有 Key，保存新 Key 时替换', () => {
  const existing = {
    apiKey: 'token-existing-abcdef',
    apiUrl: 'https://api.old.example',
    modelId: 'old-model',
    provider: 'custom'
  }

  assert.deepEqual(
    normalizeApiConfigUpdate(
      {
        apiKey: '   ',
        apiUrl: 'https://api.example.com',
        modelId: 'model-x',
        provider: 'openai'
      },
      existing
    ),
    {
      apiKey: 'token-existing-abcdef',
      apiUrl: 'https://api.example.com',
      modelId: 'model-x',
      provider: 'openai'
    }
  )

  assert.equal(
    normalizeApiConfigUpdate({ apiKey: ' token-new-abcdef ', apiUrl: '', modelId: '', provider: '' }, existing).apiKey,
    'token-new-abcdef'
  )
})

test('前端设置页不把读取到的完整 Key 写回输入框', () => {
  const settingsSource = fs.readFileSync('src/pages/Settings.jsx', 'utf8')
  const aiImportSource = fs.readFileSync('src/pages/AiImport.jsx', 'utf8')

  assert.equal(settingsSource.includes('setApiKey(config.apiKey'), false)
  assert.equal(settingsSource.includes('disabled={testing || !apiKey}'), false)
  assert.match(settingsSource, /hasSavedApiKey/)
  assert.match(settingsSource, /apiKeyPreview/)
  assert.match(aiImportSource, /config\.hasApiKey/)
})
