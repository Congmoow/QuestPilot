import { Loader2, Play, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CodeAwareText from '../../../components/CodeAwareText';
import ConfirmDialog from '../../../components/ConfirmDialog';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  Field,
  IconButton,
  PageHeader,
  Pagination,
  SelectInput,
  SurfaceCard,
  TextInput,
  ToolbarCard,
  TypeBadge,
} from '../../../components/ui';
import type { WrongBookState } from '../hooks/useWrongBook';
import { TYPE_LABELS } from '../utils/labels';
import CuotiIcon from './CuotiIcon';

type WrongBookListProps = Pick<
  WrongBookState,
  | 'banks'
  | 'selectedBankId'
  | 'setSelectedBankId'
  | 'practiceCount'
  | 'setPracticeCount'
  | 'items'
  | 'total'
  | 'totalPages'
  | 'page'
  | 'loading'
  | 'loadError'
  | 'removingId'
  | 'clearDialogOpen'
  | 'setClearDialogOpen'
  | 'currentBankName'
  | 'loadItems'
  | 'startPractice'
  | 'handleRemoveItem'
  | 'handleClear'
>;

const WrongBookList = ({
  banks,
  selectedBankId,
  setSelectedBankId,
  practiceCount,
  setPracticeCount,
  items,
  total,
  totalPages,
  page,
  loading,
  loadError,
  removingId,
  clearDialogOpen,
  setClearDialogOpen,
  currentBankName,
  loadItems,
  startPractice,
  handleRemoveItem,
  handleClear,
}: WrongBookListProps) => (
  <div className="space-y-6">
    <PageHeader title="错题本" subtitle="记录每次练习做错的题目，并支持随机练错题" />

    <ToolbarCard>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
        <Field label="题库筛选">
          <SelectInput
            value={selectedBankId || ''}
            onChange={(e) => setSelectedBankId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">全部题库</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="练习题数">
          <TextInput
            type="number"
            min={1}
            max={200}
            value={practiceCount}
            onChange={(e) => setPracticeCount(Number(e.target.value))}
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
        当前筛选：<span className="text-primary">{currentBankName}</span>，共{' '}
        <span className="text-primary">{total}</span> 道错题
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
                      <TypeBadge
                        type={item.question?.type}
                        label={TYPE_LABELS[item.question?.type] || '题目'}
                      />
                      <span className="ml-auto rounded-xl bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                        错 {item.wrongCount} 次 / 对 {item.correctCount} 次
                      </span>
                    </div>

                    <div className="text-base font-semibold leading-8 text-gray-900 dark:text-gray-100">
                      <CodeAwareText text={item.question?.content} />
                    </div>

                    {item.question?.analysis && (
                      <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-gray-600 dark:bg-blue-900/20 dark:text-gray-300">
                        <CodeAwareText
                          text={item.question.analysis}
                          className="bg-transparent p-0"
                        />
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
          onPageChange={(next) => loadItems(selectedBankId, next)}
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

export default WrongBookList;
