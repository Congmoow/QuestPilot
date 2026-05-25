import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  createQuestionBank,
  deleteQuestionBank,
  getAllQuestionBanks,
  getQuestionBankById,
  updateQuestionBank,
  type CreateQuestionBankInput,
  type QuestionBank,
} from '../api';

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

const errorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

export function QuestionBankProvider({ children }: { children: ReactNode }) {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllQuestionBanks();
      setBanks(data || []);
    } catch (err) {
      setError(errorMessage(err, '获取题库列表失败'));
      setBanks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addBank = useCallback(async (data: CreateQuestionBankInput) => {
    setLoading(true);
    setError(null);
    try {
      const newBank = await createQuestionBank(data);
      setBanks((prev) => [...prev, newBank]);
      return newBank;
    } catch (err) {
      setError(errorMessage(err, '创建题库失败'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const editBank = useCallback(async (id: number, data: CreateQuestionBankInput) => {
    setLoading(true);
    setError(null);
    try {
      const updatedBank = await updateQuestionBank(id, data);
      if (updatedBank) {
        setBanks((prev) => prev.map((bank) => (bank.id === id ? updatedBank : bank)));
      }
      return updatedBank;
    } catch (err) {
      setError(errorMessage(err, '更新题库失败'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeBank = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await deleteQuestionBank(id);
      setBanks((prev) => prev.filter((bank) => bank.id !== id));
    } catch (err) {
      setError(errorMessage(err, '删除题库失败'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getBankById = useCallback(async (id: number) => {
    try {
      return await getQuestionBankById(id);
    } catch (err) {
      setError(errorMessage(err, '获取题库失败'));
      return null;
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

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
