import type { MouseEvent, RefObject } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ChatHistory } from '../../../api';

type ChatHistoryPanelProps = {
  panelRef: RefObject<HTMLDivElement>;
  show: boolean;
  onToggle: () => void;
  historyList: ChatHistory[];
  currentChatId: number | null;
  onLoad: (chatId: number) => void;
  onDelete: (chatId: number, e: MouseEvent<HTMLButtonElement>) => void;
  onNew: () => void;
};

const ChatHistoryPanel = ({
  panelRef,
  show,
  onToggle,
  historyList,
  currentChatId,
  onLoad,
  onDelete,
  onNew,
}: ChatHistoryPanelProps) => (
  <div className="relative" ref={panelRef}>
    <button
      onClick={onToggle}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-blue-50 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
    >
      历史记录
    </button>
    {show && (
      <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-popover dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-700">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">历史对话</span>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Plus size={14} />
            新对话
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {historyList.length === 0 ? (
            <div className="p-5 text-center text-sm text-gray-400">暂无历史记录</div>
          ) : (
            historyList.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onLoad(chat.id)}
                className={cn(
                  'group flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors',
                  currentChatId === chat.id
                    ? 'bg-primary-soft'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700',
                )}
              >
                <p
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm font-semibold',
                    currentChatId === chat.id ? 'text-primary' : 'text-gray-600 dark:text-gray-300',
                  )}
                >
                  {chat.title}
                </p>
                <button
                  onClick={(e) => onDelete(chat.id, e)}
                  className="rounded-lg p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-danger group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    )}
  </div>
);

export default ChatHistoryPanel;
