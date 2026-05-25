import { Play, RotateCcw, Trophy } from 'lucide-react';
import { ActionButton, ResultSummary } from '../components/ui';
import BankSelector from '../features/practice/components/BankSelector';
import PracticeQuiz from '../features/practice/components/PracticeQuiz';
import { usePractice } from '../features/practice/hooks/usePractice';

const Practice = () => {
  const state = usePractice();
  const { practiceResult, practicing, currentQuestion, banks, selectedBankId } = state;

  if (practiceResult) {
    return (
      <ResultSummary
        title="练习完成！"
        subtitle={banks.find((b) => b.id === selectedBankId)?.name}
        icon={Trophy}
        score={practiceResult.accuracy}
        stats={[
          { label: '总题数', value: practiceResult.total, className: 'bg-blue-50 text-gray-900' },
          { label: '正确', value: practiceResult.correct, className: 'bg-green-50 text-green-700' },
          { label: '错误', value: practiceResult.wrong, className: 'bg-red-50 text-red-700' },
        ]}
        actions={(
          <>
            <ActionButton variant="secondary" icon={RotateCcw} onClick={state.restart}>
              重新选择
            </ActionButton>
            <ActionButton icon={Play} onClick={() => state.startPractice()}>
              再练一次
            </ActionButton>
          </>
        )}
      />
    );
  }

  if (practicing && currentQuestion) {
    return (
      <PracticeQuiz
        questions={state.questions}
        currentIndex={state.currentIndex}
        currentQuestion={currentQuestion}
        userAnswers={state.userAnswers}
        submitted={state.submitted}
        showResult={state.showResult}
        canSubmit={state.canSubmit}
        handleAnswer={state.handleAnswer}
        handleFillAnswer={state.handleFillAnswer}
        toggleMultipleAnswer={state.toggleMultipleAnswer}
        submitAnswer={state.submitAnswer}
        nextQuestion={state.nextQuestion}
        isCorrect={state.isCorrect}
      />
    );
  }

  return (
    <BankSelector
      banks={state.banks}
      selectedBankId={state.selectedBankId}
      loading={state.loading}
      onSelect={state.setSelectedBankId}
      onStart={(bankId) => { state.setSelectedBankId(bankId); state.startPractice(bankId); }}
    />
  );
};

export default Practice;
