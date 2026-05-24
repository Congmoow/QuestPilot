/**
 * 前端 API 调用层
 * 封装桌面运行时调用，提供统一的接口
 */

import {
  getDesktopApiUnavailableError,
  getElectronAPI,
  getUnsupportedTauriApiError,
  invokeTauriCommand,
  isTauriRuntime,
} from '../lib/desktopRuntime'
import {
  normalizeFileSelectionResult,
  normalizeSaveDialogResult,
} from './runtimeAdapters'

/**
 * @typedef {'single' | 'multiple' | 'boolean' | 'fill' | 'short'} QuestionType
 * @typedef {'light' | 'dark' | 'system'} ThemeType
 */

/**
 * @typedef {Object} QuestionBank
 * @property {number} id
 * @property {string} name
 * @property {string|null} description
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} [questionCount]
 */

/**
 * @typedef {Object} QuestionOption
 * @property {string} id - A, B, C, D...
 * @property {string} text
 */

/**
 * @typedef {Object} Question
 * @property {number} id
 * @property {number} bankId
 * @property {QuestionType} type
 * @property {string} content
 * @property {QuestionOption[]|null} options
 * @property {string} answer
 * @property {string|null} analysis
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} CreateQuestionInput
 * @property {number} bankId
 * @property {QuestionType} type
 * @property {string} content
 * @property {QuestionOption[]} [options]
 * @property {string} answer
 * @property {string} [analysis]
 */

/**
 * @typedef {Object} PaginatedResult
 * @template T
 * @property {T[]} data
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 * @property {number} totalPages
 */


/**
 * @typedef {Object} QueryOptions
 * @property {number} [page]
 * @property {number} [pageSize]
 * @property {QuestionType} [type]
 */

/**
 * @typedef {Object} DashboardStats
 * @property {number} totalQuestions
 * @property {number} todayQuestions
 * @property {number} weekQuestions
 * @property {{type: QuestionType, count: number}[]} typeDistribution
 */

/**
 * @typedef {Object} OperationLog
 * @property {number} id
 * @property {string} action
 * @property {string} detail
 * @property {string} createdAt
 */

/**
 * @typedef {Object} DraftData
 * @property {QuestionType} type
 * @property {string} content
 * @property {QuestionOption[]} [options]
 * @property {string} [answer]
 * @property {string} [analysis]
 * @property {string} savedAt
 */

/**
 * @typedef {Object} ParseError
 * @property {number} row
 * @property {string} field
 * @property {string} message
 */

/**
 * @typedef {Object} ParseResult
 * @property {CreateQuestionInput[]} valid
 * @property {ParseError[]} errors
 * @property {number} totalRows
 */

/**
 * @typedef {Object} ImportResult
 * @property {number} success
 * @property {number} failed
 * @property {ParseError[]} errors
 */

const requireElectronApi = (apiName) => {
  const api = getElectronAPI()
  if (!api) {
    if (isTauriRuntime()) throw getUnsupportedTauriApiError(apiName)
    throw getDesktopApiUnavailableError()
  }
  return api
}

// ==================== 题库 API ====================

/**
 * 创建题库
 * @param {{name: string, description?: string}} data
 * @returns {Promise<QuestionBank>}
 */
export const createQuestionBank = async (data) => {
  const api = getElectronAPI()
  if (api) return api.questionBank.create(data)
  if (isTauriRuntime()) return invokeTauriCommand('question_bank_create', { data })
  throw getDesktopApiUnavailableError()
}

/**
 * 获取所有题库
 * @returns {Promise<QuestionBank[]>}
 */
export const getAllQuestionBanks = async () => {
  const api = getElectronAPI()
  if (api) return api.questionBank.getAll()
  if (isTauriRuntime()) {
    const banks = await invokeTauriCommand('question_bank_get_all')
    return banks.map((bank) => ({
      ...bank,
      questionCount: bank.questionCount ?? bank.question_count ?? 0,
    }))
  }

  throw getDesktopApiUnavailableError()
}

/**
 * 根据 ID 获取题库
 * @param {number} id
 * @returns {Promise<QuestionBank|null>}
 */
export const getQuestionBankById = async (id) => {
  const api = getElectronAPI()
  if (api) return api.questionBank.getById(id)
  if (isTauriRuntime()) return invokeTauriCommand('question_bank_get_by_id', { id })
  throw getDesktopApiUnavailableError()
}

/**
 * 更新题库
 * @param {number} id
 * @param {{name: string, description?: string}} data
 * @returns {Promise<QuestionBank>}
 */
export const updateQuestionBank = async (id, data) => {
  const api = getElectronAPI()
  if (api) return api.questionBank.update(id, data)
  if (isTauriRuntime()) return invokeTauriCommand('question_bank_update', { id, data })
  throw getDesktopApiUnavailableError()
}

/**
 * 删除题库
 * @param {number} id
 * @returns {Promise<void>}
 */
export const deleteQuestionBank = async (id) => {
  const api = getElectronAPI()
  if (api) return api.questionBank.delete(id)
  if (isTauriRuntime()) return invokeTauriCommand('question_bank_delete', { id })
  throw getDesktopApiUnavailableError()
}


// ==================== 题目 API ====================

/**
 * 创建题目
 * @param {CreateQuestionInput} data
 * @returns {Promise<Question>}
 */
export const createQuestion = async (data) => {
  const api = getElectronAPI()
  if (api) return api.question.create(data)
  if (isTauriRuntime()) {
    const { bankId, ...questionData } = data
    return invokeTauriCommand('question_create', { bankId, data: questionData })
  }

  throw getDesktopApiUnavailableError()
}

/**
 * 批量创建题目
 * @param {number} bankId
 * @param {CreateQuestionInput[]} questions
 * @returns {Promise<ImportResult>}
 */
export const createQuestionsBatch = async (bankId, questions) => {
  const api = getElectronAPI()
  if (api) return api.question.createBatch(bankId, questions)
  if (isTauriRuntime()) {
    return invokeTauriCommand('question_create_batch', { bankId, questions })
  }

  throw getDesktopApiUnavailableError()
}

/**
 * 根据题库 ID 获取题目列表
 * @param {number} bankId
 * @param {QueryOptions} [options]
 * @returns {Promise<PaginatedResult<Question>>}
 */
export const getQuestionsByBankId = async (bankId, options = {}) => {
  const api = getElectronAPI()
  if (api) return api.question.getByBankId(bankId, options)
  if (isTauriRuntime()) {
    return invokeTauriCommand('question_get_by_bank_id', {
      bankId,
      page: options.page,
      pageSize: options.pageSize,
      questionType: options.type,
    })
  }

  throw getDesktopApiUnavailableError()
}

/**
 * 从题库随机获取题目
 * @param {number} bankId
 * @param {{limit?: number, type?: QuestionType}} [options]
 * @returns {Promise<Question[]>}
 */
export const getRandomQuestions = async (bankId, options = {}) => {
  const api = getElectronAPI()
  if (api) return api.question.getRandom(bankId, options)
  if (isTauriRuntime()) {
    return invokeTauriCommand('question_get_random', {
      bankId,
      limit: options.limit,
      questionType: options.type,
    })
  }

  throw getDesktopApiUnavailableError()
}

/**
 * 根据 ID 获取题目
 * @param {number} id
 * @returns {Promise<Question|null>}
 */
export const getQuestionById = async (id) => {
  const api = getElectronAPI()
  if (api) return api.question.getById(id)
  if (isTauriRuntime()) return invokeTauriCommand('question_get_by_id', { id })
  throw getDesktopApiUnavailableError()
}

/**
 * 更新题目
 * @param {number} id
 * @param {Partial<CreateQuestionInput>} data
 * @returns {Promise<Question>}
 */
export const updateQuestion = async (id, data) => {
  const api = getElectronAPI()
  if (api) return api.question.update(id, data)
  if (isTauriRuntime()) return invokeTauriCommand('question_update', { id, data })
  throw getDesktopApiUnavailableError()
}

/**
 * 删除题目
 * @param {number[]} ids
 * @returns {Promise<void>}
 */
export const deleteQuestions = async (ids) => {
  const api = getElectronAPI()
  if (api) return api.question.delete(ids)
  if (isTauriRuntime()) return invokeTauriCommand('question_delete', { ids })
  throw getDesktopApiUnavailableError()
}

/**
 * 搜索题目
 * @param {number} bankId
 * @param {string} keyword
 * @param {QueryOptions} [options]
 * @returns {Promise<PaginatedResult<Question>>}
 */
export const searchQuestions = async (bankId, keyword, options = {}) => {
  const api = getElectronAPI()
  if (api) return api.question.search(bankId, keyword, options)
  if (isTauriRuntime()) {
    return invokeTauriCommand('question_search', {
      bankId,
      keyword,
      page: options.page,
      pageSize: options.pageSize,
      questionType: options.type,
    })
  }

  throw getDesktopApiUnavailableError()
}

// ==================== CSV API ====================

/**
 * 下载 CSV 模板
 * @returns {Promise<{success: boolean, canceled: boolean, filePath?: string}>}
 */
export const downloadCsvTemplate = async () => {
  const api = getElectronAPI()
  if (api) return normalizeSaveDialogResult(await api.csv.downloadTemplate())
  if (isTauriRuntime()) return normalizeSaveDialogResult(await invokeTauriCommand('csv_download_template'))
  throw getDesktopApiUnavailableError()
}

/**
 * 选择 CSV 文件
 * @returns {Promise<{success: boolean, canceled: boolean, filePath: string|null}>}
 */
export const selectCsvFile = async () => {
  const api = getElectronAPI()
  if (api) return normalizeFileSelectionResult(await api.csv.selectFile())
  if (isTauriRuntime()) return normalizeFileSelectionResult(await invokeTauriCommand('csv_select_file'))
  throw getDesktopApiUnavailableError()
}

/**
 * 解析 CSV 文件
 * @param {string} filePath
 * @returns {Promise<ParseResult>}
 */
export const parseCsvFile = async (filePath) => {
  const api = getElectronAPI()
  if (api) return api.csv.parseFile(filePath)
  if (isTauriRuntime()) return invokeTauriCommand('csv_parse_file', { filePath })
  throw getDesktopApiUnavailableError()
}

/**
 * 导入题目
 * @param {number} bankId
 * @param {CreateQuestionInput[]} questions
 * @returns {Promise<ImportResult>}
 */
export const importQuestions = async (bankId, questions) => {
  const api = getElectronAPI()
  if (api) return api.csv.importQuestions(bankId, questions)
  if (isTauriRuntime()) return invokeTauriCommand('csv_import', { bankId, questions })
  throw getDesktopApiUnavailableError()
}

/**
 * 导出题库
 * @param {number} bankId
 * @returns {Promise<{success: boolean, canceled: boolean, filePath?: string, count?: number}>}
 */
export const exportQuestionBank = async (bankId) => {
  const api = getElectronAPI()
  if (api) return normalizeSaveDialogResult(await api.csv.exportBank(bankId))
  if (isTauriRuntime()) return normalizeSaveDialogResult(await invokeTauriCommand('csv_export', { bankId }))
  throw getDesktopApiUnavailableError()
}


// ==================== 统计 API ====================

/**
 * 获取仪表盘统计数据
 * @returns {Promise<DashboardStats>}
 */
export const getDashboardStats = async () => {
  const api = getElectronAPI()
  if (api) return api.stats.getDashboardStats()
  if (isTauriRuntime()) return invokeTauriCommand('stats_get_dashboard')

  throw getDesktopApiUnavailableError()
}

/**
 * 获取操作日志
 * @param {number} [limit=10]
 * @returns {Promise<OperationLog[]>}
 */
export const getOperationLogs = async (limit = 10) => {
  const api = getElectronAPI()
  if (api) return api.stats.getOperationLogs(limit)
  if (isTauriRuntime()) return invokeTauriCommand('stats_get_operation_logs', { limit })
  throw getDesktopApiUnavailableError()
}

/**
 * 获取题型分布（可按题库筛选）
 * @param {number|null} [bankId=null]
 * @returns {Promise<{type: QuestionType, count: number}[]>}
 */
export const getTypeDistribution = async (bankId = null) => {
  const api = getElectronAPI()
  if (api) return api.stats.getTypeDistribution(bankId)
  if (isTauriRuntime()) return invokeTauriCommand('stats_get_type_distribution', { bankId })
  throw getDesktopApiUnavailableError()
}

// ==================== 设置 API ====================

/**
 * 获取主题设置
 * @returns {Promise<ThemeType>}
 */
export const getTheme = async () => {
  const api = getElectronAPI()
  if (api) return api.settings.getTheme()
  if (isTauriRuntime()) return invokeTauriCommand('settings_get_theme')
  throw getDesktopApiUnavailableError()
}

/**
 * 设置主题
 * @param {ThemeType} theme
 * @returns {Promise<void>}
 */
export const setTheme = async (theme) => {
  const api = getElectronAPI()
  if (api) return api.settings.setTheme(theme)
  if (isTauriRuntime()) return invokeTauriCommand('settings_set_theme', { theme })
  throw getDesktopApiUnavailableError()
}

export const getWrongBookThreshold = async () => {
  const api = getElectronAPI()
  if (api) return api.settings.getWrongBookThreshold()
  if (isTauriRuntime()) return invokeTauriCommand('settings_get_wrong_book_threshold')
  throw getDesktopApiUnavailableError()
}

export const setWrongBookThreshold = async (threshold) => {
  const api = getElectronAPI()
  if (api) return api.settings.setWrongBookThreshold(threshold)
  if (isTauriRuntime()) return invokeTauriCommand('settings_set_wrong_book_threshold', { threshold })
  throw getDesktopApiUnavailableError()
}

// ==================== 草稿 API ====================

/**
 * 保存草稿
 * @param {DraftData} data
 * @returns {Promise<void>}
 */
export const saveDraft = async (data) => {
  const api = getElectronAPI()
  if (api) return api.draft.save(data)
  if (isTauriRuntime()) return invokeTauriCommand('draft_save', { data })
  throw getDesktopApiUnavailableError()
}

/**
 * 加载草稿
 * @returns {Promise<DraftData|null>}
 */
export const loadDraft = async () => {
  const api = getElectronAPI()
  if (api) return api.draft.load()
  if (isTauriRuntime()) return invokeTauriCommand('draft_load')
  throw getDesktopApiUnavailableError()
}

/**
 * 清除草稿
 * @returns {Promise<void>}
 */
export const clearDraft = async () => {
  const api = getElectronAPI()
  if (api) return api.draft.clear()
  if (isTauriRuntime()) return invokeTauriCommand('draft_clear')
  throw getDesktopApiUnavailableError()
}

// ==================== 设置扩展 API ====================

/**
 * 获取 API 配置
 * @returns {Promise<{apiKey: string, apiUrl: string, modelId: string}>}
 */
export const getApiConfig = async () => {
  const api = getElectronAPI()
  if (api) return api.settings.getApiConfig()
  if (isTauriRuntime()) return invokeTauriCommand('settings_get_api_config')
  throw getDesktopApiUnavailableError()
}

/**
 * 设置 API 配置
 * @param {{apiKey: string, apiUrl: string, modelId: string}} config
 * @returns {Promise<void>}
 */
export const setApiConfig = async (config) => {
  const api = getElectronAPI()
  if (api) return api.settings.setApiConfig(config)
  if (isTauriRuntime()) return invokeTauriCommand('settings_set_api_config', { config })
  throw getDesktopApiUnavailableError()
}

/**
 * 测试 API 连接
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const testApiConnection = async () => {
  const api = getElectronAPI()
  if (api) return api.settings.testApiConnection()
  if (isTauriRuntime()) return invokeTauriCommand('settings_test_api_connection')
  throw getDesktopApiUnavailableError()
}

// ==================== AI API ====================

/**
 * AI 解析题目
 * @param {string} content
 * @returns {Promise<{questions: CreateQuestionInput[]}>}
 */
export const parseQuestionsWithAI = async (content) => {
  const api = getElectronAPI()
  if (api) return api.ai.parseQuestions(content)
  if (isTauriRuntime()) return invokeTauriCommand('ai_parse_questions', { content })
  throw getDesktopApiUnavailableError()
}

export const chatWithAI = async (messages, promptId) => {
  const api = getElectronAPI()
  if (api) return api.ai.chat(messages, promptId)
  if (isTauriRuntime()) return invokeTauriCommand('ai_chat', { messages, promptId })
  throw getDesktopApiUnavailableError()
}

// ==================== Prompt API ====================

export const getAllPrompts = async () => {
  const api = getElectronAPI()
  if (api) return api.prompt.getAll()
  if (isTauriRuntime()) return invokeTauriCommand('prompt_get_all')
  throw getDesktopApiUnavailableError()
}

export const getPromptById = async (id) => {
  const api = getElectronAPI()
  if (api) return api.prompt.getById(id)
  if (isTauriRuntime()) return invokeTauriCommand('prompt_get_by_id', { id })
  throw getDesktopApiUnavailableError()
}

export const createPrompt = async (data) => {
  const api = getElectronAPI()
  if (api) return api.prompt.create(data)
  if (isTauriRuntime()) return invokeTauriCommand('prompt_create', { data })
  throw getDesktopApiUnavailableError()
}

export const updatePrompt = async (id, data) => {
  const api = getElectronAPI()
  if (api) return api.prompt.update(id, data)
  if (isTauriRuntime()) return invokeTauriCommand('prompt_update', { id, data })
  throw getDesktopApiUnavailableError()
}

export const deletePrompt = async (id) => {
  const api = getElectronAPI()
  if (api) return api.prompt.delete(id)
  if (isTauriRuntime()) return invokeTauriCommand('prompt_delete', { id })
  throw getDesktopApiUnavailableError()
}

// ==================== 聊天历史 API ====================

export const saveChatHistory = async (data) => {
  const api = getElectronAPI()
  if (api) return api.chatHistory.save(data)
  if (isTauriRuntime()) return invokeTauriCommand('chat_history_save', { data })
  throw getDesktopApiUnavailableError()
}

export const updateChatHistory = async (id, messages) => {
  const api = getElectronAPI()
  if (api) return api.chatHistory.update(id, messages)
  if (isTauriRuntime()) return invokeTauriCommand('chat_history_update', { id, messages })
  throw getDesktopApiUnavailableError()
}

export const getAllChatHistory = async (limit = 50) => {
  const api = getElectronAPI()
  if (api) return api.chatHistory.getAll(limit)
  if (isTauriRuntime()) return invokeTauriCommand('chat_history_get_all', { limit })
  throw getDesktopApiUnavailableError()
}

export const getChatHistoryById = async (id) => {
  const api = getElectronAPI()
  if (api) return api.chatHistory.getById(id)
  if (isTauriRuntime()) return invokeTauriCommand('chat_history_get_by_id', { id })
  throw getDesktopApiUnavailableError()
}

export const deleteChatHistory = async (id) => {
  const api = getElectronAPI()
  if (api) return api.chatHistory.delete(id)
  if (isTauriRuntime()) return invokeTauriCommand('chat_history_delete', { id })
  throw getDesktopApiUnavailableError()
}

// ==================== 默认导出 ====================

export default {
  // 题库
  questionBank: {
    create: createQuestionBank,
    getAll: getAllQuestionBanks,
    getById: getQuestionBankById,
    update: updateQuestionBank,
    delete: deleteQuestionBank,
  },
  // 题目
  question: {
    create: createQuestion,
    createBatch: createQuestionsBatch,
    getByBankId: getQuestionsByBankId,
    getRandom: getRandomQuestions,
    getById: getQuestionById,
    update: updateQuestion,
    delete: deleteQuestions,
    search: searchQuestions,
  },
  // CSV
  csv: {
    downloadTemplate: downloadCsvTemplate,
    selectFile: selectCsvFile,
    parseFile: parseCsvFile,
    import: importQuestions,
    export: exportQuestionBank,
  },
  // 统计
  stats: {
    getDashboard: getDashboardStats,
    getOperationLogs: getOperationLogs,
    getTypeDistribution: getTypeDistribution,
  },
  // 设置
  settings: {
    getTheme: getTheme,
    setTheme: setTheme,
    getApiConfig: getApiConfig,
    setApiConfig: setApiConfig,
    testApiConnection: testApiConnection,
    getWrongBookThreshold: getWrongBookThreshold,
    setWrongBookThreshold: setWrongBookThreshold,
  },
  // 草稿
  draft: {
    save: saveDraft,
    load: loadDraft,
    clear: clearDraft,
  },
  // AI
  ai: {
    parseQuestions: parseQuestionsWithAI,
    chat: chatWithAI,
  },
  prompt: {
    getAll: getAllPrompts,
    getById: getPromptById,
    create: createPrompt,
    update: updatePrompt,
    delete: deletePrompt,
  },
  chatHistory: {
    save: saveChatHistory,
    update: updateChatHistory,
    getAll: getAllChatHistory,
    getById: getChatHistoryById,
    delete: deleteChatHistory,
  },
  // 练习
  practice: {
    saveRecord: async (record) => {
      const api = getElectronAPI()
      if (api) return api.practice.saveRecord(record)
      if (isTauriRuntime()) return invokeTauriCommand('practice_save_record', { record })
      throw getDesktopApiUnavailableError()
    },
    getRecords: async (bankId, limit = 20) => {
      const api = getElectronAPI()
      if (api) return api.practice.getRecords(bankId, limit)
      if (isTauriRuntime()) return invokeTauriCommand('practice_get_records', { bankId, limit })
      throw getDesktopApiUnavailableError()
    },
    getAllStats: async () => {
      const api = getElectronAPI()
      if (api) return api.practice.getAllStats()
      if (isTauriRuntime()) return invokeTauriCommand('practice_get_all_stats')
      throw getDesktopApiUnavailableError()
    },
  },

  wrongBook: {
    getCountsByBank: async () => {
      const api = getElectronAPI()
      if (api) return api.wrongBook.getCountsByBank()
      if (isTauriRuntime()) return invokeTauriCommand('wrong_book_get_counts_by_bank')
      throw getDesktopApiUnavailableError()
    },
    getItems: async (bankId, options = {}) => {
      const api = getElectronAPI()
      if (api) return api.wrongBook.getItems(bankId, options)
      if (isTauriRuntime()) {
        return invokeTauriCommand('wrong_book_get_items', {
          bankId,
          page: options.page,
          pageSize: options.pageSize,
        })
      }
      throw getDesktopApiUnavailableError()
    },
    getRandomQuestions: async (bankId, limit = 20) => {
      const api = getElectronAPI()
      if (api) return api.wrongBook.getRandomQuestions(bankId, limit)
      if (isTauriRuntime()) return invokeTauriCommand('wrong_book_get_random_questions', { bankId, limit })
      throw getDesktopApiUnavailableError()
    },
    updateFromPractice: async (results, threshold) => {
      const api = getElectronAPI()
      if (api) return api.wrongBook.updateFromPractice(results, threshold)
      if (isTauriRuntime()) return invokeTauriCommand('wrong_book_update_from_practice', { results, threshold })
      throw getDesktopApiUnavailableError()
    },
    removeItem: async (questionId) => {
      const api = getElectronAPI()
      if (api) return api.wrongBook.removeItem(questionId)
      if (isTauriRuntime()) return invokeTauriCommand('wrong_book_remove_item', { questionId })
      throw getDesktopApiUnavailableError()
    },
    clear: async (bankId) => {
      const api = getElectronAPI()
      if (api) return api.wrongBook.clear(bankId)
      if (isTauriRuntime()) return invokeTauriCommand('wrong_book_clear', { bankId })
      throw getDesktopApiUnavailableError()
    },
  },
}
