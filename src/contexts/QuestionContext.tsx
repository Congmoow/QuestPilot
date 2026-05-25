import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import {
  createQuestion,
  deleteQuestions,
  getQuestionById,
  getQuestionsByBankId,
  searchQuestions,
  updateQuestion,
  type CreateQuestionInput,
  type PaginatedResult,
  type QueryOptions,
  type Question,
  type QuestionType,
} from '../api';

type QuestionContextValue = {
  questions: Question[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  currentBankId: number | null;
  searchKeyword: string;
  filterType: QuestionType | null;
  selectedIds: number[];
  fetchQuestions: (bankId: number, options?: QueryOptions) => Promise<void>;
  search: (bankId: number, keyword: string, options?: QueryOptions) => Promise<void>;
  addQuestion: (data: CreateQuestionInput) => Promise<Question>;
  editQuestion: (id: number, data: Partial<CreateQuestionInput>) => Promise<Question | null>;
  removeQuestions: (ids: number[]) => Promise<void>;
  getById: (id: number) => Promise<Question | null>;
  setPage: (page: number) => void;
  setSearchKeyword: (keyword: string) => void;
  setFilterType: (type: QuestionType | null) => void;
  setSelectedIds: (ids: number[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  reset: () => void;
};

const QuestionContext = createContext<QuestionContextValue | null>(null);

const DEFAULT_PAGE_SIZE = 10;

const errorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

const emptyPage = (): PaginatedResult<Question> => ({
  data: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalPages: 0,
});

export function QuestionProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentBankId, setCurrentBankId] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<QuestionType | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const applyResult = (result: PaginatedResult<Question>) => {
    setQuestions(result.data || []);
    setTotal(result.total || 0);
    setPage(result.page || 1);
    setTotalPages(result.totalPages || 0);
    setSelectedIds([]);
  };

  const fetchQuestions = useCallback(
    async (bankId: number, options: QueryOptions = {}) => {
      setLoading(true);
      setError(null);
      setCurrentBankId(bankId);

      const queryOptions: QueryOptions = {
        page: options.page || page,
        pageSize: options.pageSize || pageSize,
        type: options.type !== undefined ? options.type : filterType,
      };

      try {
        const result = searchKeyword
          ? await searchQuestions(bankId, searchKeyword, queryOptions)
          : await getQuestionsByBankId(bankId, queryOptions);
        applyResult(result);
      } catch (err) {
        setError(errorMessage(err, '获取题目列表失败'));
        applyResult(emptyPage());
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, filterType, searchKeyword],
  );

  const search = useCallback(
    async (bankId: number, keyword: string, options: QueryOptions = {}) => {
      setLoading(true);
      setError(null);
      setSearchKeyword(keyword);
      setCurrentBankId(bankId);

      const queryOptions: QueryOptions = {
        page: options.page || 1,
        pageSize: options.pageSize || pageSize,
        type: options.type !== undefined ? options.type : filterType,
      };

      try {
        const result = await searchQuestions(bankId, keyword, queryOptions);
        applyResult(result);
      } catch (err) {
        setError(errorMessage(err, '搜索题目失败'));
        applyResult(emptyPage());
      } finally {
        setLoading(false);
      }
    },
    [pageSize, filterType],
  );

  const addQuestion = useCallback(
    async (data: CreateQuestionInput) => {
      setLoading(true);
      setError(null);
      try {
        const newQuestion = await createQuestion(data);
        if (currentBankId) {
          await fetchQuestions(currentBankId);
        }
        return newQuestion;
      } catch (err) {
        setError(errorMessage(err, '创建题目失败'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [currentBankId, fetchQuestions],
  );

  const editQuestion = useCallback(async (id: number, data: Partial<CreateQuestionInput>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedQuestion = await updateQuestion(id, data);
      if (updatedQuestion) {
        setQuestions((prev) => prev.map((q) => (q.id === id ? updatedQuestion : q)));
      }
      return updatedQuestion;
    } catch (err) {
      setError(errorMessage(err, '更新题目失败'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeQuestions = useCallback(
    async (ids: number[]) => {
      setLoading(true);
      setError(null);
      try {
        await deleteQuestions(ids);
        setQuestions((prev) => prev.filter((q) => !ids.includes(q.id)));
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
        setTotal((prev) => prev - ids.length);
        if (questions.length === ids.length && page > 1) {
          setPage(page - 1);
        }
      } catch (err) {
        setError(errorMessage(err, '删除题目失败'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [questions.length, page],
  );

  const getById = useCallback(async (id: number) => {
    try {
      return await getQuestionById(id);
    } catch (err) {
      setError(errorMessage(err, '获取题目失败'));
      return null;
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(questions.map((q) => q.id));
  }, [questions]);

  const reset = useCallback(() => {
    setQuestions([]);
    setTotal(0);
    setPage(1);
    setTotalPages(0);
    setCurrentBankId(null);
    setSearchKeyword('');
    setFilterType(null);
    setSelectedIds([]);
    setError(null);
  }, []);

  const value: QuestionContextValue = {
    questions,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    currentBankId,
    searchKeyword,
    filterType,
    selectedIds,
    fetchQuestions,
    search,
    addQuestion,
    editQuestion,
    removeQuestions,
    getById,
    setPage,
    setSearchKeyword,
    setFilterType,
    setSelectedIds,
    clearSelection,
    selectAll,
    reset,
  };

  return <QuestionContext.Provider value={value}>{children}</QuestionContext.Provider>;
}

export function useQuestions() {
  const context = useContext(QuestionContext);
  if (!context) {
    throw new Error('useQuestions 必须在 QuestionProvider 内部使用');
  }
  return context;
}

export default QuestionContext;
