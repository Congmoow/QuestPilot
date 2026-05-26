import type { RefObject } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Prompt } from '../../../api';

type PromptSelectorProps = {
  panelRef: RefObject<HTMLDivElement>;
  prompts: Prompt[];
  selectedPrompt: Prompt | null;
  showDropdown: boolean;
  onToggle: () => void;
  onSelect: (prompt: Prompt) => void;
};

const PromptSelector = ({
  panelRef,
  prompts,
  selectedPrompt,
  showDropdown,
  onToggle,
  onSelect,
}: PromptSelectorProps) => (
  <div className="relative" ref={panelRef}>
    <button
      onClick={onToggle}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-blue-50 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
    >
      {selectedPrompt?.name || '智能模型 Pro'}
      <ChevronDown
        size={14}
        className={cn('text-gray-400 transition-transform', showDropdown && 'rotate-180')}
      />
    </button>
    {showDropdown && (
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-gray-100 bg-white p-2 shadow-popover dark:border-gray-700 dark:bg-gray-800">
        {prompts.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onSelect(prompt)}
            className={cn(
              'w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors',
              selectedPrompt?.id === prompt.id
                ? 'bg-primary-soft text-primary'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700',
            )}
          >
            {prompt.name}
            {prompt.isDefault && <span className="ml-2 text-xs text-gray-400">(默认)</span>}
          </button>
        ))}
      </div>
    )}
  </div>
);

export default PromptSelector;
