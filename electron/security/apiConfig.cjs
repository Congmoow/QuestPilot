const DEFAULT_API_URL = 'https://api.openai.com'
const DEFAULT_MODEL_ID = 'gpt-3.5-turbo'
const DEFAULT_PROVIDER = 'custom'

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function maskApiKey(apiKey) {
  const value = normalizeString(apiKey)
  if (!value) return ''
  if (value.length <= 8) return '••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

function createPublicApiConfig(config = {}) {
  const apiKey = normalizeString(config.apiKey)

  return {
    apiKey: '',
    apiKeyPreview: maskApiKey(apiKey),
    hasApiKey: Boolean(apiKey),
    apiUrl: normalizeString(config.apiUrl) || DEFAULT_API_URL,
    modelId: normalizeString(config.modelId) || DEFAULT_MODEL_ID,
    provider: normalizeString(config.provider) || DEFAULT_PROVIDER
  }
}

function normalizeApiConfigUpdate(input = {}, existing = {}) {
  const nextApiKey = normalizeString(input.apiKey)
  const existingApiKey = normalizeString(existing.apiKey)

  return {
    apiKey: nextApiKey || existingApiKey,
    apiUrl: normalizeString(input.apiUrl) || DEFAULT_API_URL,
    modelId: normalizeString(input.modelId) || DEFAULT_MODEL_ID,
    provider: normalizeString(input.provider) || DEFAULT_PROVIDER
  }
}

module.exports = {
  DEFAULT_API_URL,
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER,
  createPublicApiConfig,
  maskApiKey,
  normalizeApiConfigUpdate
}
