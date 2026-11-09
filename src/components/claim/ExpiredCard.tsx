import { Button } from "@/components/ui";
import { CodeTag } from "./CodeTag";
import { STEP_GRID, StepTitle } from "./Exhibit";

/**
 * An open claim whose 10 minutes ran out before any photo arrived: why, and a fresh start. On a laptop the dead code sits
 * where the tag was, struck through; a phone doesn't show it, so nobody writes it.
 */
export function ExpiredCard({ code, written, againHref, demo }: { code: string; written?: string | null; againHref: string; demo?: boolean }) {
  return (
    <section aria-labelledby="expired-title" className={STEP_GRID}>
      <div className="max-lg:hidden">
        <CodeTag code={code} written={written} expired />
      </div>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <StepTitle id="expired-title">This code has expired</StepTitle>
          <p className="text-body text-pretty text-muted">
            {demo ? "Codes last 10 minutes, so photos can’t be taken in advance. Get a new one to start again." : "Your refund is still waiting. Get a new code, write it on a fresh piece of paper, and take the photo within 10 minutes."}
          </p>
        </div>
        <Button href={againHref} size="lg" block prefetch={false}>
          {demo ? "Choose a claim" : "Get a new code"}
        </Button>
      </div>
    </section>
  );
}
