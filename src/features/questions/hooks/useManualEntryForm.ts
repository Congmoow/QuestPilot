import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { saveDraft, loadDraft, clearDraft } from '../../../api';
import type { CreateQuestionInput, DraftData, QuestionOption, QuestionType } from '../../../api';
import { countFillBlanks } from '../../../lib/fillBlank';
import { useQuestionBanks } from '../../../contexts/QuestionBankContext';
import { useQuestions } from '../../../contexts/QuestionContext';

export type ManualEntryFormData = {
  content: string;
  options: QuestionOption[];
  answer: string;
  answers: string[];
  fillAnswers: string[];
  analysis: string;
};

type ManualEntrySubmitData = CreateQuestionInput & { bankId: number };

export type QuestionTypeTab = { id: QuestionType; label: string };

const initialOptions = (): QuestionOption[] => [
  { id: 'A', text: '' },
  { id: 'B', text: '' },
  { id: 'C', text: '' },
  { id: 'D', text: '' },
];

export const initialFormData = (): ManualEntryFormData => ({
  content: '',
  options: initialOptions(),
  answer: '',
  answers: [],
  fillAnswers: [],
  analysis: '',
});

export const questionTypes: QuestionTypeTab[] = [
  { id: 'single', label: '单选题' },
  { id: 'multiple', label: '多选题' },
  { id: 'boolean', label: '判断题' },
  { id: 'fill', label: '填空题' },
  { id: 'short', label: '简答题' },
];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useManualEntryForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bankIdFromUrl = searchParams.get('bankId');
  const { banks } = useQuestionBanks();
  const { addQuestion, currentBankId } = useQuestions();

  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<QuestionType>('single');
  const [formData, setFormData] = useState<ManualEntryFormData>(() => initialFormData());
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if (bankIdFromUrl) {
      setSelectedBankId(parseInt(bankIdFromUrl, 10));
    } else if (currentBankId) {
      setSelectedBankId(currentBankId);
    }
  }, [bankIdFromUrl, currentBankId]);

  useEffect(() => {
    const restoreDraft = async () => {
      try {
        const draft = await loadDraft();
        if (draft) {
          setActiveTab(draft.type || 'single');
          setFormData((prev) => ({
            ...prev,
            content: draft.content || '',
            options: draft.options || prev.options,
            answer: draft.answer || '',
            answers: draft.answers || [],
            fillAnswers: draft.fillAnswers || [],
            analysis: draft.analysis || '',
          }));
          setDraftLoaded(true);
          setTimeout(() => setDraftLoaded(false), 3000);
        }
      } catch (err) {
        console.error('恢复草稿失败:', err);
      }
    };
    restoreDraft();
  }, []);

  const blankCount = useMemo(() => countFillBlanks(formData.content), [formData.content]);

  useEffect(() => {
    if (activeTab === 'fill') {
      setFormData((prev) => {
        const newFillAnswers = [...prev.fillAnswers];
        while (newFillAnswers.length < blankCount) newFillAnswers.push('');
        if (newFillAnswers.length > blankCount) newFillAnswers.length = blankCount;
        return { ...prev, fillAnswers: newFillAnswers };
      });
    }
  }, [blankCount, activeTab]);

  const handleTabChange = (id: QuestionType) => {
    setActiveTab(id);
    setErrors([]);
    setFormData((prev) => ({ ...prev, answer: '', answers: [], fillAnswers: [] }));
  };

  const addOption = () => {
    if (formData.options.length >= 8) return;
    const nextId = String.fromCharCode(65 + formData.options.length);
    setFormData({ ...formData, options: [...formData.options, { id: nextId, text: '' }] });
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return;
    const removedId = formData.options[index].id;
    const newOptions = formData.options.filter((_, i) => i !== index);
    const reindexed = newOptions.map((opt, i) => ({ ...opt, id: String.fromCharCode(65 + i) }));

    let newAnswer = formData.answer;
    let newAnswers = formData.answers;

    if (activeTab === 'single' && formData.answer === removedId) newAnswer = '';
    if (activeTab === 'multiple') {
      newAnswers = formData.answers
        .filter((a) => a !== removedId)
        .map((a) => {
          const oldIndex = a.charCodeAt(0) - 65;
          return oldIndex > index ? String.fromCharCode(oldIndex - 1 + 65) : a;
        });
    }

    setFormData({ ...formData, options: reindexed, answer: newAnswer, answers: newAnswers });
  };

  const updateOption = (index: number, text: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], text };
    setFormData({ ...formData, options: newOptions });
  };

  const toggleMultipleAnswer = (id: string) => {
    const current = formData.answers;
    setFormData({
      ...formData,
      answers: current.includes(id) ? current.filter((a) => a !== id) : [...current, id].sort(),
    });
  };

  const insertBlank = () => {
    setFormData({ ...formData, content: formData.content + ' ___ ' });
  };

  const updateFillAnswer = (index: number, value: string) => {
    const newFillAnswers = [...formData.fillAnswers];
    newFillAnswers[index] = value;
    setFormData({ ...formData, fillAnswers: newFillAnswers });
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];
    if (!selectedBankId) newErrors.push('请选择题库');
    if (!formData.content || formData.content.trim() === '') newErrors.push('题干内容不能为空');

    switch (activeTab) {
      case 'single': {
        const valid = formData.options.filter((opt) => opt.text.trim() !== '');
        if (valid.length < 2) newErrors.push('单选题至少需要2个有效选项');
        if (!formData.answer) newErrors.push('请选择正确答案');
        break;
      }
      case 'multiple': {
        const valid = formData.options.filter((opt) => opt.text.trim() !== '');
        if (valid.length < 2) newErrors.push('多选题至少需要2个有效选项');
        if (formData.answers.length === 0) newErrors.push('请选择至少一个正确答案');
        break;
      }
      case 'boolean':
        if (!formData.answer) newErrors.push('请选择正确答案');
        break;
      case 'fill': {
        if (blankCount === 0)
          newErrors.push('填空题题干中必须包含至少一个空栏标记（_、___、＿＿、（ ）或( )）');
        const emptyFill = formData.fillAnswers.filter(
          (a, i) => i < blankCount && (!a || a.trim() === ''),
        );
        if (emptyFill.length > 0) newErrors.push('请填写所有空栏的答案');
        break;
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const buildSubmitData = (): ManualEntrySubmitData => {
    if (selectedBankId === null) throw new Error('请选择题库');
    const data: ManualEntrySubmitData = {
      bankId: selectedBankId,
      type: activeTab,
      content: formData.content.trim(),
      answer: '',
      analysis: formData.analysis.trim() || null,
    };
    switch (activeTab) {
      case 'single':
        data.options = formData.options.filter((opt) => opt.text.trim() !== '');
        data.answer = formData.answer;
        break;
      case 'multiple':
        data.options = formData.options.filter((opt) => opt.text.trim() !== '');
        data.answer = formData.answers.join('|');
        break;
      case 'boolean':
        data.answer = formData.answer;
        break;
      case 'fill':
        data.answer = formData.fillAnswers.slice(0, blankCount).join('|');
        break;
      case 'short':
        data.answer = formData.answer || '';
        break;
    }
    return data;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    setErrors([]);
    try {
      const data = buildSubmitData();
      await addQuestion(data);
      await clearDraft();
      setSubmitSuccess(true);
      setFormData(initialFormData());
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setErrors([errorMessage(err, '提交失败，请重试')]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const draftData: DraftData = {
        type: activeTab,
        content: formData.content,
        options: formData.options,
        answer: formData.answer,
        answers: formData.answers,
        fillAnswers: formData.fillAnswers,
        analysis: formData.analysis,
        savedAt: new Date().toISOString(),
      };
      await saveDraft(draftData);
      alert('草稿保存成功');
    } catch (err) {
      setErrors([errorMessage(err, '保存草稿失败')]);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleBack = () =>
    navigate(selectedBankId ? `/question-preview?bankId=${selectedBankId}` : '/question-preview');

  const selectedBank = banks.find((bank) => bank.id === selectedBankId);
  const currentQuestionType = questionTypes.find((type) => type.id === activeTab);

  return {
    banks,
    selectedBankId,
    setSelectedBankId,
    activeTab,
    formData,
    setFormData,
    errors,
    submitting,
    submitSuccess,
    savingDraft,
    draftLoaded,
    blankCount,
    selectedBank,
    currentQuestionType,
    handleTabChange,
    addOption,
    removeOption,
    updateOption,
    toggleMultipleAnswer,
    insertBlank,
    updateFillAnswer,
    handleSubmit,
    handleSaveDraft,
    handleBack,
  };
};
