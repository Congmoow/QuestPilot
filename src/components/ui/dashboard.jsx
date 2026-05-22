import React from 'react';
import { ArrowUpRight, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SurfaceCard, StatusBadge } from './base';

const toneMap = {
  blue: 'from-blue-500 to-blue-600 text-white shadow-blue-500/25',
  green: 'from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25',
  orange: 'from-orange-400 to-orange-500 text-white shadow-orange-500/25',
  purple: 'from-violet-500 to-violet-600 text-white shadow-violet-500/25',
};

export function StatCard({ title, value, trend, icon: Icon, tone = 'blue' }) {
  return (
    <SurfaceCard hover className="min-h-[140px]" padding="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-3 text-4xl font-extrabold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-success">
              <span className="text-gray-400">{trend.label}</span>
              {trend.value}
              <ArrowUpRight size={15} />
            </p>
          )}
        </div>
        <div className={cn('ui-icon-tile size-16 bg-gradient-to-br shadow-lg', toneMap[tone] || toneMap.blue)}>
          {Icon && <Icon size={30} strokeWidth={1.8} />}
        </div>
      </div>
    </SurfaceCard>
  );
}

export function ChartCard({ title, icon: Icon, action, children, className }) {
  return (
    <SurfaceCard className={className} padding="p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon size={20} className="text-primary" />}
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </SurfaceCard>
  );
}

export function TimelineLog({ logs, formatTime, emptyText = '暂无操作记录', className }) {
  const getVariant = (action = '') => {
    if (action.includes('删除')) return 'danger';
    if (action.includes('添加') || action.includes('新增')) return 'success';
    if (action.includes('更新') || action.includes('更改')) return 'primary';
    return 'muted';
  };

  if (!logs || logs.length === 0) {
    return (
      <div className={cn('flex min-h-[220px] flex-col items-center justify-center text-center text-gray-400', className)}>
        <Clock size={34} className="mb-3 opacity-60" />
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {logs.map((log, index) => (
        <div key={log.id || index} className="flex gap-3">
          <div className="flex flex-col items-center pt-2">
            <span className={cn('size-2.5 rounded-full', getVariant(log.action) === 'success' ? 'bg-success' : getVariant(log.action) === 'danger' ? 'bg-danger' : 'bg-primary')} />
            {index < logs.length - 1 && <span className="mt-2 h-full min-h-11 w-px bg-gray-200 dark:bg-gray-700" />}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <div className="flex items-start justify-between gap-3">
              <StatusBadge variant={getVariant(log.action)}>{log.action}</StatusBadge>
              <span className="shrink-0 text-xs text-gray-400">{formatTime ? formatTime(log.createdAt) : log.createdAt}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{log.detail || '无详细信息'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
