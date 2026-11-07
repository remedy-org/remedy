import { Skeleton } from "@/components/ui";

// The canvas while AG Studio loads: the report's own grid (24 columns, 16px rows, the same widget spans) and the
// analyst's rail, so nothing moves when Studio paints over it.

const BLOCKS: [x: number, y: number, w: number, h: number][] = [
  [0, 0, 6, 8],
  [6, 0, 6, 8],
  [12, 0, 6, 8],
  [18, 0, 6, 8],
  [0, 8, 16, 15],
  [16, 8, 8, 15],
  [0, 23, 14, 22],
  [14, 23, 10, 22],
];

export function InsightsSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full" aria-busy="true" aria-label="Loading the report">
      <div className="hidden min-w-0 flex-1 overflow-hidden p-5 lg:block">
        <div className="grid" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))", gridAutoRows: "16px" }}>
          {BLOCKS.map(([x, y, w, h]) => (
            <div key={`${x}-${y}`} className="p-1.5" style={{ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` }}>
              <div className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-4">
                <Skeleton className="h-3.5 w-28" />
                {h > 8 && <Skeleton className="h-2.5 w-40" />}
                <Skeleton className="mt-auto h-6 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 border-l border-line bg-surface p-4 lg:w-[400px]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-auto h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-11 w-full rounded-card" />
      </div>
    </div>
  );
}
