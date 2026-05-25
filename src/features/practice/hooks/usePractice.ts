import { useEffect, useState } from 'react';
import api from '../../../api';
import type { WrongBookPracticeResult } from '../../../api';
import { countFillBlanks } from '../../../lib/fillBlank';
import { isFillAnswerCorrect, normalizeFillAnswer, shuffleArray, shuffleQuestionOptions } from '../../../lib/practiceHelpers';
import { useQuestionBanks } from '../../../contexts/QuestionBankContext';
import type { PracticeAnswerMap, PracticeAnswerValue, PracticeQuestion, PracticeResultView } from '../../../types/viewModels';

export const usePractice = () => {
  const { banks, fetchBanks: refreshBanks } = useQuestionBanks();

  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<PracticeAnswerMap>({});
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [practiceResult, setPracticeResult] = useState<PracticeResultView | null>(null);

  useEffect(() => {
    refreshBanks();
  }, []);

  const startPractice = async (bankId: number | null = selectedBankId) => {
    if (!bankId) return;
    setLoading(true);
    try {
      const data = await api.question.getRandom(bankId, { limit: 1000 });
      if (data.length === 0) { alert('该题库暂无题目'); return; }

      const shuffled = data.map((q) =>
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
      setSelectedBankId(bankId);
    } catch (error) {
      console.error('加载题目失败:', error);
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

  const submitAnswer = () => { setSubmitted(true); setShowResult(true); };

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
      total: questions.length, correct,
      wrong: questions.length - correct,
      accuracy, bankId: selectedBankId,
      timestamp: new Date().toISOString(),
    };
    setPracticeResult(result);

    try {
      if (result.bankId !== null) {
        await api.practice.saveRecord({
          bankId: result.bankId!, total: result.total,
          correct: result.correct, wrong: result.wrong, accuracy: result.accuracy,
        });
      }
    } catch (error) { console.error('保存练习记录失败:', error); }

    try {
      await api.wrongBook.updateFromPractice(perQuestionResults);
    } catch (error) { console.error('同步错题本失败:', error); }
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

  const canSubmit = (() => {
    if (!currentQuestion) return false;
    const v = userAnswers[currentQuestion.id];
    if (currentQuestion.type === 'multiple') return Array.isArray(v) && v.length > 0;
    if (currentQuestion.type === 'fill') {
      const bc = countFillBlanks(currentQuestion.content);
      if (bc <= 0) return false;
      return normalizeFillAnswer(v, bc).every((a) => a.trim() !== '');
    }
    return v != null && String(v).trim() !== '';
  })();

  return {
    banks, selectedBankId, setSelectedBankId,
    questions, currentIndex, currentQuestion,
    userAnswers, showResult, submitted, loading, practicing, practiceResult,
    canSubmit,
    startPractice, handleAnswer, handleFillAnswer, toggleMultipleAnswer,
    submitAnswer, nextQuestion, restart, isCorrect,
    normalizeFillAnswer,
  };
};

export type PracticeState = ReturnType<typeof usePractice>;
