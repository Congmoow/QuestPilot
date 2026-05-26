import type { QuestionType } from './types';

export const queryKeys = {
  questionBanks: {
    all: () => ['questionBanks'] as const,
    byId: (id: number) => ['questionBanks', id] as const,
  },
  questions: {
    list: (bankId: number, page: number, pageSize: number, filterType: QuestionType | null) =>
      ['questions', bankId, 'list', page, pageSize, filterType] as const,
    search: (
      bankId: number,
      keyword: string,
      page: number,
      pageSize: number,
      filterType: QuestionType | null,
    ) => ['questions', bankId, 'search', keyword, page, pageSize, filterType] as const,
  },
  dashboard: {
    stats: () => ['dashboard', 'stats'] as const,
    operationLogs: (limit: number) => ['dashboard', 'operationLogs', limit] as const,
    typeDistribution: (bankId: number | null) => ['dashboard', 'typeDistribution', bankId] as const,
    practiceStats: () => ['dashboard', 'practiceStats'] as const,
    practiceRecords: (bankId: number | null) => ['dashboard', 'practiceRecords', bankId] as const,
  },
  wrongBook: {
    items: (bankId: number | null, page: number, pageSize: number) =>
      ['wrongBook', 'items', bankId, page, pageSize] as const,
    counts: () => ['wrongBook', 'counts'] as const,
  },
  prompts: {
    all: () => ['prompts'] as const,
  },
  chatHistory: {
    all: (limit?: number) => ['chatHistory', limit] as const,
  },
} as const;
