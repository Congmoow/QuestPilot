import { ArrowLeft, BookOpen, Download, Edit, Filter, Loader2, Plus, Search, Trash2, Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import ConfirmDialog from '../../../components/ConfirmDialog';
import QuestionEditDialog from '../../../components/QuestionEditDialog';
import CodeAwareText from '../../../components/CodeAwareText';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  IconButton,
  PageHeader,
  SearchInput,
  SelectInput,
  SurfaceCard,
  ToolbarCard,
  TypeBadge,
} from '../../../components/ui';
import type { QuestionType } from '../../../api';
import type { QuestionPreviewState } from '../hooks/useQuestionPreview';

const typeMap: Record<QuestionType, { label: string }> = {
  single: { label: '单选题' },
  multiple: { label: '多选题' },
  boolean: { label: '判断题' },
  fill: { label: '填空题' },
  short: { label: '简答题' },
};

type TypeFilterValue = QuestionType | 'all';

type QuestionListPanelProps = Pick<
  QuestionPreviewState,
  | 'selectedBank'
  | 'questions' | 'total' | 'page' | 'pageSize' | 'totalPages'
  | 'questionsLoading' | 'questionsError'
  | 'searchKeyword' | 'filterType' | 'selectedIds'
  | 'searchInput' | 'setSearchInput'
  | 'submitting' | 'exporting'
  | 'deleteQuestionsDialogOpen' | 'setDeleteQuestionsDialogOpen'
  | 'editQuestionDialogOpen' | 'setEditQuestionDialogOpen'
  | 'editingQuestion'
  | 'handleSelectAll' | 'handleSelectOne'
  | 'handleBackToList'
  | 'handleSearch' | 'handleClearSearch' | 'handleTypeFilter' | 'handlePageChange'
  | 'handleDeleteQuestions'
  | 'handleOpenEditQuestion' | 'handleDeleteSingleQuestion'
  | 'handleExportBank' | 'handleSaveEditQuestion'
  | 'clearSelection'
>;

const QuestionListPanel = ({
  selectedBank,
  questions, total, page, pageSize, totalPages,
  questionsLoading, questionsError,
  searchKeyword, filterType, selectedIds,
  searchInput, setSearchInput,
  submitting, exporting,
  deleteQuestionsDialogOpen, setDeleteQuestionsDialogOpen,
  editQuestionDialogOpen, setEditQuestionDialogOpen,
  editingQuestion,
  handleSelectAll, handleSelectOne,
  handleBackToList,
  handleSearch, handleClearSearch, handleTypeFilter, handlePageChange,
  handleDeleteQuestions,
  handleOpenEditQuestion, handleDeleteSingleQuestion,
  handleExportBank, handleSaveEditQuestion,
  clearSelection,
}: QuestionListPanelProps) => {
  if (!selectedBank) return null;

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
          搜索"{searchKeyword}"的结果：{total} 条
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
          if (selectedIds.length === 1) clearSelection();
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
          onClose={() => { setEditQuestionDialogOpen(false); }}
          question={editingQuestion}
          onSave={handleSaveEditQuestion}
        />
      )}
    </div>
  );
};

export default QuestionListPanel;
