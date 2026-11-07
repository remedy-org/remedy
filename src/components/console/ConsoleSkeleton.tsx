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

/**
 * The claims grid's footprint while it loads: its columns, a 40px header plus its 1px rule, and 44px rows (56px below
 * 720px, where the grid stacks the filing time under the claim id). A container query on the same 720px the grid measures keeps the
 * two layouts in step, so the grid replaces it without moving anything.
 */
export function SkeletonGrid({ rows }: { rows: number }) {
  const wide = "hidden shrink-0 px-4 @min-[720px]:block";
  return (
    <div aria-hidden="true" className="@container">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex h-[41px] items-center border-b border-line bg-surface-2">
          <span className="min-w-[116px] flex-1 px-4 @min-[720px]:w-[170px] @min-[720px]:flex-none">
            <Skeleton className="h-3 w-10" />
          </span>
          <span className={`${wide} w-[140px]`}>
            <Skeleton className="h-3 w-9" />
          </span>
          <span className={`${wide} w-[190px]`}>
            <Skeleton className="h-3 w-24" />
          </span>
          <span className="w-[116px] shrink-0 px-4 @min-[720px]:w-[130px]">
            <Skeleton className="h-3 w-14" />
          </span>
          <span className="hidden min-w-[220px] flex-1 px-4 @min-[720px]:block">
            <Skeleton className="h-3 w-12" />
          </span>
          <span className={`${wide} w-[120px]`}>
            <Skeleton className="h-3 w-12" />
          </span>
          <span className="flex w-[84px] shrink-0 justify-end px-4 @min-[720px]:w-[110px]">
            <Skeleton className="h-3 w-12" />
          </span>
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-14 items-center border-b border-line last:border-b-0 @min-[720px]:h-11">
            <span className="flex min-w-[116px] flex-1 flex-col gap-1.5 px-4 @min-[720px]:w-[170px] @min-[720px]:flex-none">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-24 @min-[720px]:hidden" />
            </span>
            <span className={`${wide} w-[140px]`}>
              <Skeleton className="h-3.5 w-24" />
            </span>
            <span className={`${wide} w-[190px]`}>
              <Skeleton className="h-3.5 w-32" />
            </span>
            <span className="w-[116px] shrink-0 px-4 @min-[720px]:w-[130px]">
              <Skeleton className="h-6 w-16 rounded-full" />
            </span>
            <span className="hidden min-w-[220px] flex-1 px-4 @min-[720px]:block">
              <Skeleton className={i % 3 === 1 ? "h-3.5 w-2/5" : "h-3.5 w-3/4"} />
            </span>
            <span className={`${wide} w-[120px]`}>
              <Skeleton className="h-3.5 w-14" />
            </span>
            <span className="flex w-[84px] shrink-0 justify-end px-4 @min-[720px]:w-[110px]">
              <Skeleton className="h-3.5 w-12" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
