import React from 'react';
import { Save, Send, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import {
  ActionButton,
  AlertBanner,
  Field,
  PageHeader,
  SegmentedTabs,
  SelectInput,
  StatusBadge,
  SurfaceCard,
  TextareaInput,
  ToolbarCard,
} from '../components/ui';
import CheckSidebar from '../features/questions/components/CheckSidebar';
import FillBlankAnswers from '../features/questions/components/FillBlankAnswers';
import OptionList from '../features/questions/components/OptionList';
import { questionTypes, useManualEntryForm } from '../features/questions/hooks/useManualEntryForm';

const ManualEntry = () => {
  const {
    banks,
    selectedBankId, setSelectedBankId,
    activeTab,
    formData, setFormData,
    errors,
    submitting, submitSuccess,
    savingDraft, draftLoaded,
    blankCount,
    selectedBank, currentQuestionType,
    handleTabChange,
    addOption, removeOption, updateOption, toggleMultipleAnswer,
    insertBlank, updateFillAnswer,
    handleSubmit, handleSaveDraft, handleBack,
  } = useManualEntryForm();

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

      {draftLoaded && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <AlertBanner type="info">已恢复上次保存的草稿</AlertBanner>
        </motion.div>
      )}

      {submitSuccess && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <AlertBanner type="success" title="题目提交成功">已清除草稿，可以继续录入下一题。</AlertBanner>
        </motion.div>
      )}

      {errors.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <AlertBanner type="danger" title="请检查以下内容">
            <div className="space-y-1">
              {errors.map((error, index) => <p key={index}>{error}</p>)}
            </div>
          </AlertBanner>
        </motion.div>
      )}

      <ToolbarCard className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
        <Field label="选择题库" required hint="题目会保存到当前选择的题库中">
          <SelectInput
            value={selectedBankId || ''}
            onChange={(e) => setSelectedBankId(e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            <option value="">请选择题库</option>
            {banks.map((bank) => (
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
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedTabs tabs={questionTypes} value={activeTab} onChange={handleTabChange} className="max-w-full overflow-x-auto" />
          <StatusBadge variant={activeTab === 'fill' && blankCount > 0 ? 'success' : 'primary'}>
            {activeTab === 'fill' ? `空栏 ${blankCount} 个` : currentQuestionType?.label}
          </StatusBadge>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-7">
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

            {(activeTab === 'single' || activeTab === 'multiple') && (
              <OptionList
                options={formData.options}
                activeTab={activeTab}
                answer={formData.answer}
                answers={formData.answers}
                onUpdateOption={updateOption}
                onRemoveOption={removeOption}
                onSelectAnswer={(id) => setFormData({ ...formData, answer: id })}
                onToggleMultiple={toggleMultipleAnswer}
                onAddOption={addOption}
              />
            )}

            {activeTab === 'boolean' && (
              <Field label="正确答案" required>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['正确', '错误'].map((val) => (
                    <label
                      key={val}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-semibold transition-all',
                        formData.answer === val
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      )}
                    >
                      <span className={cn(
                        'flex size-5 items-center justify-center rounded-full border-2 transition-colors',
                        formData.answer === val ? 'border-primary bg-primary' : 'border-gray-300'
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

            {activeTab === 'fill' && (
              <FillBlankAnswers
                blankCount={blankCount}
                fillAnswers={formData.fillAnswers}
                onUpdateFillAnswer={updateFillAnswer}
              />
            )}

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

          <CheckSidebar
            selectedBankName={selectedBank?.name}
            currentQuestionType={currentQuestionType}
            activeTab={activeTab}
            optionCount={formData.options.length}
            blankCount={blankCount}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-end">
          <ActionButton variant="secondary" icon={Save} onClick={handleSaveDraft} disabled={savingDraft} loading={savingDraft}>
            {savingDraft ? '保存中...' : '保存草稿'}
          </ActionButton>
          <ActionButton icon={Send} onClick={handleSubmit} disabled={submitting} loading={submitting}>
            {submitting ? '提交中...' : '立即提交'}
          </ActionButton>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default ManualEntry;
