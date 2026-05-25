import { useEffect, useMemo, useState } from 'react';
import api from '../../../api';
import type { WrongBookItem, WrongBookPracticeResult } from '../../../api';
import { countFillBlanks } from '../../../lib/fillBlank';
import { useQuestionBanks } from '../../../contexts/QuestionBankContext';
import type { PracticeAnswerMap, PracticeAnswerValue, PracticeQuestion, PracticeResultView } from '../../../types/viewModels';
import { isFillAnswerCorrect, normalizeFillAnswer, shuffleArray, shuffleQuestionOptions } from '../utils/practiceHelpers';

export const useWrongBook = () => {
  const { banks, fetchBanks: refreshBanks } = useQuestionBanks();

  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [practiceCount, setPracticeCount] = useState(20);

  const [items, setItems] = useState<WrongBookItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [practicing, setPracticing] = useState(false);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<PracticeAnswerMap>({});
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [practiceResult, setPracticeResult] = useState<PracticeResultView | null>(null);

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    refreshBanks();
  }, []);

  const loadItems = async (bankId: number | null, targetPage = 1) => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.wrongBook.getItems(bankId, { page: targetPage, pageSize });
      setItems(result.data || []);
      setTotal(result.total || 0);
      setPage(result.page || 1);
      setTotalPages(result.totalPages || 0);
    } catch (error) {
      console.error('加载错题本失败:', error);
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setLoadError(error instanceof Error ? error.message : '加载错题本失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(selectedBankId, 1);
  }, [selectedBankId]);

  const currentBankName = useMemo(() => {
    if (!selectedBankId) return '全部题库';
    return banks.find((b) => b.id === selectedBankId)?.name || `题库 ${selectedBankId}`;
  }, [banks, selectedBankId]);

  const currentQuestion = questions[currentIndex] ?? null;

  const isCorrect = (question: PracticeQuestion): boolean => {
    const userAnswer = userAnswers[question.id];
    if (question.type === 'multiple') {
      const correctArr = question.answer.split('|').sort();
      const userArr = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
      return JSON.stringify(correctArr) === JSON.stringify(userArr);
    }
    if (question.type === 'fill') return isFillAnswerCorrect(question, userAnswer);
    return userAnswer === question.answer;
  };

  const startPractice = async () => {
    setLoading(true);
    try {
      const count = Number(practiceCount) > 0 ? Number(practiceCount) : 20;
      const result = await api.wrongBook.getRandomQuestions(selectedBankId, count);
      if (!result || result.length === 0) { alert('错题本暂无题目'); return; }

      const shuffled = shuffleArray(result).map((q) =>
        (q.type === 'single' || q.type === 'multiple') && q.options
          ? shuffleQuestionOptions(q)
          : q
      );

      setQuestions(shuffled);
      setCurrentIndex(0);
      setUserAnswers({});
      setShowResult(false);
      setSubmitted(false);
      setPracticing(true);
      setPracticeResult(null);
    } catch (error) {
      console.error('加载错题练习失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: number, answer: string) => {
    if (submitted) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleFillAnswer = (questionId: number, blankCount: number, index: number, value: string) => {
    if (submitted) return;
    setUserAnswers((prev) => {
      const current = normalizeFillAnswer(prev[questionId], blankCount);
      current[index] = value;
      return { ...prev, [questionId]: current };
    });
  };

  const toggleMultipleAnswer = (questionId: number, option: string) => {
    if (submitted) return;
    const current: PracticeAnswerValue = Array.isArray(userAnswers[questionId]) ? userAnswers[questionId] : [];
    const newAnswer = (current as string[]).includes(option)
      ? (current as string[]).filter((o) => o !== option)
      : [...(current as string[]), option].sort();
    setUserAnswers((prev) => ({ ...prev, [questionId]: newAnswer }));
  };

  const submitAnswer = () => {
    setSubmitted(true);
    setShowResult(true);
  };

  const finishPractice = async () => {
    let correct = 0;
    const perQuestionResults: WrongBookPracticeResult[] = [];

    questions.forEach((q) => {
      const userAnswer = userAnswers[q.id];
      if (q.type === 'multiple') {
        const correctArr = q.answer.split('|').sort();
        const userArr = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
        const ok = JSON.stringify(correctArr) === JSON.stringify(userArr);
        if (ok) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: ok });
      } else if (q.type === 'fill') {
        const ok = isFillAnswerCorrect(q, userAnswer);
        if (ok) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: ok });
      } else {
        const ok = userAnswer === q.answer;
        if (ok) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: ok });
      }
    });

    const accuracy = Math.round((correct / questions.length) * 100);
    const result: PracticeResultView = {
      total: questions.length,
      correct,
      wrong: questions.length - correct,
      accuracy,
      bankId: selectedBankId,
      timestamp: new Date().toISOString(),
    };

    setPracticeResult(result);

    if (selectedBankId) {
      try {
        await api.practice.saveRecord({
          bankId: selectedBankId,
          total: result.total,
          correct: result.correct,
          wrong: result.wrong,
          accuracy: result.accuracy,
        });
      } catch (error) {
        console.error('保存练习记录失败:', error);
      }
    }

    try {
      await api.wrongBook.updateFromPractice(perQuestionResults);
    } catch (error) {
      console.error('同步错题本失败:', error);
    }

    await loadItems(selectedBankId, 1);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSubmitted(false);
      setShowResult(false);
    } else {
      finishPractice();
    }
  };

  const restart = () => {
    setPracticing(false);
    setPracticeResult(null);
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswers({});
  };

  const handleRemoveItem = async (questionId: number) => {
    setRemovingId(questionId);
    try {
      await api.wrongBook.removeItem(questionId);
      await loadItems(selectedBankId, page);
    } catch (error) {
      console.error('移除错题失败:', error);
    } finally {
      setRemovingId(null);
    }
  };

  const handleClear = async () => {
    try {
      await api.wrongBook.clear(selectedBankId);
      await loadItems(selectedBankId, 1);
    } catch (error) {
      console.error('清空错题本失败:', error);
    }
  };

  const canSubmit = (() => {
    if (!currentQuestion) return false;
    const v = userAnswers[currentQuestion.id];
    if (currentQuestion.type === 'multiple') return (Array.isArray(v) ? v : []).length > 0;
    if (currentQuestion.type === 'fill') {
      const blankCount = countFillBlanks(currentQuestion.content);
      if (blankCount <= 0) return false;
      return normalizeFillAnswer(v, blankCount).every((a) => a.trim() !== '');
    }
    return v != null && String(v).trim() !== '';
  })();

  return {
    banks,
    selectedBankId, setSelectedBankId,
    practiceCount, setPracticeCount,
    items, total, page, setPage, totalPages, loading, loadError,
    practicing,
    questions, currentIndex, currentQuestion,
    userAnswers, showResult, submitted, practiceResult,
    clearDialogOpen, setClearDialogOpen,
    removingId,
    currentBankName,
    canSubmit,
    loadItems,
    startPractice,
    handleAnswer, handleFillAnswer, toggleMultipleAnswer,
    submitAnswer, nextQuestion, finishPractice, restart,
    handleRemoveItem, handleClear,
    isCorrect,
    normalizeFillAnswer,
  };
};

export type WrongBookState = ReturnType<typeof useWrongBook>;
