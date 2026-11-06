import { Skeleton, SkeletonText } from "@/components/ui";

// Recall pages: a heading, then two cards.
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading the recall" className="flex flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6 sm:p-8">
            <Skeleton className="h-4 w-32" />
            <SkeletonText lines={2} />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="size-40" />
          </div>
        ))}
      </div>
    </main>
  );
}
