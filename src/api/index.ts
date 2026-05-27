/**
 * 前端 API 调用层
 * Tauri 主线下页面层只通过本文件访问桌面命令。
 */

import { getDesktopRuntime, invokeTauriCommand } from '../lib/desktopRuntime';
import { normalizeFileSelectionResult, normalizeSaveDialogResult } from './runtimeAdapters';
import {
  AiParseResultSchema,
  ApiConfigSchema,
  QuestionBankSchema,
  safeValidate,
  strictValidate,
} from './schemas';
import type {
  AiChatResult,
  AiMessage,
  AiParseResult,
  ApiConfig,
  ApiConnectionResult,
  ChatHistory,
  CreateQuestionBankInput,
  CreateQuestionInput,
  DashboardStats,
  DraftData,
  FileSelectionResult,
  ImportResult,
  LegacyDatabaseReplaceResult,
  LegacyDatabaseStatus,
  OperationLog,
  PaginatedResult,
  ParseResult,
  PracticeRecord,
  PracticeRecordInput,
  PracticeStats,
  Prompt,
  QueryOptions,
  Question,
  QuestionBank,
  SaveDialogResult,
  ThemeType,
  WrongBookItem,
  WrongBookPracticeResult,
} from './types';

export type {
  AiChatResult,
  AiMessage,
  AiParseResult,
  ApiConfig,
  ApiConnectionResult,
  ChatHistory,
  CreateQuestionBankInput,
  CreateQuestionInput,
  DashboardStats,
  DraftData,
  FileSelectionResult,
  ImportResult,
  LegacyDatabaseCandidate,
  LegacyDatabaseReplaceResult,
  LegacyDatabaseStatus,
  OperationLog,
  PaginatedResult,
  ParseError,
  ParseResult,
  PracticeRecord,
  PracticeRecordInput,
  PracticeStats,
  Prompt,
  QueryOptions,
  Question,
  QuestionBank,
  QuestionOption,
  QuestionType,
  SaveDialogResult,
  ThemeType,
  WrongBookItem,
  WrongBookPracticeResult,
} from './types';

type QuestionPayload = Omit<CreateQuestionInput, 'bankId'>;

const normalizeBank = (bank: QuestionBank): QuestionBank => ({
  ...bank,
  questionCount: bank.questionCount ?? bank.question_count ?? 0,
});

const questionPayload = (data: CreateQuestionInput): QuestionPayload => {
  const { bankId: _bankId, ...payload } = data;
  return payload;
};

// ==================== 题库 API ====================

export const createQuestionBank = async (data: CreateQuestionBankInput): Promise<QuestionBank> => {
  return invokeTauriCommand<QuestionBank>('question_bank_create', { data });
};

export const getAllQuestionBanks = async (): Promise<QuestionBank[]> => {
  const banks = await invokeTauriCommand<QuestionBank[]>('question_bank_get_all');
  return banks
    .map(normalizeBank)
    .map((b) => safeValidate(QuestionBankSchema, b, 'getAllQuestionBanks'));
};

export const getQuestionBankById = async (id: number): Promise<QuestionBank | null> => {
  return invokeTauriCommand<QuestionBank | null>('question_bank_get_by_id', { id });
};

export const updateQuestionBank = async (
  id: number,
  data: CreateQuestionBankInput,
): Promise<QuestionBank | null> => {
  return invokeTauriCommand<QuestionBank | null>('question_bank_update', { id, data });
};

export const deleteQuestionBank = async (id: number): Promise<void> => {
  return invokeTauriCommand<void>('question_bank_delete', { id });
};

// ==================== 题目 API ====================

export const createQuestion = async (data: CreateQuestionInput): Promise<Question> => {
  const { bankId } = data;
  return invokeTauriCommand<Question>('question_create', { bankId, data: questionPayload(data) });
};

export const createQuestionsBatch = async (
  bankId: number,
  questions: CreateQuestionInput[],
): Promise<ImportResult> => {
  return invokeTauriCommand<ImportResult>('question_create_batch', { bankId, questions });
};

export const getQuestionsByBankId = async (
  bankId: number,
  options: QueryOptions = {},
): Promise<PaginatedResult<Question>> => {
  return invokeTauriCommand<PaginatedResult<Question>>('question_get_by_bank_id', {
    bankId,
    page: options.page,
    pageSize: options.pageSize,
    questionType: options.type,
  });
};

export const getRandomQuestions = async (
  bankId: number,
  options: Pick<QueryOptions, 'type'> & { limit?: number } = {},
): Promise<Question[]> => {
  return invokeTauriCommand<Question[]>('question_get_random', {
    bankId,
    limit: options.limit,
    questionType: options.type,
  });
};

export const getQuestionById = async (id: number): Promise<Question | null> => {
  return invokeTauriCommand<Question | null>('question_get_by_id', { id });
};

export const updateQuestion = async (
  id: number,
  data: Partial<CreateQuestionInput>,
): Promise<Question | null> => {
  return invokeTauriCommand<Question | null>('question_update', {
    id,
    data: questionPayload(data as CreateQuestionInput),
  });
};

export const deleteQuestions = async (ids: number[]): Promise<void> => {
  return invokeTauriCommand<void>('question_delete', { ids });
};

export const searchQuestions = async (
  bankId: number,
  keyword: string,
  options: QueryOptions = {},
): Promise<PaginatedResult<Question>> => {
  return invokeTauriCommand<PaginatedResult<Question>>('question_search', {
    bankId,
    keyword,
    page: options.page,
    pageSize: options.pageSize,
    questionType: options.type,
  });
};

// ==================== CSV API ====================

export const downloadCsvTemplate = async (): Promise<SaveDialogResult> => {
  return normalizeSaveDialogResult(await invokeTauriCommand('csv_download_template'));
};

export const selectCsvFile = async (): Promise<FileSelectionResult> => {
  return normalizeFileSelectionResult(await invokeTauriCommand('csv_select_file'));
};

export const parseCsvFile = async (filePath: string): Promise<ParseResult> => {
  return invokeTauriCommand('csv_parse_file', { filePath });
};

export const selectTomlFile = async (): Promise<FileSelectionResult> => {
  return normalizeFileSelectionResult(await invokeTauriCommand('toml_select_file'));
};

export const parseTomlFile = async (filePath: string): Promise<ParseResult> => {
  return invokeTauriCommand('toml_parse_file', { filePath });
};

export const importQuestions = async (
  bankId: number,
  questions: CreateQuestionInput[],
): Promise<ImportResult> => {
  return invokeTauriCommand<ImportResult>('csv_import', { bankId, questions });
};

export const exportQuestionBank = async (bankId: number): Promise<SaveDialogResult> => {
  return normalizeSaveDialogResult(await invokeTauriCommand('csv_export', { bankId }));
};

// ==================== 统计 API ====================

export const getDashboardStats = async (): Promise<DashboardStats> =>
  invokeTauriCommand('stats_get_dashboard');

export const getOperationLogs = async (limit = 10): Promise<OperationLog[]> => {
  return invokeTauriCommand<OperationLog[]>('stats_get_operation_logs', { limit });
};

export const getTypeDistribution = async (
  bankId: number | null = null,
): Promise<Array<{ type: string; count: number }>> => {
  return invokeTauriCommand('stats_get_type_distribution', { bankId });
};

// ==================== 设置 API ====================

export const getTheme = async (): Promise<ThemeType> => invokeTauriCommand('settings_get_theme');

export const setTheme = async (theme: ThemeType): Promise<void> => {
  return invokeTauriCommand('settings_set_theme', { theme });
};

export const getWrongBookThreshold = async (): Promise<number> => {
  return invokeTauriCommand('settings_get_wrong_book_threshold');
};

export const setWrongBookThreshold = async (threshold: number): Promise<void> => {
  return invokeTauriCommand('settings_set_wrong_book_threshold', { threshold });
};

// ==================== 草稿 API ====================

export const saveDraft = async (data: DraftData): Promise<{ success: boolean }> =>
  invokeTauriCommand('draft_save', { data });

export const loadDraft = async (): Promise<DraftData | null> => invokeTauriCommand('draft_load');

export const clearDraft = async (): Promise<{ success: boolean }> =>
  invokeTauriCommand('draft_clear');

// ==================== 设置扩展 API ====================

export const getApiConfig = async (): Promise<ApiConfig> => {
  const raw = await invokeTauriCommand('settings_get_api_config');
  return safeValidate(ApiConfigSchema, raw, 'getApiConfig');
};

export const setApiConfig = async (
  config: Pick<ApiConfig, 'apiKey' | 'apiUrl' | 'modelId' | 'provider'>,
): Promise<{ success: boolean }> => invokeTauriCommand('settings_set_api_config', { config });

export const testApiConnection = async (): Promise<ApiConnectionResult> =>
  invokeTauriCommand('settings_test_api_connection');

// ==================== 数据迁移 API ====================

export const getLegacyDatabaseStatus = async (): Promise<LegacyDatabaseStatus> => {
  return invokeTauriCommand('migration_get_legacy_status');
};

export const getRuntimeName = (): 'tauri' => getDesktopRuntime();

export const backupAndReplaceFromLegacy = async (
  legacyPath: string,
): Promise<LegacyDatabaseReplaceResult> => {
  return invokeTauriCommand('migration_backup_and_replace_from_legacy', {
    legacyPath,
    confirmation: 'BACKUP_AND_REPLACE',
  });
};

// ==================== AI API ====================

export const parseQuestionsWithAI = async (content: string): Promise<AiParseResult> => {
  const raw = await invokeTauriCommand('ai_parse_questions', { content });
  return strictValidate(AiParseResultSchema, raw, 'AI 解析题目');
};

export const chatWithAI = async (
  messages: AiMessage[],
  promptId?: number | null,
): Promise<AiChatResult> => {
  return invokeTauriCommand('ai_chat', { messages, promptId });
};

// ==================== Prompt API ====================

export const getAllPrompts = async (): Promise<Prompt[]> => invokeTauriCommand('prompt_get_all');

export const getPromptById = async (id: number): Promise<Prompt | null> =>
  invokeTauriCommand('prompt_get_by_id', { id });

export const createPrompt = async (data: { name: string; content: string }): Promise<Prompt> => {
  return invokeTauriCommand('prompt_create', { data });
};

export const updatePrompt = async (
  id: number,
  data: { name: string; content: string },
): Promise<Prompt | null> => {
  return invokeTauriCommand('prompt_update', { id, data });
};

export const deletePrompt = async (id: number): Promise<{ success: boolean }> =>
  invokeTauriCommand('prompt_delete', { id });

// ==================== 聊天历史 API ====================

export const saveChatHistory = async (data: {
  title?: string | null;
  messages: unknown;
  promptId?: number | null;
}): Promise<ChatHistory> => invokeTauriCommand('chat_history_save', { data });

export const updateChatHistory = async (
  id: number,
  messages: unknown,
): Promise<ChatHistory | null> => {
  return invokeTauriCommand('chat_history_update', { id, messages });
};

export const getAllChatHistory = async (limit = 50): Promise<ChatHistory[]> => {
  return invokeTauriCommand('chat_history_get_all', { limit });
};

export const getChatHistoryById = async (id: number): Promise<ChatHistory | null> => {
  return invokeTauriCommand('chat_history_get_by_id', { id });
};

export const deleteChatHistory = async (id: number): Promise<{ success: boolean }> => {
  return invokeTauriCommand('chat_history_delete', { id });
};

// ==================== 练习 API ====================

export const savePracticeRecord = async (
  record: PracticeRecordInput,
): Promise<{ success: boolean }> => {
  return invokeTauriCommand('practice_save_record', { record });
};

export const getPracticeRecords = async (bankId: number, limit = 20): Promise<PracticeRecord[]> => {
  return invokeTauriCommand('practice_get_records', { bankId, limit });
};

export const getAllPracticeStats = async (): Promise<PracticeStats[]> =>
  invokeTauriCommand('practice_get_all_stats');

// ==================== 错题本 API ====================

export const getWrongBookCountsByBank = async (): Promise<
  Array<{ bankId: number; count: number }>
> => {
  return invokeTauriCommand('wrong_book_get_counts_by_bank');
};

export const getWrongBookItems = async (
  bankId?: number | null,
  options: Pick<QueryOptions, 'page' | 'pageSize'> = {},
): Promise<PaginatedResult<WrongBookItem>> => {
  return invokeTauriCommand('wrong_book_get_items', {
    bankId,
    page: options.page,
    pageSize: options.pageSize,
  });
};

export const getRandomWrongBookQuestions = async (
  bankId?: number | null,
  limit = 20,
): Promise<Question[]> => {
  return invokeTauriCommand('wrong_book_get_random_questions', { bankId, limit });
};

export const updateWrongBookFromPractice = async (
  results: WrongBookPracticeResult[],
  threshold?: number,
): Promise<{ success: boolean }> => {
  return invokeTauriCommand('wrong_book_update_from_practice', { results, threshold });
};

export const removeWrongBookItem = async (questionId: number): Promise<{ success: boolean }> => {
  return invokeTauriCommand('wrong_book_remove_item', { questionId });
};

export const clearWrongBook = async (bankId?: number | null): Promise<{ success: boolean }> => {
  return invokeTauriCommand('wrong_book_clear', { bankId });
};

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
  toml: {
    selectFile: selectTomlFile,
    parseFile: parseTomlFile,
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
};
