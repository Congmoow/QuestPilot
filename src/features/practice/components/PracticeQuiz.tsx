import { CheckCircle, ChevronRight, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { countFillBlanks } from '../../../lib/fillBlank';
import CodeAwareText from '../../../components/CodeAwareText';
import {
  ActionButton,
  AlertBanner,
  AnswerOptionCard,
  QuizShell,
  TextareaInput,
  TextInput,
  TypeBadge,
} from '../../../components/ui';
import type { AnswerCardState } from '../../../types/viewModels';
import { TYPE_LABELS } from '../../../lib/questionLabels';
import { normalizeFillAnswer } from '../../../lib/practiceHelpers';
import type { PracticeState } from '../hooks/usePractice';

type PracticeQuizProps = Pick<
  PracticeState,
  | 'questions' | 'currentIndex' | 'currentQuestion'
  | 'userAnswers' | 'submitted' | 'showResult' | 'canSubmit'
  | 'handleAnswer' | 'handleFillAnswer' | 'toggleMultipleAnswer'
  | 'submitAnswer' | 'nextQuestion' | 'isCorrect'
>;

const PracticeQuiz = ({
  questions, currentIndex, currentQuestion,
  userAnswers, submitted, showResult, canSubmit,
  handleAnswer, handleFillAnswer, toggleMultipleAnswer,
  submitAnswer, nextQuestion, isCorrect,
}: PracticeQuizProps) => {
  if (!currentQuestion) return null;

  const blankCount = currentQuestion.type === 'fill' ? countFillBlanks(currentQuestion.content) : 0;
  const fillValues = currentQuestion.type === 'fill'
    ? normalizeFillAnswer(userAnswers[currentQuestion.id], blankCount)
    : [];
  const fillCorrectValues = currentQuestion.type === 'fill'
    ? normalizeFillAnswer(currentQuestion.answer, blankCount)
    : [];

  return (
    <QuizShell
      current={currentIndex + 1}
      total={questions.length}
      actions={!submitted ? (
        <ActionButton onClick={submitAnswer} disabled={!canSubmit}>确认答案</ActionButton>
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

                let state: AnswerCardState = isSelected ? 'selected' : 'default';
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
                let state: AnswerCardState = isSelected ? 'selected' : 'default';
                if (showResult) {
                  if (isCorrectOption) state = 'correct';
                  else if (isSelected && !isCorrectOption) state = 'wrong';
                }
                return (
                  <AnswerOptionCard key={option} state={state} onClick={() => handleAnswer(currentQuestion.id, option)} disabled={submitted}>
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
                  {fillCorrectValues.map((a, i) => <p key={i}>第 {i + 1} 空：{a}</p>)}
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
};

export default PracticeQuiz;
