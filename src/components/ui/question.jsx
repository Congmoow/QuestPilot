import React from 'react';
import { ArrowRight, CalendarDays, Edit3, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ActionButton, IconButton, SurfaceCard, StatusBadge } from './base';

const typeVariants = {
  single: 'primary',
  multiple: 'success',
  boolean: 'orange',
  fill: 'purple',
  short: 'muted',
};

const practiceTones = [
  'from-blue-50 to-sky-100 text-blue-600',
  'from-violet-50 to-purple-100 text-violet-600',
  'from-emerald-50 to-green-100 text-emerald-600',
  'from-orange-50 to-amber-100 text-orange-600',
  'from-cyan-50 to-blue-100 text-cyan-600',
];

const QB_ICONS = [
  '/questionbank-icons/QBicon1.png',
  '/questionbank-icons/QBicon2.png',
  '/questionbank-icons/QBicon3.png',
  '/questionbank-icons/QBicon4.png',
  '/questionbank-icons/QBicon5.png',
  '/questionbank-icons/QBicon6.png',
  '/questionbank-icons/QBicon7.png',
];

const getRandomIcon = (bankId) => {
  const seed = bankId ? bankId * 9301 + 49297 : Date.now();
  const index = seed % QB_ICONS.length;
  return QB_ICONS[index];
};

export function QuestionBankCard({ bank, icon: Icon, onClick, onEdit, onDelete, formatDate, toneClass = 'bg-blue-50 text-primary' }) {
  const iconSrc = getRandomIcon(bank.id);

  return (
    <SurfaceCard hover as="article" className="group cursor-pointer overflow-hidden" padding="p-0" onClick={onClick}>
      <div className="flex items-start gap-4">
        <div className="size-[88px] shrink-0">
          <img src={iconSrc} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 py-5 pr-5">
          <h3 className="line-clamp-2 text-sm font-extrabold leading-5 text-gray-900 dark:text-white">{bank.name}</h3>
          <p className="mt-1 text-xs font-semibold text-primary">{bank.questionCount || 0} 道题目</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[36px] px-5 text-xs leading-5 text-gray-500 dark:text-gray-400">{bank.description || '暂无描述'}</p>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 px-5 pt-3 dark:border-gray-700">
        <span className="inline-flex items-center gap-2 text-xs text-gray-400">
          <CalendarDays size={13} />
          创建于 {formatDate ? formatDate(bank.createdAt) : bank.createdAt}
        </span>
        <div className="flex items-center gap-2">
          <IconButton label="编辑题库" icon={Edit3} onClick={onEdit} />
          <IconButton label="删除题库" icon={Trash2} onClick={onDelete} className="hover:bg-red-50 hover:text-danger dark:hover:bg-red-900/20" />
        </div>
      </div>
    </SurfaceCard>
  );
}

export function PracticeCard({ bank, icon: Icon, index = 0, selected = false, onSelect, onStart }) {
  const iconSrc = getRandomIcon(bank.id);

  return (
    <SurfaceCard hover as="article" className={cn('group cursor-pointer overflow-hidden', selected && 'ring-2 ring-primary/30')} padding="p-0" onClick={onSelect}>
      <div className="flex items-center gap-4">
        <div className="size-[88px] shrink-0">
          <img src={iconSrc} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 py-5 pr-5">
          <h3 className="line-clamp-2 text-sm font-extrabold text-gray-900 dark:text-white">{bank.name}</h3>
          <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{bank.questionCount || 0} 道题目</p>
        </div>
      </div>
      <div className="mx-5 mb-5 mt-3 flex items-center gap-3 rounded-2xl bg-blue-50 p-2 dark:bg-gray-700">
        <button
          type="button"
          onClick={onStart}
          className="flex-1 rounded-xl px-4 py-2.5 text-left text-sm font-bold text-primary transition-colors hover:bg-white dark:hover:bg-gray-800"
        >
          开始练习
        </button>
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-gray-800">
          <ArrowRight size={18} />
        </span>
      </div>
    </SurfaceCard>
  );
}

export function QuestionCard({ children, selected = false, className }) {
  return (
    <SurfaceCard className={cn(selected && 'ring-2 ring-primary/25', className)} padding="p-6">
      {children}
    </SurfaceCard>
  );
}

export function QuizShell({ current, total, children, actions, className }) {
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className={cn('mx-auto max-w-3xl space-y-5', className)}>
      <div>
        <div className="mb-2 flex justify-between text-sm font-semibold text-gray-500">
          <span>第 {current} 题 / 共 {total} 题</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-blue-100">
          <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <SurfaceCard padding="p-7">
        {children}
        {actions && <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-700">{actions}</div>}
      </SurfaceCard>
    </div>
  );
}

export function AnswerOptionCard({ children, state = 'default', onClick, disabled }) {
  const stateClass = {
    default: 'border-gray-200 bg-white hover:border-primary hover:bg-blue-50/60 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700',
    selected: 'border-primary bg-primary-soft text-primary',
    correct: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300',
    wrong: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('w-full rounded-2xl border p-4 text-left transition-all active:scale-[0.99] disabled:cursor-default', stateClass[state] || stateClass.default)}
    >
      {children}
    </button>
  );
}

export function ResultSummary({ title, subtitle, stats, score, actions, icon: Icon }) {
  return (
    <SurfaceCard className="mx-auto max-w-2xl text-center" padding="p-8">
      {Icon && (
        <div className="ui-icon-tile mx-auto mb-6 size-20 bg-primary-soft text-primary">
          <Icon size={38} />
        </div>
      )}
      <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">{title}</h2>
      {subtitle && <p className="mt-2 text-gray-500 dark:text-gray-400">{subtitle}</p>}
      <div className="my-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className={cn('rounded-2xl p-4', item.className || 'bg-gray-50 dark:bg-gray-700')}>
            <p className="text-3xl font-extrabold">{item.value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
          </div>
        ))}
      </div>
      {score != null && (
        <div className="mb-8">
          <p className="text-6xl font-extrabold text-primary">{score}%</p>
          <p className="mt-2 text-gray-500">正确率</p>
        </div>
      )}
      {actions && <div className="flex flex-wrap justify-center gap-3">{actions}</div>}
    </SurfaceCard>
  );
}

export function Pagination({ page, totalPages, onPageChange, className }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <ActionButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一页</ActionButton>
      <span className="px-3 text-sm font-semibold text-gray-500">{page} / {totalPages}</span>
      <ActionButton variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页</ActionButton>
    </div>
  );
}

export function TypeBadge({ type, label }) {
  return <StatusBadge variant={typeVariants[type] || 'muted'}>{label}</StatusBadge>;
}
