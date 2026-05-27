import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { SurfaceCard, ToolbarCard } from './base';

type DataTableShellProps = {
  toolbar?: ReactNode;
  bulkActions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function DataTableShell({ toolbar, bulkActions, children, className }: DataTableShellProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {toolbar && <ToolbarCard>{toolbar}</ToolbarCard>}
      {bulkActions && (
        <SurfaceCard
          padding="px-5 py-3"
          className="border-primary/20 bg-primary-soft/50 dark:bg-primary/10"
        >
          {bulkActions}
        </SurfaceCard>
      )}
      {children}
    </div>
  );
}
