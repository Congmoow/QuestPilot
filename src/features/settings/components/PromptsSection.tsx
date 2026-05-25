import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { Dialog } from '../../../components/Dialog';
import {
  ActionButton,
  Field,
  IconButton,
  SurfaceCard,
  TextareaInput,
  TextInput,
} from '../../../components/ui';
import { usePrompts } from '../hooks/usePrompts';

const PromptsSection = () => {
  const {
    prompts,
    editingPrompt,
    promptName, setPromptName,
    promptContent, setPromptContent,
    showPromptForm,
    savingPrompt,
    deletePromptDialogOpen,
    deletingPrompt,
    deletingPromptLoading,
    resetPromptForm,
    handleSavePrompt,
    handleEditPrompt,
    handleOpenDeletePromptDialog,
    handleCloseDeletePromptDialog,
    handleDeletePrompt,
    setShowPromptForm,
  } = usePrompts();

  return (
    <SurfaceCard padding="p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="ui-icon-tile size-12 bg-blue-50 text-primary">
            <MessageSquare size={24} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">AI Prompt 管理</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500 dark:text-gray-400">
              自定义 AI 问答的系统提示词，可以让 AI 扮演不同角色或专注于特定领域。
            </p>
          </div>
        </div>
        <ActionButton
          icon={Plus}
          onClick={() => {
            resetPromptForm();
            setShowPromptForm(true);
          }}
        >
          新建 Prompt
        </ActionButton>
      </div>

      <Dialog
        open={showPromptForm}
        onClose={resetPromptForm}
        title={editingPrompt ? '编辑 Prompt' : '新建 Prompt'}
        size="lg"
      >
        <div className="space-y-4">
          <Field label="名称">
            <TextInput
              value={promptName}
              onChange={(e) => setPromptName(e.target.value)}
              placeholder="如：英语老师、数学助手"
            />
          </Field>
          <Field label="提示词内容">
            <TextareaInput
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              placeholder="描述 AI 的角色、能力和回答风格..."
              rows={8}
            />
          </Field>
          <div className="flex flex-wrap gap-3 pt-2">
            <ActionButton
              onClick={handleSavePrompt}
              disabled={savingPrompt || !promptName.trim() || !promptContent.trim()}
              loading={savingPrompt}
            >
              保存
            </ActionButton>
            <ActionButton variant="secondary" onClick={resetPromptForm}>
              取消
            </ActionButton>
          </div>
        </div>
      </Dialog>

      <div className="grid gap-3">
        {prompts.map((prompt) => (
          <div key={prompt.id} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{prompt.name}</h4>
                  {prompt.isDefault && (
                    <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">默认</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  {prompt.content}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <IconButton label="编辑 Prompt" icon={Pencil} onClick={() => handleEditPrompt(prompt)} />
                {!prompt.isDefault && (
                  <IconButton
                    label="删除 Prompt"
                    icon={Trash2}
                    onClick={() => handleOpenDeletePromptDialog(prompt)}
                    className="hover:bg-red-50 hover:text-danger dark:hover:bg-red-900/20"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deletePromptDialogOpen}
        onClose={handleCloseDeletePromptDialog}
        onConfirm={handleDeletePrompt}
        title="删除 Prompt"
        message={`确定要删除 Prompt「${deletingPrompt?.name || ''}」吗？删除后将无法恢复。`}
        confirmText="删除"
        type="danger"
        loading={deletingPromptLoading}
      />
    </SurfaceCard>
  );
};

export default PromptsSection;
