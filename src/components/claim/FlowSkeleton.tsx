import { Skeleton, SkeletonText } from "@/components/ui";
import { FlowShell } from "./FlowShell";

/**
 * Loading: the shape of what's coming, no spinner, on the steps' own 960px frame. `wide` is the recall screen
 * (RecallView): the brief beside the offer. The default is a step: the headline and its line on the left, the photo and
 * the rows on the right, as the samples, a claim and its result lay them out.
 */
export function FlowSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <FlowShell>
      <div className="mx-auto grid w-full max-w-[60rem] grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-2 lg:gap-16" aria-busy="true" aria-label={wide ? "Loading the recall" : "Loading your claim"}>
        {wide ? (
          <>
            <div className="flex flex-col gap-5">
              <Skeleton className="h-6 w-3/5" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="hidden h-56 w-full rounded-control sm:block" />
            </div>
            <div className="flex flex-col gap-6 border-t border-line pt-6">
              <Skeleton className="h-8 w-4/5" />
              <SkeletonText lines={2} />
              <Skeleton className="h-12 w-full rounded-button-lg" />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-3/4" />
              <SkeletonText lines={2} />
              <Skeleton className="mt-4 h-16 w-full" />
            </div>
            <div className="flex flex-col gap-4 max-lg:hidden">
              <Skeleton className="h-64 w-44 rounded-card" />
              <SkeletonText lines={5} />
            </div>
          </>
        )}
      </div>
    </FlowShell>
  );
}
