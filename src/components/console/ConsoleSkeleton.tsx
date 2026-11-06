import { Skeleton } from "@/components/ui";

/** The claims page while it loads: heading, the four numbers, tabs and grid rows, in their real sizes. */
export function ConsoleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading claims" className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 rounded-card border border-line bg-surface lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 px-4 py-5 sm:px-6">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3.5 w-32 max-w-full" />
          </div>
        ))}
      </div>
      <div className="flex gap-6 border-b border-line pb-3">
        {["w-10", "w-12", "w-11", "w-16", "w-14"].map((w) => (
          <Skeleton key={w} className={`h-4 ${w}`} />
        ))}
      </div>
      <SkeletonGrid rows={10} />
    </div>
  );
}

export function SkeletonGrid({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex h-10 items-center gap-8 border-b border-line bg-surface-2 px-4">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="hidden h-3 w-24 sm:block" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-8 border-b border-line px-4 last:border-b-0">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="hidden h-3.5 w-24 sm:block" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="hidden h-3.5 flex-1 md:block" />
          <Skeleton className="ml-auto h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}
