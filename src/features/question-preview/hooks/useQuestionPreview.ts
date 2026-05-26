import { useCallback, useEffect, useState, type ChangeEvent, type MouseEvent } from 'react';
import { exportQuestionBank } from '../../../api';
import type {
  CreateQuestionBankInput,
  CreateQuestionInput,
  Question,
  QuestionBank,
  QuestionType,
} from '../../../api';
import { useQuestionBanks } from '../../../contexts/QuestionBankContext';
import { useQuestions } from '../../../contexts/QuestionContext';

type QuestionLoadOptions = { page?: number; type?: QuestionType | null };
type TypeFilterValue = QuestionType | 'all';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useQuestionPreview = () => {
  const {
    banks,
    loading: banksLoading,
    error: banksError,
    addBank,
    editBank,
    removeBank,
    fetchBanks,
  } = useQuestionBanks();
  const {
    questions,
    total,
    page,
    pageSize,
    totalPages,
    loading: questionsLoading,
    error: questionsError,
    searchKeyword,
    filterType,
    selectedIds,
    fetchQuestions,
    search,
    setPage,
    setSearchKeyword,
    setFilterType,
    setSelectedIds,
    clearSelection,
    selectAll,
    reset: resetQuestions,
    removeQuestions,
    editQuestion,
  } = useQuestions();

  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [deletingBank, setDeletingBank] = useState<QuestionBank | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteQuestionsDialogOpen, setDeleteQuestionsDialogOpen] = useState(false);
  const [editQuestionDialogOpen, setEditQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadQuestions = useCallback(
    async (bankId: number, options: QuestionLoadOptions = {}) => {
      await fetchQuestions(bankId, {
        page: options.page || 1,
        type: options.type !== undefined ? options.type : filterType,
      });
    },
    [fetchQuestions, filterType],
  );

  useEffect(() => {
    if (selectedBank) loadQuestions(selectedBank.id, { page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBank]);

  useEffect(() => {
    if (selectedBank) loadQuestions(selectedBank.id, { page: 1, type: filterType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      selectAll();
    } else {
      clearSelection();
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds(
      selectedIds.includes(id) ? selectedIds.filter((sid) => sid !== id) : [...selectedIds, id],
    );
  };

  const handleEnterBank = (bank: QuestionBank) => {
    setSelectedBank(bank);
    setSearchInput('');
    setSearchKeyword('');
    setFilterType(null);
    clearSelection();
  };

  const handleBackToList = () => {
    setSelectedBank(null);
    resetQuestions();
    setSearchInput('');
  };

  const handleSearch = useCallback(() => {
    if (!selectedBank) return;
    if (searchInput.trim()) {
      search(selectedBank.id, searchInput.trim(), { page: 1, type: filterType });
    } else {
      setSearchKeyword('');
      loadQuestions(selectedBank.id, { page: 1 });
    }
  }, [selectedBank, searchInput, filterType, search, setSearchKeyword, loadQuestions]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchKeyword('');
    if (selectedBank) loadQuestions(selectedBank.id, { page: 1 });
  }, [selectedBank, setSearchKeyword, loadQuestions]);

  const handleTypeFilter = useCallback(
    (type: TypeFilterValue) => {
      setFilterType(type === 'all' ? null : type);
    },
    [setFilterType],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (!selectedBank || newPage < 1 || newPage > totalPages) return;
      setPage(newPage);
      if (searchKeyword) {
        search(selectedBank.id, searchKeyword, { page: newPage, type: filterType });
      } else {
        loadQuestions(selectedBank.id, { page: newPage });
      }
    },
    [selectedBank, totalPages, setPage, searchKeyword, search, filterType, loadQuestions],
  );

  const handleDeleteQuestions = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      await removeQuestions(selectedIds);
      setDeleteQuestionsDialogOpen(false);
      fetchBanks();
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditQuestion = (question: Question, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setEditingQuestion(question);
    setEditQuestionDialogOpen(true);
  };

  const handleDeleteSingleQuestion = (id: number, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setSelectedIds([id]);
    setDeleteQuestionsDialogOpen(true);
  };

  const handleCreateBank = async (data: CreateQuestionBankInput) => {
    setSubmitting(true);
    try {
      await addBank(data);
      setCreateDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditDialog = (bank: QuestionBank, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setEditingBank(bank);
    setEditDialogOpen(true);
  };

  const handleEditBank = async (data: CreateQuestionBankInput) => {
    if (!editingBank) return;
    setSubmitting(true);
    try {
      await editBank(editingBank.id, data);
      setEditDialogOpen(false);
      setEditingBank(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteDialog = (bank: QuestionBank, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setDeletingBank(bank);
    setDeleteDialogOpen(true);
  };

  const handleDeleteBank = async () => {
    if (!deletingBank) return;
    setSubmitting(true);
    try {
      await removeBank(deletingBank.id);
      setDeleteDialogOpen(false);
      setDeletingBank(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportBank = async () => {
    if (!selectedBank) return;
    setExporting(true);
    try {
      await exportQuestionBank(selectedBank.id);
    } catch (error) {
      console.error('导出失败:', error);
      alert(errorMessage(error, '导出失败'));
    } finally {
      setExporting(false);
    }
  };

  const handleSaveEditQuestion = async (data: Partial<CreateQuestionInput>) => {
    if (!editingQuestion || !selectedBank) return;
    await editQuestion(editingQuestion.id, data);
    setEditQuestionDialogOpen(false);
    setEditingQuestion(null);
    loadQuestions(selectedBank.id, { page });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return {
    banks,
    banksLoading,
    banksError,
    questions,
    total,
    page,
    pageSize,
    totalPages,
    questionsLoading,
    questionsError,
    searchKeyword,
    filterType,
    selectedIds,
    selectedBank,
    searchInput,
    setSearchInput,
    createDialogOpen,
    setCreateDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    editingBank,
    deletingBank,
    submitting,
    deleteQuestionsDialogOpen,
    setDeleteQuestionsDialogOpen,
    editQuestionDialogOpen,
    setEditQuestionDialogOpen,
    editingQuestion,
    exporting,
    handleSelectAll,
    handleSelectOne,
    handleEnterBank,
    handleBackToList,
    handleSearch,
    handleClearSearch,
    handleTypeFilter,
    handlePageChange,
    handleDeleteQuestions,
    handleOpenEditQuestion,
    handleDeleteSingleQuestion,
    handleCreateBank,
    handleOpenEditDialog,
    handleEditBank,
    handleOpenDeleteDialog,
    handleDeleteBank,
    handleExportBank,
    handleSaveEditQuestion,
    clearSelection,
    loadQuestions,
    formatDate,
  };
};

export type QuestionPreviewState = ReturnType<typeof useQuestionPreview>;
