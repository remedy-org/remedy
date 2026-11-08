import { Button } from "@/components/ui";
import { CodeTag } from "./CodeTag";
import { StepTitle } from "./Exhibit";

/** An open claim whose 10 minutes ran out before any photo arrived: the tag, faded, and a fresh start. */
export function ExpiredCard({ code, againHref, demo }: { code: string; againHref: string; demo?: boolean }) {
  return (
    <section aria-labelledby="expired-title" className="flex w-full max-w-claim flex-col gap-8">
      <div className="flex flex-col gap-3">
        <StepTitle id="expired-title">Your code ran out</StepTitle>
        <p className="text-body text-muted">Codes last 10 minutes. Start again for a new one.</p>
      </div>
      <CodeTag code={code} label="Your code" expired className="mx-0" />
      <Button href={againHref} size="lg" block prefetch={false}>
        {demo ? "Choose a claim" : "Get a new code"}
      </Button>
    </section>
  );
}
