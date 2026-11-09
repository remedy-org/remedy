import { InsightsSkeleton } from "@/components/insights/InsightsSkeleton";
import { Skeleton } from "@/components/ui";

// The page while its claims load, laid out as the page: the recall's title and its line, then the report's skeleton.
export default function Loading() {
  return (
    <main className="flex flex-col pb-8">
      <div className="page flex flex-col gap-2.5 pt-8 pb-5" aria-hidden="true">
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="hidden sm:block">
        <InsightsSkeleton />
      </div>
    </main>
  );
}
