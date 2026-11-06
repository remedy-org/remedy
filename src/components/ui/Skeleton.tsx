import clsx from "clsx";

export interface SkeletonProps {
  /** Size and shape it like the content it stands in for, e.g. "h-4 w-32" or "h-11 w-full rounded-control". */
  className?: string;
}

/** A placeholder block. Decorative: put aria-busy on the region that is loading. */
export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={clsx("block rounded-control bg-surface-2 animate-[skeleton-pulse_1.6s_ease-in-out_infinite]", className)} />;
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/** Lines of text at body line height; the last one is shorter. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className={clsx("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={clsx("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </span>
  );
}
