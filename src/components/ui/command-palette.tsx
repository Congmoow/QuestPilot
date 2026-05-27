import { useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  BookOpen,
  Brain,
  FileText,
  MessageSquare,
  Settings,
  Upload,
  Wand2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

const NAV_ITEMS = [
  { path: '/dashboard', label: '首页', description: '查看统计数据与操作日志', icon: BarChart2 },
  { path: '/question-preview', label: '题库预览', description: '浏览和管理题目', icon: BookOpen },
  { path: '/practice', label: '随机练题', description: '开始随机刷题练习', icon: Brain },
  { path: '/wrong-book', label: '错题本', description: '复习做错的题目', icon: FileText },
  { path: '/ai-import', label: 'AI 智能录入', description: 'AI 解析题目并批量导入', icon: Wand2 },
  { path: '/manual-entry', label: '手动录入', description: '手动添加单道题目', icon: Upload },
  { path: '/ai-chat', label: 'AI 问答', description: '与 AI 进行题目问答', icon: MessageSquare },
  { path: '/settings', label: '系统设置', description: '配置 AI 与应用偏好', icon: Settings },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path);
      onClose();
    },
    [navigate, onClose],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm',
            'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2',
            'overflow-hidden rounded-card border border-gray-200 bg-white shadow-popover',
            'dark:border-gray-700 dark:bg-gray-800',
            'data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-fade-out',
          )}
          aria-label="命令面板"
        >
          <DialogPrimitive.Title className="sr-only">命令面板</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            搜索并快速导航到任意页面
          </DialogPrimitive.Description>

          <Command className="flex flex-col" shouldFilter>
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-700">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-gray-400"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <Command.Input
                placeholder="搜索页面或功能..."
                className={cn(
                  'h-14 flex-1 bg-transparent text-sm font-medium text-gray-900 placeholder:text-gray-400',
                  'outline-none dark:text-white',
                )}
              />
              <kbd className="hidden rounded-lg border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-400 sm:block">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                没有找到匹配的页面
              </Command.Empty>

              <Command.Group
                heading="页面导航"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-gray-400"
              >
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.path}
                      value={`${item.label} ${item.description}`}
                      onSelect={() => handleSelect(item.path)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5',
                        'text-sm transition-colors',
                        'aria-selected:bg-primary-soft aria-selected:text-primary',
                        'hover:bg-gray-50 dark:hover:bg-gray-700',
                        'dark:aria-selected:bg-primary/20 dark:aria-selected:text-primary',
                      )}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white">{item.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>

            <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2.5 dark:border-gray-700">
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[11px] dark:border-gray-700 dark:bg-gray-700">
                  ↑↓
                </kbd>
                导航
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[11px] dark:border-gray-700 dark:bg-gray-700">
                  ↵
                </kbd>
                打开
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[11px] dark:border-gray-700 dark:bg-gray-700">
                  ESC
                </kbd>
                关闭
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
