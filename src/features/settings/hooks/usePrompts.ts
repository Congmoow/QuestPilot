import { useEffect, useState } from 'react';
import api from '../../../api';
import type { Prompt } from '../../../api';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const usePrompts = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [promptName, setPromptName] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [deletePromptDialogOpen, setDeletePromptDialogOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<Prompt | null>(null);
  const [deletingPromptLoading, setDeletingPromptLoading] = useState(false);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const list = await api.prompt.getAll();
      setPrompts(list);
    } catch (error) {
      console.error('加载 Prompt 列表失败:', error);
    }
  };

  const resetPromptForm = () => {
    setEditingPrompt(null);
    setPromptName('');
    setPromptContent('');
    setShowPromptForm(false);
  };

  const handleSavePrompt = async () => {
    if (!promptName.trim() || !promptContent.trim()) return;
    setSavingPrompt(true);
    try {
      if (editingPrompt) {
        await api.prompt.update(editingPrompt.id, { name: promptName, content: promptContent });
      } else {
        await api.prompt.create({ name: promptName, content: promptContent });
      }
      await loadPrompts();
      resetPromptForm();
    } catch (error) {
      console.error('保存 Prompt 失败:', error);
    } finally {
      setSavingPrompt(false);
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
    setDeletingPromptLoading(true);
    try {
      await api.prompt.delete(deletingPrompt.id);
      await loadPrompts();
      if (editingPrompt?.id === deletingPrompt.id) {
        resetPromptForm();
      }
    } catch (error) {
      alert(errorMessage(error, '删除失败'));
      throw error;
    } finally {
      setDeletingPromptLoading(false);
    }
  };

  return {
    prompts,
    editingPrompt,
    promptName, setPromptName,
    promptContent, setPromptContent,
    showPromptForm, setShowPromptForm,
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
