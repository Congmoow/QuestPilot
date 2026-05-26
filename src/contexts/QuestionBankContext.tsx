import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createQuestionBank,
  deleteQuestionBank,
  getAllQuestionBanks,
  getQuestionBankById,
  updateQuestionBank,
  type CreateQuestionBankInput,
  type QuestionBank,
} from '../api';
import { queryKeys } from '../api/queryKeys';

type QuestionBankContextValue = {
  banks: QuestionBank[];
  loading: boolean;
  error: string | null;
  fetchBanks: () => Promise<void>;
  addBank: (data: CreateQuestionBankInput) => Promise<QuestionBank>;
  editBank: (id: number, data: CreateQuestionBankInput) => Promise<QuestionBank | null>;
  removeBank: (id: number) => Promise<void>;
  getBankById: (id: number) => Promise<QuestionBank | null>;
};

const QuestionBankContext = createContext<QuestionBankContextValue | null>(null);

export function QuestionBankProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const {
    data: banks = [],
    isFetching: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.questionBanks.all(),
    queryFn: getAllQuestionBanks,
  });

  const error = queryError instanceof Error ? queryError.message : null;

  const fetchBanks = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.questionBanks.all() });
  }, [qc]);

  const { mutateAsync: createMutation } = useMutation({
    mutationFn: createQuestionBank,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.questionBanks.all() }),
  });

  const { mutateAsync: updateMutation } = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateQuestionBankInput }) =>
      updateQuestionBank(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.questionBanks.all() }),
  });

  const { mutateAsync: deleteMutation } = useMutation({
    mutationFn: deleteQuestionBank,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.questionBanks.all() }),
  });

  const addBank = useCallback(
    (data: CreateQuestionBankInput) => createMutation(data),
    [createMutation],
  );

  const editBank = useCallback(
    (id: number, data: CreateQuestionBankInput) => updateMutation({ id, data }),
    [updateMutation],
  );

  const removeBank = useCallback((id: number) => deleteMutation(id), [deleteMutation]);

  const getBankById = useCallback(async (id: number) => {
    try {
      return await getQuestionBankById(id);
    } catch {
      return null;
    }
  }, []);

  const value: QuestionBankContextValue = {
    banks,
    loading,
    error,
    fetchBanks,
    addBank,
    editBank,
    removeBank,
    getBankById,
  };

  return <QuestionBankContext.Provider value={value}>{children}</QuestionBankContext.Provider>;
}

export function useQuestionBanks() {
  const context = useContext(QuestionBankContext);
  if (!context) {
    throw new Error('useQuestionBanks 必须在 QuestionBankProvider 内部使用');
  }
  return context;
}

export default QuestionBankContext;
