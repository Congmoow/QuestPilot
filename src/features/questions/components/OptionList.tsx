import { Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import type { QuestionOption, QuestionType } from '../../../api';
import { ActionButton, Field, IconButton, TextInput } from '../../../components/ui';

type OptionListProps = {
  options: QuestionOption[];
  activeTab: QuestionType;
  answer: string;
  answers: string[];
  onUpdateOption: (index: number, text: string) => void;
  onRemoveOption: (index: number) => void;
  onSelectAnswer: (id: string) => void;
  onToggleMultiple: (id: string) => void;
  onAddOption: () => void;
};

const OptionList = ({
  options,
  activeTab,
  answer,
  answers,
  onUpdateOption,
  onRemoveOption,
  onSelectAnswer,
  onToggleMultiple,
  onAddOption,
}: OptionListProps) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <Field label="选项设置" required className="space-y-0" />
      <ActionButton
        variant="ghost"
        size="sm"
        icon={Plus}
        onClick={onAddOption}
        disabled={options.length >= 8}
      >
        添加选项
      </ActionButton>
    </div>
    <div className="space-y-3">
      {options.map((option, index) => {
        const isSelected =
          activeTab === 'single' ? answer === option.id : answers.includes(option.id);
        return (
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
              onChange={(e) => onUpdateOption(index, e.target.value)}
              placeholder={`选项 ${option.id}`}
            />
            <button
              type="button"
              onClick={() =>
                activeTab === 'single' ? onSelectAnswer(option.id) : onToggleMultiple(option.id)
              }
              className={cn(
                'col-start-2 rounded-control border px-3 py-2 text-sm font-semibold transition-colors sm:col-start-auto',
                isSelected
                  ? 'border-green-200 bg-green-50 text-success dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                  : 'border-transparent bg-white text-gray-400 hover:bg-blue-50 hover:text-primary dark:bg-gray-800 dark:hover:bg-gray-700',
              )}
            >
              {isSelected ? '正确答案' : '设为答案'}
            </button>
            <IconButton
              label="删除选项"
              icon={Trash2}
              onClick={() => onRemoveOption(index)}
              disabled={options.length <= 2}
              className="col-start-1 row-start-2 text-gray-400 hover:bg-red-50 hover:text-danger disabled:opacity-30 sm:col-start-auto sm:row-start-auto"
            />
          </motion.div>
        );
      })}
    </div>
  </div>
);

export default OptionList;
