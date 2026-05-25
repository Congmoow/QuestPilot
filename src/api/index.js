/**
 * 前端 API 调用层
 * Tauri 主线下页面层只通过本文件访问桌面命令。
 */

import { getDesktopRuntime, invokeTauriCommand } from '../lib/desktopRuntime'
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
 * @property {number} [bankId]
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

const normalizeBank = (bank) => ({
  ...bank,
  questionCount: bank.questionCount ?? bank.question_count ?? 0,
})

const questionPayload = (data) => {
  const { bankId, ...payload } = data
  return payload
}

// ==================== 题库 API ====================

export const createQuestionBank = async (data) => invokeTauriCommand('question_bank_create', { data })

export const getAllQuestionBanks = async () => {
  const banks = await invokeTauriCommand('question_bank_get_all')
  return banks.map(normalizeBank)
}

export const getQuestionBankById = async (id) => invokeTauriCommand('question_bank_get_by_id', { id })

export const updateQuestionBank = async (id, data) => invokeTauriCommand('question_bank_update', { id, data })

export const deleteQuestionBank = async (id) => invokeTauriCommand('question_bank_delete', { id })

// ==================== 题目 API ====================

export const createQuestion = async (data) => {
  const { bankId } = data
  return invokeTauriCommand('question_create', { bankId, data: questionPayload(data) })
}

export const createQuestionsBatch = async (bankId, questions) => {
  return invokeTauriCommand('question_create_batch', { bankId, questions })
}

export const getQuestionsByBankId = async (bankId, options = {}) => {
  return invokeTauriCommand('question_get_by_bank_id', {
    bankId,
    page: options.page,
    pageSize: options.pageSize,
    questionType: options.type,
  })
}

export const getRandomQuestions = async (bankId, options = {}) => {
  return invokeTauriCommand('question_get_random', {
    bankId,
    limit: options.limit,
    questionType: options.type,
  })
}

export const getQuestionById = async (id) => invokeTauriCommand('question_get_by_id', { id })

export const updateQuestion = async (id, data) => {
  return invokeTauriCommand('question_update', { id, data: questionPayload(data) })
}

export const deleteQuestions = async (ids) => invokeTauriCommand('question_delete', { ids })

export const searchQuestions = async (bankId, keyword, options = {}) => {
  return invokeTauriCommand('question_search', {
    bankId,
    keyword,
    page: options.page,
    pageSize: options.pageSize,
    questionType: options.type,
  })
}

// ==================== CSV API ====================

export const downloadCsvTemplate = async () => {
  return normalizeSaveDialogResult(await invokeTauriCommand('csv_download_template'))
}

export const selectCsvFile = async () => {
  return normalizeFileSelectionResult(await invokeTauriCommand('csv_select_file'))
}

export const parseCsvFile = async (filePath) => invokeTauriCommand('csv_parse_file', { filePath })

export const importQuestions = async (bankId, questions) => invokeTauriCommand('csv_import', { bankId, questions })

export const exportQuestionBank = async (bankId) => {
  return normalizeSaveDialogResult(await invokeTauriCommand('csv_export', { bankId }))
}

// ==================== 统计 API ====================

export const getDashboardStats = async () => invokeTauriCommand('stats_get_dashboard')

export const getOperationLogs = async (limit = 10) => invokeTauriCommand('stats_get_operation_logs', { limit })

export const getTypeDistribution = async (bankId = null) => {
  return invokeTauriCommand('stats_get_type_distribution', { bankId })
}

// ==================== 设置 API ====================

export const getTheme = async () => invokeTauriCommand('settings_get_theme')

export const setTheme = async (theme) => invokeTauriCommand('settings_set_theme', { theme })

export const getWrongBookThreshold = async () => invokeTauriCommand('settings_get_wrong_book_threshold')

export const setWrongBookThreshold = async (threshold) => {
  return invokeTauriCommand('settings_set_wrong_book_threshold', { threshold })
}

// ==================== 草稿 API ====================

export const saveDraft = async (data) => invokeTauriCommand('draft_save', { data })

export const loadDraft = async () => invokeTauriCommand('draft_load')

export const clearDraft = async () => invokeTauriCommand('draft_clear')

// ==================== 设置扩展 API ====================

export const getApiConfig = async () => invokeTauriCommand('settings_get_api_config')

export const setApiConfig = async (config) => invokeTauriCommand('settings_set_api_config', { config })

export const testApiConnection = async () => invokeTauriCommand('settings_test_api_connection')

// ==================== 数据迁移 API ====================

export const getLegacyDatabaseStatus = async () => invokeTauriCommand('migration_get_legacy_status')

export const getRuntimeName = () => getDesktopRuntime()

export const backupAndReplaceFromLegacy = async (legacyPath) => {
  return invokeTauriCommand('migration_backup_and_replace_from_legacy', {
    legacyPath,
    confirmation: 'BACKUP_AND_REPLACE',
  })
}

// ==================== AI API ====================

export const parseQuestionsWithAI = async (content) => invokeTauriCommand('ai_parse_questions', { content })

export const chatWithAI = async (messages, promptId) => invokeTauriCommand('ai_chat', { messages, promptId })

// ==================== Prompt API ====================

export const getAllPrompts = async () => invokeTauriCommand('prompt_get_all')

export const getPromptById = async (id) => invokeTauriCommand('prompt_get_by_id', { id })

export const createPrompt = async (data) => invokeTauriCommand('prompt_create', { data })

export const updatePrompt = async (id, data) => invokeTauriCommand('prompt_update', { id, data })

export const deletePrompt = async (id) => invokeTauriCommand('prompt_delete', { id })

// ==================== 聊天历史 API ====================

export const saveChatHistory = async (data) => invokeTauriCommand('chat_history_save', { data })

export const updateChatHistory = async (id, messages) => invokeTauriCommand('chat_history_update', { id, messages })

export const getAllChatHistory = async (limit = 50) => invokeTauriCommand('chat_history_get_all', { limit })

export const getChatHistoryById = async (id) => invokeTauriCommand('chat_history_get_by_id', { id })

export const deleteChatHistory = async (id) => invokeTauriCommand('chat_history_delete', { id })

// ==================== 练习 API ====================

export const savePracticeRecord = async (record) => invokeTauriCommand('practice_save_record', { record })

export const getPracticeRecords = async (bankId, limit = 20) => {
  return invokeTauriCommand('practice_get_records', { bankId, limit })
}

export const getAllPracticeStats = async () => invokeTauriCommand('practice_get_all_stats')

// ==================== 错题本 API ====================

export const getWrongBookCountsByBank = async () => invokeTauriCommand('wrong_book_get_counts_by_bank')

export const getWrongBookItems = async (bankId, options = {}) => {
  return invokeTauriCommand('wrong_book_get_items', {
    bankId,
    page: options.page,
    pageSize: options.pageSize,
  })
}

export const getRandomWrongBookQuestions = async (bankId, limit = 20) => {
  return invokeTauriCommand('wrong_book_get_random_questions', { bankId, limit })
}

export const updateWrongBookFromPractice = async (results, threshold) => {
  return invokeTauriCommand('wrong_book_update_from_practice', { results, threshold })
}

export const removeWrongBookItem = async (questionId) => {
  return invokeTauriCommand('wrong_book_remove_item', { questionId })
}

export const clearWrongBook = async (bankId) => invokeTauriCommand('wrong_book_clear', { bankId })

// ==================== 默认导出 ====================

export default {
  questionBank: {
    create: createQuestionBank,
    getAll: getAllQuestionBanks,
    getById: getQuestionBankById,
    update: updateQuestionBank,
    delete: deleteQuestionBank,
  },
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
  csv: {
    downloadTemplate: downloadCsvTemplate,
    selectFile: selectCsvFile,
    parseFile: parseCsvFile,
    import: importQuestions,
    export: exportQuestionBank,
  },
  stats: {
    getDashboard: getDashboardStats,
    getOperationLogs,
    getTypeDistribution,
  },
  settings: {
    getTheme,
    setTheme,
    getApiConfig,
    setApiConfig,
    testApiConnection,
    getWrongBookThreshold,
    setWrongBookThreshold,
  },
  migration: {
    getRuntimeName,
    getLegacyStatus: getLegacyDatabaseStatus,
    backupAndReplaceFromLegacy,
  },
  draft: {
    save: saveDraft,
    load: loadDraft,
    clear: clearDraft,
  },
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
  practice: {
    saveRecord: savePracticeRecord,
    getRecords: getPracticeRecords,
    getAllStats: getAllPracticeStats,
  },
  wrongBook: {
    getCountsByBank: getWrongBookCountsByBank,
    getItems: getWrongBookItems,
    getRandomQuestions: getRandomWrongBookQuestions,
    updateFromPractice: updateWrongBookFromPractice,
    removeItem: removeWrongBookItem,
    clear: clearWrongBook,
  },
}
