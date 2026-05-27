import BankListPanel from '../features/question-preview/components/BankListPanel';
import QuestionListPanel from '../features/question-preview/components/QuestionListPanel';
import { useQuestionPreview } from '../features/question-preview/hooks/useQuestionPreview';

const QuestionPreview = () => {
  const state = useQuestionPreview();

  if (!state.selectedBank) {
    return (
      <BankListPanel
        banks={state.banks}
        banksLoading={state.banksLoading}
        banksError={state.banksError}
        createDialogOpen={state.createDialogOpen}
        setCreateDialogOpen={state.setCreateDialogOpen}
        editDialogOpen={state.editDialogOpen}
        setEditDialogOpen={state.setEditDialogOpen}
        deleteDialogOpen={state.deleteDialogOpen}
        setDeleteDialogOpen={state.setDeleteDialogOpen}
        editingBank={state.editingBank}
        deletingBank={state.deletingBank}
        submitting={state.submitting}
        formatDate={state.formatDate}
        handleEnterBank={state.handleEnterBank}
        handleOpenEditDialog={state.handleOpenEditDialog}
        handleOpenDeleteDialog={state.handleOpenDeleteDialog}
        handleCreateBank={state.handleCreateBank}
        handleEditBank={state.handleEditBank}
        handleDeleteBank={state.handleDeleteBank}
      />
    );
  }

  return (
    <QuestionListPanel
      selectedBank={state.selectedBank}
      questions={state.questions}
      total={state.total}
      page={state.page}
      pageSize={state.pageSize}
      totalPages={state.totalPages}
      questionsLoading={state.questionsLoading}
      questionsError={state.questionsError}
      searchKeyword={state.searchKeyword}
      filterType={state.filterType}
      selectedIds={state.selectedIds}
      searchInput={state.searchInput}
      setSearchInput={state.setSearchInput}
      submitting={state.submitting}
      exporting={state.exporting}
      deleteQuestionsDialogOpen={state.deleteQuestionsDialogOpen}
      setDeleteQuestionsDialogOpen={state.setDeleteQuestionsDialogOpen}
      editQuestionDialogOpen={state.editQuestionDialogOpen}
      setEditQuestionDialogOpen={state.setEditQuestionDialogOpen}
      editingQuestion={state.editingQuestion}
      handleSelectAll={state.handleSelectAll}
      handleSelectOne={state.handleSelectOne}
      handleBackToList={state.handleBackToList}
      handleSearch={state.handleSearch}
      handleClearSearch={state.handleClearSearch}
      handleTypeFilter={state.handleTypeFilter}
      handlePageChange={state.handlePageChange}
      handleDeleteQuestions={state.handleDeleteQuestions}
      handleOpenEditQuestion={state.handleOpenEditQuestion}
      handleDeleteSingleQuestion={state.handleDeleteSingleQuestion}
      handleExportBank={state.handleExportBank}
      handleSaveEditQuestion={state.handleSaveEditQuestion}
      clearSelection={state.clearSelection}
      duplicateDialogOpen={state.duplicateDialogOpen}
      setDuplicateDialogOpen={state.setDuplicateDialogOpen}
      handleConfirmDedup={state.handleConfirmDedup}
    />
  );
};

export default QuestionPreview;
