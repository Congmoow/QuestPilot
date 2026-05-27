import { Skeleton } from './skeleton';
import { SurfaceCard, ToolbarCard } from './base';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <ToolbarCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Skeleton className="h-10 w-full lg:max-w-md" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-40" />
        </div>
      </ToolbarCard>

      <SurfaceCard padding="px-5 py-4">
        <Skeleton className="h-5 w-24" />
      </SurfaceCard>

      <div className="grid gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <SurfaceCard key={i} padding="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="mt-1 size-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="ml-auto h-4 w-32" />
                </div>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-12 w-full rounded-2xl" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
                <Skeleton className="h-10 w-full rounded-2xl" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="size-10 rounded-xl" />
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
