import { Card, Skeleton, SkeletonText } from "@/components/ui";
import { FlowShell } from "./FlowShell";

function Meter() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-0.5" />
      ))}
    </div>
  );
}

/**
 * Loading: the shape of what's coming, no spinner. `wide` is the recall screen (RecallView): the brief beside the
 * step meter and consent card. The default is one step card, for the samples, a claim and its result.
 */
export function FlowSkeleton({ wide = false }: { wide?: boolean }) {
  if (wide) {
    return (
      <FlowShell wide>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-20" aria-busy="true" aria-label="Loading the recall">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-4 w-40" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-4/5 max-w-[24ch]" />
              <SkeletonText lines={2} className="max-w-read" />
            </div>
            <Skeleton className="hidden h-64 w-full rounded-card lg:block" />
            <div className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <Meter />
            <Card padding="lg" className="flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-card" />
                <Skeleton className="h-px w-8" />
                <Skeleton className="size-10 rounded-card" />
              </div>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-8 w-3/4" />
                <SkeletonText lines={2} />
              </div>
              <SkeletonText lines={4} />
              <Skeleton className="h-12 w-full" />
            </Card>
          </div>
        </div>
      </FlowShell>
    );
  }
  return (
    <FlowShell>
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading your claim">
        <Meter />
        <Card padding="lg" className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-3/4" />
            <SkeletonText lines={2} />
          </div>
          <Skeleton className="h-40 w-full rounded-card" />
          <SkeletonText lines={3} />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    </FlowShell>
  );
}
