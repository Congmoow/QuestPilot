import { BookOpen } from 'lucide-react';
import type { QuestionType } from '../../../api';
import type { QuestionTypeTab } from '../hooks/useManualEntryForm';

type CheckSidebarProps = {
  selectedBankName: string | undefined;
  currentQuestionType: QuestionTypeTab | undefined;
  activeTab: QuestionType;
  optionCount: number;
  blankCount: number;
};

const CheckSidebar = ({
  selectedBankName,
  currentQuestionType,
  activeTab,
  optionCount,
  blankCount,
}: CheckSidebarProps) => (
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
        <span className="max-w-[140px] truncate font-semibold text-gray-900 dark:text-white">
          {selectedBankName || '未选择'}
        </span>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-gray-700">
        <span className="text-gray-500 dark:text-gray-300">题型</span>
        <span className="font-semibold text-primary">{currentQuestionType?.label}</span>
      </div>
      {(activeTab === 'single' || activeTab === 'multiple') && (
        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-gray-700">
          <span className="text-gray-500 dark:text-gray-300">选项</span>
          <span className="font-semibold text-gray-900 dark:text-white">{optionCount} 个</span>
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
);

export default CheckSidebar;
