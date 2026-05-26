import { Edit, Trash2 } from 'lucide-react';
import type { Question, QuestionType } from '../../api';
import CodeAwareText from '../CodeAwareText';
import { cn } from '../../lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from './sheet';
import { ScrollArea } from './scroll-area';
import { StatusBadge } from './base';
import { ActionButton } from './base';

const typeMap: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题',
};

const typeVariants: Record<QuestionType, 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'purple' | 'orange'> = {
  single: 'primary',
  multiple: 'success',
  boolean: 'orange',
  fill: 'purple',
  short: 'muted',
};

type QuestionDetailSheetProps = {
  question: Question | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (question: Question) => void;
  onDelete?: (id: number) => void;
};

export function QuestionDetailSheet({
  question,
  open,
  onClose,
  onEdit,
  onDelete,
}: QuestionDetailSheetProps) {
  if (!question) return null;

  const typeLabel = typeMap[question.type] ?? question.type;
  const typeVariant = typeVariants[question.type] ?? 'muted';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width="w-[520px] max-w-full">
        <SheetHeader>
          <div className="flex items-center gap-3 pr-10">
            <StatusBadge variant={typeVariant}>{typeLabel}</StatusBadge>
            <SheetTitle className="min-w-0 flex-1 truncate text-sm">题目详情</SheetTitle>
          </div>
          <SheetDescription>
            创建于 {question.createdAt ? new Date(question.createdAt).toLocaleString('zh-CN') : '—'}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="px-0 py-0">
          <ScrollArea className="h-full">
            <div className="space-y-5 px-6 py-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">题干</p>
                <div className="text-sm font-semibold leading-8 text-gray-900 dark:text-gray-100">
                  <CodeAwareText text={question.content} />
                </div>
              </div>

              {question.options && question.options.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">选项</p>
                  <div className="grid gap-2.5">
                    {question.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-sm',
                          question.answer?.includes(opt.id)
                            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                            : 'border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                        )}
                      >
                        <div className="flex gap-2">
                          <span className="shrink-0 font-bold">{opt.id}.</span>
                          <CodeAwareText
                            text={opt.text}
                            className="min-w-0 flex-1 bg-transparent p-0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-green-50 px-4 py-3 dark:bg-green-900/20">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">答案</p>
                <p className="text-sm font-bold text-green-700 dark:text-green-300">
                  {question.answer}
                </p>
              </div>

              {question.analysis && (
                <div className="rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">解析</p>
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    <CodeAwareText text={question.analysis} className="bg-transparent p-0" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetBody>

        {(onEdit || onDelete) && (
          <SheetFooter>
            {onDelete && (
              <ActionButton
                variant="danger"
                icon={Trash2}
                size="sm"
                onClick={() => onDelete(question.id)}
              >
                删除
              </ActionButton>
            )}
            {onEdit && (
              <ActionButton
                variant="secondary"
                icon={Edit}
                size="sm"
                onClick={() => onEdit(question)}
              >
                编辑
              </ActionButton>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
