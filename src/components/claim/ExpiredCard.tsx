import { Button, Card } from "@/components/ui";
import { CodeTag } from "./CodeTag";
import { StepTitle } from "./Exhibit";

/** An open claim whose 10 minutes ran out before any photo arrived: the tag, stamped EXPIRED, and a fresh start. */
export function ExpiredCard({ code, againHref, demo }: { code: string; againHref: string; demo?: boolean }) {
  return (
    <Card padding="lg" as="section" aria-labelledby="expired-title" className="mx-auto flex w-full max-w-claim flex-col gap-8">
      <div className="flex flex-col gap-3">
        <StepTitle id="expired-title">
          Code <span className="font-mono">{code}</span> has expired
        </StepTitle>
        <p className="text-body text-muted">
          Each code works for 10 minutes, so photos can&apos;t be prepared in advance or taken from somewhere else. Nothing was sent, and you can start again
          right away.
        </p>
      </div>
      <div className="pt-4 pb-2">
        <CodeTag code={code} label="One-time code" foot="Valid for 10 minutes from when it was issued." expired />
      </div>
      <Button href={againHref} size="lg" block prefetch={false}>
        {demo ? "Choose a sample again" : "Get a new code"}
      </Button>
    </Card>
  );
}
