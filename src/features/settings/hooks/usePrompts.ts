import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../api';
import type { Prompt } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';

export const usePrompts = () => {
  const qc = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [promptName, setPromptName] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [deletePromptDialogOpen, setDeletePromptDialogOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<Prompt | null>(null);

  const { data: prompts = [] } = useQuery({
    queryKey: queryKeys.prompts.all(),
    queryFn: () => api.prompt.getAll(),
  });

  const invalidatePrompts = () => qc.invalidateQueries({ queryKey: queryKeys.prompts.all() });

  const { mutateAsync: createMutation, isPending: creating } = useMutation({
    mutationFn: (data: { name: string; content: string }) => api.prompt.create(data),
    onSuccess: invalidatePrompts,
  });

  const { mutateAsync: updateMutation, isPending: updating } = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; content: string } }) =>
      api.prompt.update(id, data),
    onSuccess: invalidatePrompts,
  });

  const { mutateAsync: deleteMutation, isPending: deletingPromptLoading } = useMutation({
    mutationFn: (id: number) => api.prompt.delete(id),
    onSuccess: invalidatePrompts,
  });

  const savingPrompt = creating || updating;

  const resetPromptForm = () => {
    setEditingPrompt(null);
    setPromptName('');
    setPromptContent('');
    setShowPromptForm(false);
  };

  const handleSavePrompt = async () => {
    if (!promptName.trim() || !promptContent.trim()) return;
    try {
      if (editingPrompt) {
        await updateMutation({
          id: editingPrompt.id,
          data: { name: promptName, content: promptContent },
        });
      } else {
        await createMutation({ name: promptName, content: promptContent });
      }
      resetPromptForm();
    } catch (error) {
      console.error('保存 Prompt 失败:', error);
    }
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setPromptName(prompt.name);
    setPromptContent(prompt.content);
    setShowPromptForm(true);
  };

  const handleOpenDeletePromptDialog = (prompt: Prompt) => {
    setDeletingPrompt(prompt);
    setDeletePromptDialogOpen(true);
  };

  const handleCloseDeletePromptDialog = () => {
    setDeletePromptDialogOpen(false);
    setDeletingPrompt(null);
  };

  const handleDeletePrompt = async () => {
    if (!deletingPrompt) return;
    try {
      await deleteMutation(deletingPrompt.id);
      if (editingPrompt?.id === deletingPrompt.id) {
        resetPromptForm();
      }
      handleCloseDeletePromptDialog();
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
      throw error;
    }
  };

  return {
    prompts,
    editingPrompt,
    promptName,
    setPromptName,
    promptContent,
    setPromptContent,
    showPromptForm,
    setShowPromptForm,
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
  };
};
