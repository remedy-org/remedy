import clsx from "clsx";
import { Skeleton } from "@/components/ui";

/** The claims page while it loads, on the loaded page's own geometry (RecallHeading, then the ledger, the tabs and the
 * grid with no gap between them, as ClaimsQueue lays them out), so the page never shifts when the claims arrive. */
export function ConsoleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading claims" className="page flex flex-1 flex-col gap-4 pt-6 pb-3 lg:h-[calc(100dvh-65px)] lg:flex-none lg:overflow-hidden">
      <div className="grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-8">
        <span className="flex h-11 items-center">
          <Skeleton className="h-7 w-80 max-w-full" />
        </span>
        <span className="hidden h-11 items-center gap-3 sm:flex">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-32 rounded-button" />
        </span>
        <span className="flex h-5 items-center sm:col-span-2">
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-12 flex-wrap items-center gap-x-8 gap-y-2 border-y border-line py-2.5">
          {["w-40", "w-28", "w-44", "w-56"].map((w) => (
            <span key={w} className="flex h-7 items-center">
              <Skeleton className={`h-5 ${w}`} />
            </span>
          ))}
        </div>
        <div className="mt-1 flex h-[45px] items-center gap-6 border-b border-line">
          {["w-10", "w-20", "w-11", "w-16", "w-14", "w-20"].map((w, i) => (
            <Skeleton key={i} className={`h-4 ${w}`} />
          ))}
          {/* The grouping control, Export CSV and the search box, at the row's right end as the queue draws them. */}
          <span className="ml-auto hidden items-center gap-4 sm:flex">
            <Skeleton className="h-8 w-32 rounded-control" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-64 rounded-control" />
          </span>
        </div>
        <SkeletonGrid rows={10} />
      </div>
    </div>
  );
}

/**
 * The claims grid's footprint while it loads: a 36px header and 52px rows at the columns' widths, or 88px cards below
 * 720px (the same width the grid measures, by a container query), so the grid replaces it without moving anything.
 */
export function SkeletonGrid({ rows, cards }: { rows: number; cards?: boolean }) {
  const col = (w: string, extra?: string) => clsx("shrink-0 px-3", w, extra);
  return (
    <div aria-hidden="true" className="@container">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className={clsx("h-[37px] items-center border-b border-line", cards ? "hidden" : "hidden @min-[720px]:flex")}>
          {/* The grid's columns in its order and widths (ClaimsGrid hiddenAt): claim, verdict (to 460px), checks, time,
              PayPal and payout (sharing what is left), amount. */}
          {[
            ["w-[220px]", "w-10"],
            ["min-w-[260px] max-w-[460px] flex-1", "w-14"],
            ["w-[112px] hidden @min-[748px]:block", "w-12"],
            ["w-[124px] hidden @min-[992px]:flex justify-end", "w-16"],
            ["min-w-[172px] flex-1 hidden @min-[1600px]:block", "w-12"],
            ["min-w-[120px] flex-1 hidden @min-[868px]:block", "w-12"],
            ["w-[96px] flex justify-end", "w-12"],
          ].map(([w, s], i) => (
            <span key={i} className={col(w)}>
              <Skeleton className={`h-2.5 ${s}`} />
            </span>
          ))}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="border-b border-line last:border-b-0">
            <div className={clsx("h-[87px] items-center gap-3 px-4", cards ? "flex" : "flex @min-[720px]:hidden")}>
              <Skeleton className="h-[30px] w-10 rounded-[4px]" />
              <span className="flex flex-1 flex-col gap-2.5">
                <span className="flex justify-between">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </span>
                <Skeleton className="h-3.5 w-28" />
              </span>
            </div>
            <div className={clsx("h-[51px] items-center", cards ? "hidden" : "hidden @min-[720px]:flex")}>
              <span className={col("flex w-[220px] items-center gap-3")}>
                <Skeleton className="h-6 w-8 rounded-[4px]" />
                <span className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3 w-20" />
                </span>
              </span>
              <span className={col("flex min-w-[260px] max-w-[460px] flex-1 items-center gap-3")}>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className={i % 3 === 1 ? "h-3.5 w-2/5" : "h-3.5 w-1/3"} />
              </span>
              <span className={col("hidden w-[112px] @min-[748px]:block")}>
                <Skeleton className="h-4 w-16" />
              </span>
              <span className={col("hidden w-[124px] justify-end @min-[992px]:flex")}>
                <Skeleton className="h-3.5 w-8" />
              </span>
              <span className={col("hidden min-w-[172px] flex-1 @min-[1600px]:block")}>
                <Skeleton className="h-3.5 w-20" />
              </span>
              <span className={col("hidden min-w-[120px] flex-1 @min-[868px]:block")}>
                <Skeleton className="h-3.5 w-14" />
              </span>
              <span className={col("flex w-[96px] justify-end")}>
                <Skeleton className="h-3.5 w-12" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
