import { Skeleton } from './skeleton';
import { SurfaceCard } from './base';

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SurfaceCard key={i} padding="p-0">
          <div className="flex items-start gap-4">
            <Skeleton className="size-[72px] shrink-0 rounded-l-card rounded-r-none" />
            <div className="min-w-0 flex-1 py-4 pr-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="px-5 py-3 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-700">
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-2">
              <Skeleton className="size-8 rounded-xl" />
              <Skeleton className="size-8 rounded-xl" />
            </div>
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}

export function ParseResultSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-16 rounded-lg" />
                <Skeleton className="h-4 w-6 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-9 shrink-0 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
