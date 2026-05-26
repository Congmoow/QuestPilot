import type { Page } from '@playwright/test';

/**
 * 默认 Tauri command 返回值 —— 覆盖应用启动所需的全部命令。
 * 每个测试可通过 overrides 参数覆盖特定命令的返回。
 */
const DEFAULT_HANDLERS: Record<string, unknown> = {
  question_bank_get_all: [],
  question_get_by_bank_id: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
  stats_get_dashboard: {
    totalQuestions: 0,
    todayQuestions: 0,
    weekQuestions: 0,
    typeDistribution: [],
  },
  stats_get_operation_logs: [],
  stats_get_type_distribution: [],
  practice_get_all_stats: [],
  settings_get_api_config: {
    apiKey: '',
    apiKeyPreview: '',
    hasApiKey: false,
    apiUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o',
    provider: 'openai',
  },
  settings_get_theme: 'system',
  settings_get_wrong_book_threshold: 3,
  prompt_get_all: [],
  chat_history_get_all: [],
  draft_load: null,
  window_is_maximized: false,
  wrong_book_get_counts_by_bank: [],
  wrong_book_get_items: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
};

/**
 * 向页面注入 Tauri IPC mock，拦截所有 invoke 调用。
 * Tauri v2 在 webview 中注入 window.__TAURI_INTERNALS__；
 * 在普通浏览器（vite preview）中不存在，需要手动注入。
 */
export async function injectTauriMock(
  page: Page,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const handlers = { ...DEFAULT_HANDLERS, ...overrides };

  await page.addInitScript((mockHandlers: Record<string, unknown>) => {
    // Tauri v2 invoke 通过 window.__TAURI_INTERNALS__.invoke 调度
    // 此 mock 使 invoke 直接从本地 Map 返回数据，不经过 IPC
    (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {
      invoke: (cmd: string) => Promise.resolve(mockHandlers[cmd] ?? null),
      metadata: {},
    };
  }, handlers);
}
