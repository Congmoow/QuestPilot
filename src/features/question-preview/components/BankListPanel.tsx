import { FolderOpen, LibraryBig, Loader2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import QuestionBankDialog from '../../../components/QuestionBankDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageHeader,
  QuestionBankCard,
  SurfaceCard,
} from '../../../components/ui';
import type { QuestionPreviewState } from '../hooks/useQuestionPreview';

const bankTones = [
  'bg-blue-50 text-primary',
  'bg-emerald-50 text-emerald-600',
  'bg-violet-50 text-violet-600',
  'bg-orange-50 text-orange-600',
  'bg-cyan-50 text-cyan-600',
  'bg-teal-50 text-teal-600',
];

type BankListPanelProps = Pick<
  QuestionPreviewState,
  | 'banks' | 'banksLoading' | 'banksError'
  | 'createDialogOpen' | 'setCreateDialogOpen'
  | 'editDialogOpen' | 'setEditDialogOpen'
  | 'deleteDialogOpen' | 'setDeleteDialogOpen'
  | 'editingBank' | 'deletingBank'
  | 'submitting'
  | 'formatDate'
  | 'handleEnterBank'
  | 'handleOpenEditDialog' | 'handleOpenDeleteDialog'
  | 'handleCreateBank' | 'handleEditBank' | 'handleDeleteBank'
>;

const BankListPanel = ({
  banks, banksLoading, banksError,
  createDialogOpen, setCreateDialogOpen,
  editDialogOpen, setEditDialogOpen,
  deleteDialogOpen, setDeleteDialogOpen,
  editingBank, deletingBank,
  submitting,
  formatDate,
  handleEnterBank,
  handleOpenEditDialog, handleOpenDeleteDialog,
  handleCreateBank, handleEditBank, handleDeleteBank,
}: BankListPanelProps) => (
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

    <QuestionBankDialog
      open={createDialogOpen}
      onClose={() => setCreateDialogOpen(false)}
      onSubmit={handleCreateBank}
      loading={submitting}
    />

    <QuestionBankDialog
      open={editDialogOpen}
      onClose={() => { setEditDialogOpen(false); }}
      onSubmit={handleEditBank}
      initialData={editingBank}
      loading={submitting}
    />

    <ConfirmDialog
      open={deleteDialogOpen}
      onClose={() => { setDeleteDialogOpen(false); }}
      onConfirm={handleDeleteBank}
      title="删除题库"
      message={`确定要删除题库"${deletingBank?.name}"吗？删除后该题库及其所有题目将无法恢复。`}
      confirmText="删除"
      type="danger"
      loading={submitting}
    />
  </div>
);

export default BankListPanel;
