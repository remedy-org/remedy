import { InsightsSkeleton } from "@/components/insights/InsightsSkeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main className="flex h-[calc(100dvh-6.375rem)] flex-col sm:h-[calc(100dvh-3.5rem-1px)] lg:min-h-[36rem]">
      <div className="flex flex-col gap-3 border-b border-line px-4 pt-6 pb-4 sm:px-6 lg:px-8" aria-hidden="true">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-7 w-80 max-w-full" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </div>
      <div className="min-h-0 flex-1">
        <InsightsSkeleton />
      </div>
    </main>
  );
}
