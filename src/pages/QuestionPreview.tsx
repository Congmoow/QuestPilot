import React, { useCallback, useEffect, useState, type ChangeEvent, type MouseEvent } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Download,
  Edit,
  Filter,
  FolderOpen,
  LibraryBig,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import { useQuestions } from '../contexts/QuestionContext';
import QuestionBankDialog from '../components/QuestionBankDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import QuestionEditDialog from '../components/QuestionEditDialog';
import { exportQuestionBank, type CreateQuestionBankInput, type CreateQuestionInput, type QueryOptions, type Question, type QuestionBank, type QuestionType } from '../api';
import CodeAwareText from '../components/CodeAwareText';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  IconButton,
  PageHeader,
  QuestionBankCard,
  SearchInput,
  SelectInput,
  SurfaceCard,
  ToolbarCard,
  TypeBadge,
} from '../components/ui';

const typeMap: Record<QuestionType, { label: string }> = {
  single: { label: '单选题' },
  multiple: { label: '多选题' },
  boolean: { label: '判断题' },
  fill: { label: '填空题' },
  short: { label: '简答题' },
};

const bankTones = [
  'bg-blue-50 text-primary',
  'bg-emerald-50 text-emerald-600',
  'bg-violet-50 text-violet-600',
  'bg-orange-50 text-orange-600',
  'bg-cyan-50 text-cyan-600',
  'bg-teal-50 text-teal-600',
];

type QuestionLoadOptions = Pick<QueryOptions, 'page' | 'type'>;
type TypeFilterValue = QuestionType | 'all';

const errorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

const QuestionPreview = () => {
  const { banks, loading: banksLoading, error: banksError, addBank, editBank, removeBank, fetchBanks } = useQuestionBanks();
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

  const loadQuestions = useCallback(async (bankId: number, options: QuestionLoadOptions = {}) => {
    await fetchQuestions(bankId, {
      page: options.page || 1,
      type: options.type !== undefined ? options.type : filterType,
    });
  }, [fetchQuestions, filterType]);

  useEffect(() => {
    if (selectedBank) {
      loadQuestions(selectedBank.id, { page: 1 });
    }
  }, [selectedBank]);

  useEffect(() => {
    if (selectedBank && filterType !== null) {
      loadQuestions(selectedBank.id, { page: 1, type: filterType });
    } else if (selectedBank && filterType === null) {
      loadQuestions(selectedBank.id, { page: 1, type: null });
    }
  }, [filterType]);

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      selectAll();
    } else {
      clearSelection();
    }
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
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
    if (selectedBank) {
      if (searchInput.trim()) {
        search(selectedBank.id, searchInput.trim(), { page: 1, type: filterType });
      } else {
        setSearchKeyword('');
        loadQuestions(selectedBank.id, { page: 1 });
      }
    }
  }, [selectedBank, searchInput, filterType, search, setSearchKeyword, loadQuestions]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchKeyword('');
    if (selectedBank) {
      loadQuestions(selectedBank.id, { page: 1 });
    }
  }, [selectedBank, setSearchKeyword, loadQuestions]);

  const handleTypeFilter = useCallback((type: TypeFilterValue) => {
    const newType = type === 'all' ? null : type;
    setFilterType(newType);
  }, [setFilterType]);

  const handlePageChange = useCallback((newPage: number) => {
    if (selectedBank && newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      if (searchKeyword) {
        search(selectedBank.id, searchKeyword, { page: newPage, type: filterType });
      } else {
        loadQuestions(selectedBank.id, { page: newPage });
      }
    }
  }, [selectedBank, totalPages, setPage, searchKeyword, search, filterType, loadQuestions]);

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

  const handleDeleteSingleQuestion = async (id: number, e: MouseEvent<HTMLButtonElement>) => {
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  const renderDialogs = () => (
    <>
      <QuestionBankDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateBank}
        loading={submitting}
      />

      <QuestionBankDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingBank(null);
        }}
        onSubmit={handleEditBank}
        initialData={editingBank}
        loading={submitting}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingBank(null);
        }}
        onConfirm={handleDeleteBank}
        title="删除题库"
        message={`确定要删除题库"${deletingBank?.name}"吗？删除后该题库及其所有题目将无法恢复。`}
        confirmText="删除"
        type="danger"
        loading={submitting}
      />
    </>
  );

  if (!selectedBank) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="题库管理"
          subtitle="管理和查看所有题库"
          actions={(
            <ActionButton icon={Plus} onClick={() => setCreateDialogOpen(true)}>
              新建题库
            </ActionButton>
          )}
        />

        {banksLoading && banks.length === 0 && (
          <SurfaceCard className="flex min-h-[260px] items-center justify-center gap-3 text-gray-500">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="font-semibold">题库加载中...</span>
          </SurfaceCard>
        )}

        {banksError && <AlertBanner type="danger">{banksError}</AlertBanner>}

        {!banksLoading && banks.length === 0 && !banksError && (
          <SurfaceCard padding="p-8">
            <EmptyState
              icon={FolderOpen}
              title="暂无题库"
              description="创建第一个题库后，就可以开始录入、管理和练习题目。"
              action={(
                <ActionButton icon={Plus} onClick={() => setCreateDialogOpen(true)}>
                  新建题库
                </ActionButton>
              )}
            />
          </SurfaceCard>
        )}

        {banks.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {banks.map((bank, index) => (
              <motion.div
                key={bank.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <QuestionBankCard
                  bank={bank}
                  icon={LibraryBig}
                  formatDate={formatDate}
                  toneClass={bankTones[index % bankTones.length]}
                  onClick={() => handleEnterBank(bank)}
                  onEdit={(e) => handleOpenEditDialog(bank, e)}
                  onDelete={(e) => handleOpenDeleteDialog(bank, e)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {renderDialogs()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={selectedBank.name}
        subtitle={selectedBank.description || '暂无描述'}
        actions={(
          <>
            <NavLink to={`/manual-entry?bankId=${selectedBank.id}`}>
              <ActionButton icon={Plus}>手动录入</ActionButton>
            </NavLink>
            <NavLink to={`/csv-import?bankId=${selectedBank.id}`}>
              <ActionButton variant="secondary" icon={Upload}>CSV导入</ActionButton>
            </NavLink>
            <ActionButton
              variant="secondary"
              icon={Download}
              onClick={handleExportBank}
              disabled={exporting || total === 0}
              loading={exporting}
            >
              {exporting ? '导出中' : '导出'}
            </ActionButton>
            {selectedIds.length > 0 && (
              <ActionButton variant="danger" icon={Trash2} onClick={() => setDeleteQuestionsDialogOpen(true)}>
                删除 ({selectedIds.length})
              </ActionButton>
            )}
          </>
        )}
      />

      <div className="flex items-center gap-3">
        <IconButton label="返回题库列表" icon={ArrowLeft} variant="secondary" onClick={handleBackToList} />
        <span className="rounded-xl bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary">{total} 题</span>
      </div>

      <ToolbarCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchInput
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onEnter={handleSearch}
            onClear={handleClearSearch}
            placeholder="搜索题目内容..."
            className="w-full lg:max-w-md"
          />
          <ActionButton icon={Search} onClick={handleSearch}>搜索</ActionButton>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
            <Filter size={18} />
            题型筛选
          </div>
          <SelectInput
            value={filterType || 'all'}
            onChange={(e) => handleTypeFilter(e.target.value as TypeFilterValue)}
            className="w-full lg:w-44"
          >
            <option value="all">所有题型</option>
            <option value="single">单选题</option>
            <option value="multiple">多选题</option>
            <option value="boolean">判断题</option>
            <option value="fill">填空题</option>
            <option value="short">简答题</option>
          </SelectInput>
        </div>
      </ToolbarCard>

      {searchKeyword && (
        <AlertBanner type="info">
          搜索“{searchKeyword}”的结果：{total} 条
          <button type="button" onClick={handleClearSearch} className="ml-2 font-semibold text-primary hover:underline">
            清除搜索
          </button>
        </AlertBanner>
      )}

      {questionsError && <AlertBanner type="danger">{questionsError}</AlertBanner>}

      {questionsLoading && (
        <SurfaceCard className="flex min-h-[240px] items-center justify-center gap-3 text-gray-500">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="font-semibold">题目加载中...</span>
        </SurfaceCard>
      )}

      {!questionsLoading && questions.length === 0 && (
        <SurfaceCard padding="p-8">
          <EmptyState
            icon={BookOpen}
            title={searchKeyword ? '未找到匹配的题目' : '暂无题目'}
            description={searchKeyword ? '尝试使用其他关键词搜索。' : '点击上方按钮添加题目，题目会显示在这里。'}
          />
        </SurfaceCard>
      )}

      {!questionsLoading && questions.length > 0 && (
        <div className="space-y-4">
          <SurfaceCard padding="px-5 py-4">
            <label className="inline-flex items-center gap-3 text-sm font-semibold text-gray-500">
              <input
                type="checkbox"
                className="size-4 rounded border-gray-300 text-primary"
                onChange={handleSelectAll}
                checked={selectedIds.length === questions.length && questions.length > 0}
              />
              全选本页
            </label>
          </SurfaceCard>

          <div className="grid gap-4">
            <AnimatePresence>
              {questions.map((q, index) => (
                <motion.article
                  key={q.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    'ui-card group p-6 transition-all duration-200',
                    selectedIds.includes(q.id) ? 'border-primary ring-2 ring-primary/20' : 'hover:border-blue-200'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      className="mt-2 size-4 rounded border-gray-300 text-primary"
                      checked={selectedIds.includes(q.id)}
                      onChange={() => handleSelectOne(q.id)}
                    />

                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <TypeBadge type={q.type} label={typeMap[q.type]?.label || q.type} />
                        <span className="ml-auto text-xs text-gray-400">
                          {q.createdAt ? new Date(q.createdAt).toLocaleString('zh-CN') : ''}
                        </span>
                      </div>

                      <div className="text-base font-semibold leading-8 text-gray-900 dark:text-gray-100">
                        <CodeAwareText text={q.content} />
                      </div>

                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              className={cn(
                                'rounded-2xl border px-4 py-3 text-sm',
                                q.answer?.includes(opt.id)
                                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                                  : 'border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              )}
                            >
                              <div className="flex gap-2">
                                <span className="shrink-0 font-bold">{opt.id}.</span>
                                <CodeAwareText text={opt.text} className="min-w-0 flex-1 bg-transparent p-0" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-gray-600 dark:bg-green-900/20 dark:text-gray-300">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">答案：</span>
                        <span className="font-bold text-green-700 dark:text-green-300">{q.answer}</span>
                      </div>

                      {q.analysis && (
                        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-gray-600 dark:bg-blue-900/20 dark:text-gray-300">
                          <span className="font-semibold text-gray-700 dark:text-gray-200">解析：</span>
                          <div className="mt-1">
                            <CodeAwareText text={q.analysis} className="bg-transparent p-0" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                      <IconButton label="编辑题目" icon={Edit} onClick={(e) => handleOpenEditQuestion(q, e)} />
                      <IconButton
                        label="删除题目"
                        icon={Trash2}
                        onClick={(e) => handleDeleteSingleQuestion(q.id, e)}
                        className="hover:bg-red-50 hover:text-danger dark:hover:bg-red-900/20"
                      />
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {!questionsLoading && totalPages > 0 && (
        <SurfaceCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" padding="px-5 py-4">
          <span className="text-sm text-gray-500">
            显示 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, total)} 条，共 {total} 条
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton variant="secondary" size="sm" disabled={page === 1} onClick={() => handlePageChange(page - 1)}>
              上一页
            </ActionButton>
            <span className="px-3 text-sm font-bold text-gray-500">{page} / {totalPages}</span>
            <ActionButton variant="secondary" size="sm" disabled={page === totalPages} onClick={() => handlePageChange(page + 1)}>
              下一页
            </ActionButton>
          </div>
        </SurfaceCard>
      )}

      <ConfirmDialog
        open={deleteQuestionsDialogOpen}
        onClose={() => {
          setDeleteQuestionsDialogOpen(false);
          if (selectedIds.length === 1) {
            clearSelection();
          }
        }}
        onConfirm={handleDeleteQuestions}
        title="删除题目"
        message={`确定要删除选中的 ${selectedIds.length} 道题目吗？删除后将无法恢复。`}
        confirmText="删除"
        type="danger"
        loading={submitting}
      />

      {editQuestionDialogOpen && editingQuestion && (
        <QuestionEditDialog
          open={editQuestionDialogOpen}
          onClose={() => {
            setEditQuestionDialogOpen(false);
            setEditingQuestion(null);
          }}
          question={editingQuestion}
          onSave={async (data: Partial<CreateQuestionInput>) => {
            await editQuestion(editingQuestion.id, data);
            setEditQuestionDialogOpen(false);
            setEditingQuestion(null);
            if (selectedBank) {
              loadQuestions(selectedBank.id, { page });
            }
          }}
        />
      )}
    </div>
  );
};

export default QuestionPreview;
