import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { queryKeys } from '../api/queryKeys';

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

const emptyPage = (): PaginatedResult<Question> => ({
  data: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalPages: 0,
});

export function QuestionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const [currentBankId, setCurrentBankId] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filterType, setFilterType] = useState<QuestionType | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const queryKey =
    searchKeyword && currentBankId
      ? queryKeys.questions.search(currentBankId, searchKeyword, page, pageSize, filterType)
      : queryKeys.questions.list(currentBankId ?? 0, page, pageSize, filterType);

  const {
    data = emptyPage(),
    isFetching: loading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => {
      if (!currentBankId) return Promise.resolve(emptyPage());
      return searchKeyword
        ? searchQuestions(currentBankId, searchKeyword, { page, pageSize, type: filterType })
        : getQuestionsByBankId(currentBankId, { page, pageSize, type: filterType });
    },
    enabled: currentBankId !== null,
  });

  const questions = data.data;
  const total = data.total;
  const totalPages = data.totalPages;
  const error = queryError instanceof Error ? queryError.message : null;

  const invalidateQuestions = useCallback(() => {
    if (currentBankId !== null) {
      qc.invalidateQueries({ queryKey: ['questions', currentBankId] });
    }
  }, [qc, currentBankId]);

  const { mutateAsync: createMutation } = useMutation({
    mutationFn: createQuestion,
    onSuccess: invalidateQuestions,
  });

  const { mutateAsync: updateMutation } = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateQuestionInput> }) =>
      updateQuestion(id, data),
    onSuccess: invalidateQuestions,
  });

  const { mutateAsync: deleteMutation } = useMutation({
    mutationFn: deleteQuestions,
    onSuccess: invalidateQuestions,
  });

  const fetchQuestions = useCallback(async (bankId: number, options: QueryOptions = {}) => {
    setCurrentBankId(bankId);
    if (options.page !== undefined) setPage(options.page);
    if (options.type !== undefined) setFilterType(options.type ?? null);
  }, []);

  const search = useCallback(
    async (bankId: number, keyword: string, options: QueryOptions = {}) => {
      setCurrentBankId(bankId);
      setSearchKeyword(keyword);
      setPage(options.page ?? 1);
      if (options.type !== undefined) setFilterType(options.type ?? null);
    },
    [],
  );

  const addQuestion = useCallback(
    (data: CreateQuestionInput) => createMutation(data),
    [createMutation],
  );

  const editQuestion = useCallback(
    (id: number, data: Partial<CreateQuestionInput>) => updateMutation({ id, data }),
    [updateMutation],
  );

  const removeQuestions = useCallback(
    async (ids: number[]) => {
      await deleteMutation(ids);
      if (questions.length === ids.length && page > 1) {
        setPage((prev) => prev - 1);
      }
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    },
    [deleteMutation, questions.length, page],
  );

  const getById = useCallback(async (id: number) => {
    try {
      return await getQuestionById(id);
    } catch {
      return null;
    }
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const selectAll = useCallback(() => setSelectedIds(questions.map((q) => q.id)), [questions]);

  const reset = useCallback(() => {
    setCurrentBankId(null);
    setSearchKeyword('');
    setPage(1);
    setFilterType(null);
    setSelectedIds([]);
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
