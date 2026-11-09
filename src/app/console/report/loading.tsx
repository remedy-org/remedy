import { Skeleton, SkeletonText } from "@/components/ui";

// The report sheet while the claims load.
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading the report" className="page flex flex-1 flex-col gap-6 py-8">
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-8 rounded-card border border-line bg-surface px-6 py-8 sm:px-12 sm:py-12">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-3/4" />
        <div className="grid grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
        <SkeletonText lines={6} />
      </div>
    </main>
  );
}
