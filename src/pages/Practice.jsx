import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle,
  ChevronRight,
  Code2,
  FileQuestion,
  Image,
  Loader2,
  Play,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import api from '../api';
import CodeAwareText from '../components/CodeAwareText';
import { countFillBlanks } from '../lib/fillBlank';
import {
  ActionButton,
  AlertBanner,
  AnswerOptionCard,
  EmptyState,
  PageHeader,
  PracticeCard,
  QuizShell,
  ResultSummary,
  SurfaceCard,
  TextareaInput,
  TextInput,
  TypeBadge,
} from '../components/ui';

const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题',
};

const bankIcons = [Image, Code2, FileQuestion, BrainCircuit];

const Practice = () => {
  const navigate = useNavigate();
  const { banks, fetchBanks: refreshBanks } = useQuestionBanks();

  const [selectedBankId, setSelectedBankId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [practiceResult, setPracticeResult] = useState(null);

  useEffect(() => {
    refreshBanks();
  }, []);

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const shuffleQuestionOptions = (question) => {
    const originalOptions = Array.isArray(question.options) ? question.options : [];
    const shuffledOptions = shuffleArray(originalOptions);

    const idMap = new Map();
    const remappedOptions = shuffledOptions.map((opt, index) => {
      const newId = String.fromCharCode(65 + index);
      if (opt && opt.id != null) idMap.set(String(opt.id), newId);
      return { ...opt, id: newId };
    });

    let remappedAnswer = question.answer;
    if (typeof question.answer === 'string' && question.answer.length > 0) {
      if (question.type === 'multiple') {
        remappedAnswer = question.answer
          .split('|')
          .map(a => idMap.get(a) || a)
          .sort()
          .join('|');
      } else if (question.type === 'single') {
        remappedAnswer = idMap.get(question.answer) || question.answer;
      }
    }

    return { ...question, options: remappedOptions, answer: remappedAnswer };
  };

  const normalizeFillAnswer = (value, blankCount) => {
    const n = Math.max(0, Number(blankCount) || 0);
    const arr = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? value.split('|') : []);

    const normalized = arr.map((v) => String(v ?? ''));
    while (normalized.length < n) normalized.push('');
    if (normalized.length > n) normalized.length = n;
    return normalized;
  };

  const isFillAnswerCorrect = (question, userValue) => {
    const blankCount = countFillBlanks(question?.content);
    const correctArr = normalizeFillAnswer(question?.answer, blankCount).map((a) => a.trim());
    const userArr = normalizeFillAnswer(userValue, blankCount).map((a) => a.trim());
    if (blankCount <= 0) return false;
    for (let i = 0; i < blankCount; i++) {
      if (correctArr[i] !== userArr[i]) return false;
    }
    return true;
  };

  const startPractice = async (bankId = selectedBankId) => {
    if (!bankId) return;

    setLoading(true);
    try {
      const result = await api.question.getByBankId(bankId, { page: 1, pageSize: 1000 });

      if (result.data.length === 0) {
        alert('该题库暂无题目');
        return;
      }

      const shuffled = shuffleArray(result.data).map(q => {
        if ((q.type === 'single' || q.type === 'multiple') && q.options) {
          return shuffleQuestionOptions(q);
        }
        return q;
      });
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

  const handleAnswer = (questionId, answer) => {
    if (submitted) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleFillAnswer = (questionId, blankCount, index, value) => {
    if (submitted) return;
    setUserAnswers((prev) => {
      const current = normalizeFillAnswer(prev[questionId], blankCount);
      current[index] = value;
      return { ...prev, [questionId]: current };
    });
  };

  const toggleMultipleAnswer = (questionId, option) => {
    if (submitted) return;
    const current = userAnswers[questionId] || [];
    const newAnswer = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option].sort();
    setUserAnswers(prev => ({ ...prev, [questionId]: newAnswer }));
  };

  const submitAnswer = () => {
    setSubmitted(true);
    setShowResult(true);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSubmitted(false);
      setShowResult(false);
    } else {
      finishPractice();
    }
  };

  const finishPractice = async () => {
    let correct = 0;
    const perQuestionResults = [];
    questions.forEach(q => {
      const userAnswer = userAnswers[q.id];
      if (q.type === 'multiple') {
        const correctArr = q.answer.split('|').sort();
        const userArr = (userAnswer || []).sort();
        if (JSON.stringify(correctArr) === JSON.stringify(userArr)) {
          correct++;
          perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: true });
        } else {
          perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: false });
        }
      } else if (q.type === 'fill') {
        const ok = isFillAnswerCorrect(q, userAnswer);
        if (ok) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: ok });
      } else {
        if (userAnswer === q.answer) {
          correct++;
          perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: true });
        } else {
          perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: false });
        }
      }
    });

    const accuracy = Math.round((correct / questions.length) * 100);
    const result = {
      total: questions.length,
      correct,
      wrong: questions.length - correct,
      accuracy,
      bankId: selectedBankId,
      timestamp: new Date().toISOString(),
    };

    setPracticeResult(result);

    try {
      await api.practice.saveRecord(result);
    } catch (error) {
      console.error('保存练习记录失败:', error);
    }

    try {
      await api.wrongBook.updateFromPractice(perQuestionResults);
    } catch (error) {
      console.error('同步错题本失败:', error);
    }
  };

  const restart = () => {
    setPracticing(false);
    setPracticeResult(null);
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswers({});
  };

  const currentQuestion = questions[currentIndex];

  const isCorrect = (question) => {
    const userAnswer = userAnswers[question.id];
    if (question.type === 'multiple') {
      const correctArr = question.answer.split('|').sort();
      const userArr = (userAnswer || []).sort();
      return JSON.stringify(correctArr) === JSON.stringify(userArr);
    }
    if (question.type === 'fill') {
      return isFillAnswerCorrect(question, userAnswer);
    }
    return userAnswer === question.answer;
  };

  if (practiceResult) {
    return (
      <ResultSummary
        title="练习完成！"
        subtitle={banks.find(b => b.id === selectedBankId)?.name}
        icon={Trophy}
        score={practiceResult.accuracy}
        stats={[
          { label: '总题数', value: practiceResult.total, className: 'bg-blue-50 text-gray-900' },
          { label: '正确', value: practiceResult.correct, className: 'bg-green-50 text-green-700' },
          { label: '错误', value: practiceResult.wrong, className: 'bg-red-50 text-red-700' },
        ]}
        actions={(
          <>
            <ActionButton variant="secondary" icon={RotateCcw} onClick={restart}>
              重新选择
            </ActionButton>
            <ActionButton icon={Play} onClick={startPractice}>
              再练一次
            </ActionButton>
          </>
        )}
      />
    );
  }

  if (practicing && currentQuestion) {
    const blankCount = currentQuestion.type === 'fill' ? countFillBlanks(currentQuestion.content) : 0;
    const fillValues = currentQuestion.type === 'fill'
      ? normalizeFillAnswer(userAnswers[currentQuestion.id], blankCount)
      : [];
    const fillCorrectValues = currentQuestion.type === 'fill'
      ? normalizeFillAnswer(currentQuestion.answer, blankCount)
      : [];

    const canSubmit = (() => {
      const v = userAnswers[currentQuestion.id];
      if (currentQuestion.type === 'multiple') return (v || []).length > 0;
      if (currentQuestion.type === 'fill') {
        if (blankCount <= 0) return false;
        return normalizeFillAnswer(v, blankCount).every((a) => a.trim() !== '');
      }
      return v != null && String(v).trim() !== '';
    })();

    return (
      <QuizShell
        current={currentIndex + 1}
        total={questions.length}
        actions={!submitted ? (
          <ActionButton onClick={submitAnswer} disabled={!canSubmit}>
            确认答案
          </ActionButton>
        ) : (
          <ActionButton icon={ChevronRight} onClick={nextQuestion}>
            {currentIndex < questions.length - 1 ? '下一题' : '查看结果'}
          </ActionButton>
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="space-y-6"
          >
            <TypeBadge type={currentQuestion.type} label={TYPE_LABELS[currentQuestion.type]} />

            <div className="text-lg font-semibold leading-8 text-gray-900 dark:text-white">
              <CodeAwareText text={currentQuestion.content} />
            </div>

            {(currentQuestion.type === 'single' || currentQuestion.type === 'multiple') && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const optionLabel = String.fromCharCode(65 + index);
                  const isSelected = currentQuestion.type === 'multiple'
                    ? (userAnswers[currentQuestion.id] || []).includes(option.id)
                    : userAnswers[currentQuestion.id] === option.id;
                  const isCorrectOption = currentQuestion.type === 'multiple'
                    ? currentQuestion.answer.split('|').includes(option.id)
                    : currentQuestion.answer === option.id;

                  let state = isSelected ? 'selected' : 'default';
                  if (showResult) {
                    if (isCorrectOption) state = 'correct';
                    else if (isSelected && !isCorrectOption) state = 'wrong';
                  }

                  return (
                    <AnswerOptionCard
                      key={option.id}
                      state={state}
                      onClick={() => currentQuestion.type === 'multiple'
                        ? toggleMultipleAnswer(currentQuestion.id, option.id)
                        : handleAnswer(currentQuestion.id, option.id)
                      }
                      disabled={submitted}
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold shadow-sm dark:bg-gray-800">
                          {optionLabel}
                        </span>
                        <CodeAwareText text={option.text} className="min-w-0 flex-1 bg-transparent p-0 text-gray-900 dark:text-white" />
                        {showResult && isCorrectOption && <CheckCircle className="shrink-0 text-green-500" size={20} />}
                        {showResult && isSelected && !isCorrectOption && <XCircle className="shrink-0 text-red-500" size={20} />}
                      </div>
                    </AnswerOptionCard>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'boolean' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {['正确', '错误'].map((option) => {
                  const isSelected = userAnswers[currentQuestion.id] === option;
                  const isCorrectOption = currentQuestion.answer === option;

                  let state = isSelected ? 'selected' : 'default';
                  if (showResult) {
                    if (isCorrectOption) state = 'correct';
                    else if (isSelected && !isCorrectOption) state = 'wrong';
                  }

                  return (
                    <AnswerOptionCard
                      key={option}
                      state={state}
                      onClick={() => handleAnswer(currentQuestion.id, option)}
                      disabled={submitted}
                    >
                      <span className="font-semibold">{option}</span>
                    </AnswerOptionCard>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'fill' && (
              <div className="space-y-3">
                {blankCount > 0 && Array.from({ length: blankCount }).map((_, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[84px_minmax(0,1fr)] sm:items-center">
                    <span className="text-sm font-semibold text-gray-500">第 {index + 1} 空</span>
                    <TextInput
                      value={fillValues[index] || ''}
                      onChange={(e) => handleFillAnswer(currentQuestion.id, blankCount, index, e.target.value)}
                      disabled={submitted}
                      placeholder="请输入答案..."
                    />
                  </div>
                ))}
                {showResult && (
                  <AlertBanner type="success" title="参考答案">
                    {fillCorrectValues.map((a, i) => (
                      <p key={i}>第 {i + 1} 空：{a}</p>
                    ))}
                  </AlertBanner>
                )}
              </div>
            )}

            {currentQuestion.type === 'short' && (
              <div className="space-y-3">
                <TextareaInput
                  value={userAnswers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  disabled={submitted}
                  placeholder="请输入答案..."
                  rows={5}
                />
                {showResult && (
                  <AlertBanner type="success">
                    <span className="font-semibold">参考答案：</span>{currentQuestion.answer}
                  </AlertBanner>
                )}
              </div>
            )}

            {showResult && currentQuestion.analysis && (
              <AlertBanner type="info" title="解析">
                <CodeAwareText text={currentQuestion.analysis} className="bg-transparent p-0" />
              </AlertBanner>
            )}

            {showResult && (
              <div className="flex items-center gap-2">
                {isCorrect(currentQuestion)
                  ? <CheckCircle className="text-green-500" size={18} />
                  : <XCircle className="text-red-500" size={18} />}
                <span className={cn('text-sm font-semibold', isCorrect(currentQuestion) ? 'text-green-600' : 'text-red-600')}>
                  {isCorrect(currentQuestion) ? '回答正确' : '回答错误'}
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </QuizShell>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="随机练题" subtitle="选择题库开始随机练习" />

      {banks.length === 0 ? (
        <SurfaceCard padding="p-8">
          <EmptyState
            icon={AlertCircle}
            title="暂无题库"
            description="请先创建题库并添加题目，然后回来开始随机练习。"
            action={(
              <ActionButton onClick={() => navigate('/question-preview')}>
                前往题库管理
              </ActionButton>
            )}
          />
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank, index) => (
            <motion.div
              key={bank.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <PracticeCard
                bank={bank}
                icon={bankIcons[index % bankIcons.length]}
                index={index}
                selected={selectedBankId === bank.id}
                onSelect={() => setSelectedBankId(bank.id)}
                onStart={(e) => {
                  e.stopPropagation();
                  setSelectedBankId(bank.id);
                  startPractice(bank.id);
                }}
              />
            </motion.div>
          ))}
        </div>
      )}

      {selectedBankId && (
        <div className="flex justify-center">
          <ActionButton icon={loading ? Loader2 : Play} onClick={startPractice} disabled={loading} loading={loading} size="lg">
            {loading ? '加载中...' : '开始练习'}
          </ActionButton>
        </div>
      )}
    </div>
  );
};

export default Practice;
