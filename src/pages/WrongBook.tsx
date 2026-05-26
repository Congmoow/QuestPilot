import { BookOpen, Play, RotateCcw } from 'lucide-react';
import { ActionButton, ResultSummary } from '../components/ui';
import WrongBookList from '../features/wrong-book/components/WrongBookList';
import WrongBookPractice from '../features/wrong-book/components/WrongBookPractice';
import { useWrongBook } from '../features/wrong-book/hooks/useWrongBook';

const WrongBook = () => {
  const state = useWrongBook();
  const { practiceResult, practicing, currentQuestion } = state;

  if (practiceResult) {
    return (
      <ResultSummary
        title="练习完成！"
        subtitle={state.currentBankName}
        icon={BookOpen}
        score={practiceResult.accuracy}
        stats={[
          { label: '总题数', value: practiceResult.total, className: 'bg-blue-50 text-gray-900' },
          { label: '正确', value: practiceResult.correct, className: 'bg-green-50 text-green-700' },
          { label: '错误', value: practiceResult.wrong, className: 'bg-red-50 text-red-700' },
        ]}
        actions={
          <>
            <ActionButton variant="secondary" icon={RotateCcw} onClick={state.restart}>
              返回错题本
            </ActionButton>
            <ActionButton icon={Play} onClick={state.startPractice}>
              再练一次
            </ActionButton>
          </>
        }
      />
    );
  }

  if (practicing && currentQuestion) {
    return (
      <WrongBookPractice
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
    <WrongBookList
      banks={state.banks}
      selectedBankId={state.selectedBankId}
      setSelectedBankId={state.setSelectedBankId}
      practiceCount={state.practiceCount}
      setPracticeCount={state.setPracticeCount}
      items={state.items}
      total={state.total}
      totalPages={state.totalPages}
      page={state.page}
      loading={state.loading}
      loadError={state.loadError}
      removingId={state.removingId}
      clearDialogOpen={state.clearDialogOpen}
      setClearDialogOpen={state.setClearDialogOpen}
      currentBankName={state.currentBankName}
      loadItems={state.loadItems}
      startPractice={state.startPractice}
      handleRemoveItem={state.handleRemoveItem}
      handleClear={state.handleClear}
    />
  );
};

export default WrongBook;
