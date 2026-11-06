import { Card, Skeleton, SkeletonText } from "@/components/ui";
import { FlowShell } from "./FlowShell";

/** Loading: the shape of a step card, no spinner. */
export function FlowSkeleton() {
  return (
    <FlowShell>
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading your claim">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-0.5" />
          ))}
        </div>
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
