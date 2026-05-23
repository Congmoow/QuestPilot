import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import CodeAwareText from '../components/CodeAwareText';
import { getPublicAssetPath } from '../lib/assets';
import { countFillBlanks } from '../lib/fillBlank';
import {
  ActionButton,
  AlertBanner,
  AnswerOptionCard,
  EmptyState,
  Field,
  IconButton,
  PageHeader,
  Pagination,
  QuizShell,
  ResultSummary,
  SelectInput,
  SurfaceCard,
  TextareaInput,
  TextInput,
  ToolbarCard,
  TypeBadge,
} from '../components/ui';

const CuotiIcon = ({ size = 44, ...props }) => (
  <img src={getPublicAssetPath('/cuoti-icon.png')} alt="错题本" width={size} height={size} {...props} />
);

const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题',
};

const WrongBook = () => {
  const { banks, fetchBanks: refreshBanks } = useQuestionBanks();

  const [selectedBankId, setSelectedBankId] = useState(null);
  const [practiceCount, setPracticeCount] = useState(20);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [practicing, setPracticing] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [practiceResult, setPracticeResult] = useState(null);

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState(null);

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

  const loadItems = async (bankId, targetPage = 1) => {
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
      setLoadError(error.message || '加载错题本失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(selectedBankId, 1);
  }, [selectedBankId]);

  const currentBankName = useMemo(() => {
    if (!selectedBankId) return '全部题库';
    return banks.find(b => b.id === selectedBankId)?.name || `题库 ${selectedBankId}`;
  }, [banks, selectedBankId]);

  const startPractice = async () => {
    setLoading(true);
    try {
      const count = Number(practiceCount) > 0 ? Number(practiceCount) : 20;
      const result = await api.wrongBook.getRandomQuestions(selectedBankId, count);

      if (!result || result.length === 0) {
        alert('错题本暂无题目');
        return;
      }

      const shuffled = shuffleArray(result).map(q => {
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
    } catch (error) {
      console.error('加载错题练习失败:', error);
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
        const isCorrectAnswer = JSON.stringify(correctArr) === JSON.stringify(userArr);
        if (isCorrectAnswer) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: isCorrectAnswer });
      } else if (q.type === 'fill') {
        const ok = isFillAnswerCorrect(q, userAnswer);
        if (ok) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: ok });
      } else {
        const isCorrectAnswer = userAnswer === q.answer;
        if (isCorrectAnswer) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: isCorrectAnswer });
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

    if (selectedBankId) {
      try {
        await api.practice.saveRecord(result);
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

  const handleRemoveItem = async (questionId) => {
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

  if (practiceResult) {
    return (
      <ResultSummary
        title="练习完成！"
        subtitle={currentBankName}
        icon={BookOpen}
        score={practiceResult.accuracy}
        stats={[
          { label: '总题数', value: practiceResult.total, className: 'bg-blue-50 text-gray-900' },
          { label: '正确', value: practiceResult.correct, className: 'bg-green-50 text-green-700' },
          { label: '错误', value: practiceResult.wrong, className: 'bg-red-50 text-red-700' },
        ]}
        actions={(
          <>
            <ActionButton variant="secondary" icon={RotateCcw} onClick={restart}>
              返回错题本
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
                <span className={isCorrect(currentQuestion) ? 'text-sm font-semibold text-green-600' : 'text-sm font-semibold text-red-600'}>
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
      <PageHeader
        title="错题本"
        subtitle="记录每次练习做错的题目，并支持随机练错题"
      />

      <ToolbarCard>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
          <Field label="题库筛选">
            <SelectInput
              value={selectedBankId || ''}
              onChange={(e) => setSelectedBankId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">全部题库</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </SelectInput>
          </Field>

          <Field label="练习题数">
            <TextInput
              type="number"
              min={1}
              max={200}
              value={practiceCount}
              onChange={(e) => setPracticeCount(e.target.value)}
            />
          </Field>

          <div className="flex flex-wrap gap-3">
            <ActionButton icon={Play} onClick={startPractice} disabled={loading} loading={loading}>
              随机练错题
            </ActionButton>
            <ActionButton
              variant="secondary"
              icon={Trash2}
              onClick={() => setClearDialogOpen(true)}
              disabled={loading || total === 0}
            >
              清空
            </ActionButton>
          </div>
        </div>

        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          当前筛选：<span className="text-primary">{currentBankName}</span>，共 <span className="text-primary">{total}</span> 道错题
        </div>
      </ToolbarCard>

      {loadError && <AlertBanner type="danger">{loadError}</AlertBanner>}

      {loading && items.length === 0 ? (
        <SurfaceCard className="flex min-h-[260px] items-center justify-center gap-3 text-gray-500">
          <Loader2 className="size-7 animate-spin text-primary" />
          <span className="font-semibold">错题加载中...</span>
        </SurfaceCard>
      ) : total === 0 ? (
        <SurfaceCard padding="p-8">
          <EmptyState
            icon={CuotiIcon}
            title="错题本暂无题目"
            description="继续练习，系统会自动收集你的错题，帮助你针对性提升哦～"
            className="min-h-[360px]"
            bareIcon
          />
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.article
                  key={item.questionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="ui-card p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <TypeBadge type={item.question?.type} label={TYPE_LABELS[item.question?.type] || '题目'} />
                        <span className="ml-auto rounded-xl bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                          错 {item.wrongCount} 次 / 对 {item.correctCount} 次
                        </span>
                      </div>

                      <div className="text-base font-semibold leading-8 text-gray-900 dark:text-gray-100">
                        <CodeAwareText text={item.question?.content} />
                      </div>

                      {item.question?.analysis && (
                        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-gray-600 dark:bg-blue-900/20 dark:text-gray-300">
                          <CodeAwareText text={item.question.analysis} className="bg-transparent p-0" />
                        </div>
                      )}
                    </div>

                    <IconButton
                      label="移除错题"
                      icon={removingId === item.questionId ? Loader2 : Trash2}
                      onClick={() => handleRemoveItem(item.questionId)}
                      disabled={removingId === item.questionId}
                      className="hover:bg-red-50 hover:text-danger dark:hover:bg-red-900/20"
                    />
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(next) => {
              setPage(next);
              loadItems(selectedBankId, next);
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        onConfirm={handleClear}
        title="清空错题本"
        message={selectedBankId ? '确定要清空该题库下的全部错题吗？' : '确定要清空全部题库的错题吗？'}
        confirmText="清空"
        type="danger"
        loading={loading}
      />
    </div>
  );
};

export default WrongBook;
