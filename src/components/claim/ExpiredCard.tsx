import { Button } from "@/components/ui";
import { CodeTag } from "./CodeTag";
import { STEP_GRID, StepTitle } from "./Exhibit";

/**
 * An open claim whose 10 minutes ran out before any photo arrived: why, and a fresh start. On a laptop the dead code sits
 * where the tag was, struck through; a phone doesn't show it, so nobody writes it.
 */
export function ExpiredCard({ code, againHref, demo }: { code: string; againHref: string; demo?: boolean }) {
  return (
    <section aria-labelledby="expired-title" className={STEP_GRID}>
      <div className="max-lg:hidden">
        <CodeTag code={code} expired />
      </div>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <StepTitle id="expired-title">This code has expired</StepTitle>
          <p className="text-body text-muted">Codes last 10 minutes, so photos can&apos;t be taken in advance. Get a new one to start again.</p>
        </div>
        <Button href={againHref} size="lg" block prefetch={false}>
          {demo ? "Choose a claim" : "Get a new code"}
        </Button>
      </div>
    </section>
  );
}
