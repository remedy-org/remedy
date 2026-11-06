import { Button, Card, ClockIcon } from "@/components/ui";

/** An open claim whose 10 minutes ran out before any photo arrived. */
export function ExpiredCard({ code, againHref, demo }: { code: string; againHref: string; demo?: boolean }) {
  return (
    <Card padding="lg" as="section" aria-labelledby="expired-title" className="flex flex-col gap-6">
      <span className="flex size-10 items-center justify-center rounded-full border border-line-strong text-muted">
        <ClockIcon />
      </span>
      <div className="flex flex-col gap-3">
        <h2 id="expired-title" className="text-h2 font-semibold">
          Code <span className="font-mono">{code}</span> has expired
        </h2>
        <p className="text-body text-muted">
          Each code works for 10 minutes, so photos can&apos;t be prepared in advance or taken from somewhere else. Nothing was sent, and you can start again
          right away.
        </p>
      </div>
      <Button href={againHref} size="lg" block prefetch={false}>
        {demo ? "Choose a sample again" : "Get a new code"}
      </Button>
    </Card>
  );
}
