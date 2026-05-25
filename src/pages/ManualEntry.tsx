import React, { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { Save, Send, Plus, Trash2, ArrowLeft, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import { useQuestions } from '../contexts/QuestionContext';
import { saveDraft, loadDraft, clearDraft, type CreateQuestionInput, type DraftData, type QuestionOption, type QuestionType } from '../api';
import { countFillBlanks } from '../lib/fillBlank';
import {
  ActionButton,
  AlertBanner,
  Field,
  IconButton,
  PageHeader,
  SegmentedTabs,
  SelectInput,
  StatusBadge,
  SurfaceCard,
  TextareaInput,
  TextInput,
  ToolbarCard
} from '../components/ui';

type ManualEntryFormData = {
  content: string;
  options: QuestionOption[];
  answer: string;
  answers: string[];
  fillAnswers: string[];
  analysis: string;
};

type ManualEntrySubmitData = CreateQuestionInput & {
  bankId: number;
};

type QuestionTypeTab = {
  id: QuestionType;
  label: string;
};

const initialOptions = (): QuestionOption[] => [
  { id: 'A', text: '' },
  { id: 'B', text: '' },
  { id: 'C', text: '' },
  { id: 'D', text: '' }
];

const initialFormData = (): ManualEntryFormData => ({
  content: '',
  options: initialOptions(),
  answer: '',
  answers: [],
  fillAnswers: [],
  analysis: '',
});

const errorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

const ManualEntry = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bankIdFromUrl = searchParams.get('bankId');
  
  const { banks } = useQuestionBanks();
  const { addQuestion, currentBankId } = useQuestions();
  
  // 确定当前题库ID：优先使用URL参数，其次使用context中的currentBankId
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState<QuestionType>('single');
  const [formData, setFormData] = useState<ManualEntryFormData>(() => initialFormData());
  
  // 状态管理
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const questionTypes: QuestionTypeTab[] = [
    { id: 'single', label: '单选题' },
    { id: 'multiple', label: '多选题' },
    { id: 'boolean', label: '判断题' },
    { id: 'fill', label: '填空题' },
    { id: 'short', label: '简答题' },
  ];

  // 初始化题库ID
  useEffect(() => {
    if (bankIdFromUrl) {
      setSelectedBankId(parseInt(bankIdFromUrl, 10));
    } else if (currentBankId) {
      setSelectedBankId(currentBankId);
    }
  }, [bankIdFromUrl, currentBankId]);

  // 页面加载时恢复草稿
  useEffect(() => {
    const restoreDraft = async () => {
      try {
        const draft = await loadDraft();
        if (draft) {
          setActiveTab(draft.type || 'single');
          setFormData(prev => ({
            ...prev,
            content: draft.content || '',
            options: draft.options || prev.options,
            answer: draft.answer || '',
            answers: draft.answers || [],
            fillAnswers: draft.fillAnswers || [],
            analysis: draft.analysis || '',
          }));
          setDraftLoaded(true);
          // 3秒后隐藏提示
          setTimeout(() => setDraftLoaded(false), 3000);
        }
      } catch (err) {
        console.error('恢复草稿失败:', err);
      }
    };
    restoreDraft();
  }, []);

  // 计算填空题中的空栏数量
  const blankCount = useMemo(() => {
    return countFillBlanks(formData.content);
  }, [formData.content]);

  // 当空栏数量变化时，调整答案数组
  useEffect(() => {
    if (activeTab === 'fill') {
      setFormData(prev => {
        const newFillAnswers = [...prev.fillAnswers];
        // 如果空栏数量增加，添加空字符串
        while (newFillAnswers.length < blankCount) {
          newFillAnswers.push('');
        }
        // 如果空栏数量减少，截断数组
        if (newFillAnswers.length > blankCount) {
          newFillAnswers.length = blankCount;
        }
        return { ...prev, fillAnswers: newFillAnswers };
      });
    }
  }, [blankCount, activeTab]);

  const handleTabChange = (id: QuestionType) => {
    setActiveTab(id);
    setErrors([]);
    // Reset form state tailored to type
    setFormData(prev => ({ 
      ...prev, 
      answer: '', 
      answers: [],
      fillAnswers: [],
    }));
  };

  const addOption = () => {
    if (formData.options.length >= 8) return; // 最多8个选项
    const nextId = String.fromCharCode(65 + formData.options.length);
    setFormData({
      ...formData,
      options: [...formData.options, { id: nextId, text: '' }]
    });
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return;
    const removedId = formData.options[index].id;
    const newOptions = formData.options.filter((_, i) => i !== index);
    // Re-index options
    const reindexed = newOptions.map((opt, i) => ({ ...opt, id: String.fromCharCode(65 + i) }));
    
    // 更新答案，移除被删除的选项
    let newAnswer = formData.answer;
    let newAnswers = formData.answers;
    
    if (activeTab === 'single' && formData.answer === removedId) {
      newAnswer = '';
    }
    if (activeTab === 'multiple') {
      newAnswers = formData.answers.filter(a => a !== removedId);
      // 重新映射答案ID
      newAnswers = newAnswers.map(a => {
        const oldIndex = a.charCodeAt(0) - 65;
        if (oldIndex > index) {
          return String.fromCharCode(oldIndex - 1 + 65);
        }
        return a;
      });
    }
    
    setFormData({ ...formData, options: reindexed, answer: newAnswer, answers: newAnswers });
  };

  const updateOption = (index: number, text: string) => {
    const newOptions = [...formData.options];
    newOptions[index].text = text;
    setFormData({ ...formData, options: newOptions });
  };

  const toggleMultipleAnswer = (id: string) => {
    const current = formData.answers;
    if (current.includes(id)) {
      setFormData({ ...formData, answers: current.filter(a => a !== id) });
    } else {
      setFormData({ ...formData, answers: [...current, id].sort() });
    }
  };

  const insertBlank = () => {
    setFormData({
      ...formData,
      content: formData.content + ' ___ '
    });
  };

  const updateFillAnswer = (index: number, value: string) => {
    const newFillAnswers = [...formData.fillAnswers];
    newFillAnswers[index] = value;
    setFormData({ ...formData, fillAnswers: newFillAnswers });
  };

  // 验证表单
  const validateForm = () => {
    const newErrors: string[] = [];

    // 验证题库选择
    if (!selectedBankId) {
      newErrors.push('请选择题库');
    }

    // 验证题干
    if (!formData.content || formData.content.trim() === '') {
      newErrors.push('题干内容不能为空');
    }

    // 根据题型验证
    switch (activeTab) {
      case 'single':
        // 验证选项
        const validSingleOptions = formData.options.filter(opt => opt.text.trim() !== '');
        if (validSingleOptions.length < 2) {
          newErrors.push('单选题至少需要2个有效选项');
        }
        // 验证答案
        if (!formData.answer) {
          newErrors.push('请选择正确答案');
        }
        break;
        
      case 'multiple':
        // 验证选项
        const validMultiOptions = formData.options.filter(opt => opt.text.trim() !== '');
        if (validMultiOptions.length < 2) {
          newErrors.push('多选题至少需要2个有效选项');
        }
        // 验证答案
        if (formData.answers.length === 0) {
          newErrors.push('请选择至少一个正确答案');
        }
        break;
        
      case 'boolean':
        if (!formData.answer) {
          newErrors.push('请选择正确答案');
        }
        break;
        
      case 'fill':
        if (blankCount === 0) {
          newErrors.push('填空题题干中必须包含至少一个空栏标记（_、___、＿＿、（ ）或( )）');
        }
        // 验证每个空的答案
        const emptyFillAnswers = formData.fillAnswers.filter((a, i) => i < blankCount && (!a || a.trim() === ''));
        if (emptyFillAnswers.length > 0) {
          newErrors.push('请填写所有空栏的答案');
        }
        break;
        
      case 'short':
        // 简答题答案可选
        break;
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // 构建提交数据
  const buildSubmitData = (): ManualEntrySubmitData => {
    if (selectedBankId === null) {
      throw new Error('请选择题库');
    }

    const data: ManualEntrySubmitData = {
      bankId: selectedBankId,
      type: activeTab,
      content: formData.content.trim(),
      answer: '',
      analysis: formData.analysis.trim() || null,
    };

    switch (activeTab) {
      case 'single':
        data.options = formData.options.filter(opt => opt.text.trim() !== '');
        data.answer = formData.answer;
        break;
        
      case 'multiple':
        data.options = formData.options.filter(opt => opt.text.trim() !== '');
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

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    setErrors([]);
    
    try {
      const data = buildSubmitData();
      await addQuestion(data);
      
      // 清除草稿
      await clearDraft();
      
      // 显示成功提示
      setSubmitSuccess(true);
      
      // 重置表单
      setFormData(initialFormData());
      
      // 3秒后隐藏成功提示
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setErrors([errorMessage(err, '提交失败，请重试')]);
    } finally {
      setSubmitting(false);
    }
  };

  // 保存草稿
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
      // 显示保存成功提示
      alert('草稿保存成功');
    } catch (err) {
      setErrors([errorMessage(err, '保存草稿失败')]);
    } finally {
      setSavingDraft(false);
    }
  };

  // 返回题库
  const handleBack = () => {
    navigate('/question-preview');
  };

  const selectedBank = banks.find(bank => bank.id === selectedBankId);
  const currentQuestionType = questionTypes.find(type => type.id === activeTab);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="手动录入"
        subtitle="创建新题目到题库中"
        actions={(
          <ActionButton variant="secondary" icon={ArrowLeft} onClick={handleBack}>
            返回题库
          </ActionButton>
        )}
      />

      {/* 草稿恢复提示 */}
      {draftLoaded && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <AlertBanner type="info">已恢复上次保存的草稿</AlertBanner>
        </motion.div>
      )}

      {/* 成功提示 */}
      {submitSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <AlertBanner type="success" title="题目提交成功">已清除草稿，可以继续录入下一题。</AlertBanner>
        </motion.div>
      )}

      {/* 错误提示 */}
      {errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertBanner type="danger" title="请检查以下内容">
            <div className="space-y-1">
              {errors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          </AlertBanner>
        </motion.div>
      )}

      {/* 题库选择 */}
      <ToolbarCard className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
        <Field label="选择题库" required hint="题目会保存到当前选择的题库中">
          <SelectInput
            value={selectedBankId || ''}
            onChange={(e) => setSelectedBankId(e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            <option value="">请选择题库</option>
            {banks.map(bank => (
              <option key={bank.id} value={bank.id}>{bank.name}</option>
            ))}
          </SelectInput>
        </Field>
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-300">
          <p className="font-semibold text-gray-900 dark:text-white">{selectedBank ? selectedBank.name : '尚未选择题库'}</p>
          <p className="mt-1">当前题型：{currentQuestionType?.label || '单选题'}</p>
        </div>
      </ToolbarCard>

      <SurfaceCard className="overflow-hidden" padding="p-0">
        {/* Type Tabs */}
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedTabs tabs={questionTypes} value={activeTab} onChange={handleTabChange} className="max-w-full overflow-x-auto" />
          <StatusBadge variant={activeTab === 'fill' && blankCount > 0 ? 'success' : 'primary'}>
            {activeTab === 'fill' ? `空栏 ${blankCount} 个` : currentQuestionType?.label}
          </StatusBadge>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-7">
            {/* Question Content */}
            <Field label="题目内容" required hint={activeTab === 'fill' && blankCount > 0 ? `已插入 ${blankCount} 个空栏` : undefined}>
              <div className="relative">
                <TextareaInput
                  rows={5}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="min-h-[150px] pr-28"
                  placeholder="在此输入题干内容..."
                />
                {activeTab === 'fill' && (
                  <ActionButton
                    size="sm"
                    variant="secondary"
                    onClick={insertBlank}
                    className="absolute bottom-4 right-4 h-9 px-3"
                  >
                    插入空栏
                  </ActionButton>
                )}
              </div>
            </Field>

            {/* Options Area */}
            {(activeTab === 'single' || activeTab === 'multiple') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Field label="选项设置" required className="space-y-0" />
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    icon={Plus}
                    onClick={addOption}
                    disabled={formData.options.length >= 8}
                  >
                    添加选项
                  </ActionButton>
                </div>
                <div className="space-y-3">
                  {formData.options.map((option, index) => (
                    <motion.div
                      layout
                      key={index}
                      className="group grid grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-3 transition-colors hover:border-blue-100 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-700/40 sm:grid-cols-[36px_minmax(0,1fr)_110px_40px]"
                    >
                      <div className="flex size-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-primary shadow-sm dark:bg-gray-800">
                        {option.id}
                      </div>
                      <TextInput
                        value={option.text}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`选项 ${option.id}`}
                      />

                      {/* Answer Selection Check/Radio */}
                      <button
                        type="button"
                        onClick={() => activeTab === 'single' ? setFormData({ ...formData, answer: option.id }) : toggleMultipleAnswer(option.id)}
                        className={cn(
                          "col-start-2 rounded-control border px-3 py-2 text-sm font-semibold transition-colors sm:col-start-auto",
                          (activeTab === 'single' ? formData.answer === option.id : formData.answers.includes(option.id))
                            ? "border-green-200 bg-green-50 text-success dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
                            : "border-transparent bg-white text-gray-400 hover:bg-blue-50 hover:text-primary dark:bg-gray-800 dark:hover:bg-gray-700"
                        )}
                      >
                        {(activeTab === 'single' ? formData.answer === option.id : formData.answers.includes(option.id)) ? '正确答案' : '设为答案'}
                      </button>

                      <IconButton
                        label="删除选项"
                        icon={Trash2}
                        onClick={() => removeOption(index)}
                        disabled={formData.options.length <= 2}
                        className="col-start-1 row-start-2 text-gray-400 hover:bg-red-50 hover:text-danger disabled:opacity-30 sm:col-start-auto sm:row-start-auto"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* True/False Specific */}
            {activeTab === 'boolean' && (
              <Field label="正确答案" required>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['正确', '错误'].map((val) => (
                    <label
                      key={val}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-semibold transition-all",
                        formData.answer === val
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      )}
                    >
                      <span className={cn(
                        "flex size-5 items-center justify-center rounded-full border-2 transition-colors",
                        formData.answer === val ? "border-primary bg-primary" : "border-gray-300"
                      )}>
                        {formData.answer === val && <span className="size-2 rounded-full bg-white" />}
                      </span>
                      <input
                        type="radio"
                        className="sr-only"
                        checked={formData.answer === val}
                        onChange={() => setFormData({ ...formData, answer: val })}
                      />
                      {val}
                    </label>
                  ))}
                </div>
              </Field>
            )}

            {/* Fill In Blank Specific - 动态答案输入框 */}
            {activeTab === 'fill' && (
              <Field label="答案设置" required>
                {blankCount === 0 ? (
                  <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                    请在题干中插入空栏标记（点击“插入空栏”按钮）
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from({ length: blankCount }).map((_, index) => (
                      <div key={index} className="grid gap-3 sm:grid-cols-[80px_minmax(0,1fr)] sm:items-center">
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                          第 {index + 1} 空
                        </span>
                        <TextInput
                          value={formData.fillAnswers[index] || ''}
                          onChange={(e) => updateFillAnswer(index, e.target.value)}
                          placeholder={`请输入第 ${index + 1} 空的答案`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            )}

            {/* Short Answer Specific */}
            {activeTab === 'short' && (
              <Field label="参考答案" hint="简答题答案可选，可在这里写入参考要点">
                <TextareaInput
                  rows={4}
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  className="min-h-[120px]"
                  placeholder="输入参考答案（可选）..."
                />
              </Field>
            )}

            {/* Analysis */}
            <Field label="解析说明" hint="可补充解题思路、易错点或知识点说明">
              <TextareaInput
                rows={4}
                value={formData.analysis}
                onChange={(e) => setFormData({ ...formData, analysis: e.target.value })}
                className="min-h-[120px]"
                placeholder="输入答案解析..."
              />
            </Field>
          </div>

          <aside className="space-y-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800">
            <div className="ui-icon-tile size-12 bg-white text-primary shadow-sm dark:bg-gray-700">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">录入检查</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                保存前请确认题库、题干和答案信息，系统会按当前题型自动校验必填项。
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-gray-700">
                <span className="text-gray-500 dark:text-gray-300">题库</span>
                <span className="max-w-[140px] truncate font-semibold text-gray-900 dark:text-white">{selectedBank?.name || '未选择'}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-gray-700">
                <span className="text-gray-500 dark:text-gray-300">题型</span>
                <span className="font-semibold text-primary">{currentQuestionType?.label}</span>
              </div>
              {(activeTab === 'single' || activeTab === 'multiple') && (
                <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-gray-700">
                  <span className="text-gray-500 dark:text-gray-300">选项</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formData.options.length} 个</span>
                </div>
              )}
              {activeTab === 'fill' && (
                <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-gray-700">
                  <span className="text-gray-500 dark:text-gray-300">空栏</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{blankCount} 个</span>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-end">
          <ActionButton
            variant="secondary"
            icon={Save}
            onClick={handleSaveDraft}
            disabled={savingDraft}
            loading={savingDraft}
          >
            {savingDraft ? '保存中...' : '保存草稿'}
          </ActionButton>
          <ActionButton
            icon={Send}
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
          >
            {submitting ? '提交中...' : '立即提交'}
          </ActionButton>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default ManualEntry;
