import { Button } from "@/components/ui";
import { plural, retryIn, type Refusal } from "@/lib/limits";
import { FocusTitle } from "./FocusTitle";
import { ResetTime } from "./LocalTime";
import { Notice } from "./Notice";

/**
 * What a start refused by a daily limit says: which limit and that nothing was started or paid. `retry` is when to
 * come back without a time zone ("in about 6 hours"); the notice shows the exact reset in the viewer's own time once it can.
 */
export function limitCopy({ kind, limit, until }: Refusal, { now }: { now: Date }): { title: string; description: string; retry: string } {
  const nothing = "Nothing was started and nothing was paid.";
  const retry = retryIn(until, now);
  switch (kind) {
    case "account":
      return { title: "This PayPal account has started today’s claims", description: `Each PayPal account can start ${plural(limit, "claim")} a day. ${nothing}`, retry };
    case "daily":
      return { title: "Remedy is at today’s limit for new claims", description: nothing, retry };
    case "monthly":
      return { title: "Remedy is at this month’s limit for new claims", description: nothing, retry };
    case "checks":
      return { title: "Today’s photo checks are used up", description: nothing, retry };
  }
}

/** A real owner's way on while Remedy can't take the claim: the company's own recall notice. */
export interface RecallNotice {
  company: string;
  url: string;
}

/**
 * The notice, focused on arrival so a keyboard or screen reader lands on it, with the exact time it reopens and what to
 * do meanwhile. The refused start has no button: LimitNextStep takes its place.
 */
export function LimitNotice({ refusal, demo, notice, now = new Date() }: { refusal: Refusal; demo: boolean; notice?: RecallNotice; now?: Date }) {
  const { title, description, retry } = limitCopy(refusal, { now });
  return (
    <div id="limit-notice" tabIndex={-1} className="rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus">
      <FocusTitle id="limit-notice" />
      <Notice tone="neutral" title={title}>
        {description} You can start {demo ? "one" : "a claim"} again <ResetTime until={refusal.until.toISOString()} prefix="after " fallback={retry} />.{" "}
        {demo
          ? "The company console shows every claim so far."
          : notice
            ? `Your refund is still owed: ${notice.company}'s recall notice says how to reach them for it.`
            : null}
      </Notice>
    </div>
  );
}

/** What a refused start offers in place of its button: the company console for the demo, the recall notice for an owner. */
export function LimitNextStep({ demo, notice }: { demo: boolean; notice?: RecallNotice }) {
  if (demo) {
    return (
      <Button href="/console" size="lg" block prefetch={false}>
        Open the company console
      </Button>
    );
  }
  if (!notice) return null;
  return (
    <Button href={notice.url} size="lg" block target="_blank" rel="noopener noreferrer">
      Read {notice.company}&rsquo;s recall notice
    </Button>
  );
}
