import { Button, ErrorState } from "@/components/ui";
import { plural, retryIn, type Refusal } from "@/lib/limits";
import { FocusTitle } from "./FocusTitle";
import { ResetTime } from "./LocalTime";

/**
 * What a start refused by a spending limit says: which limit and that nothing was started or paid. `retry` is when to
 * come back without a time zone ("in about 6 hours"); the notice shows the exact reset in the viewer's own time once it can.
 */
export function limitCopy({ kind, limit, until }: Refusal, { demo, now, sandbox = true }: { demo: boolean; now: Date; sandbox?: boolean }): { title: string; description: string; retry: string } {
  const nothing = demo ? "No sample claim was started and nothing was paid." : "Nothing was started and nothing is lost.";
  const who = sandbox ? "This sandbox" : "Remedy";
  const where = sandbox ? " in this sandbox" : "";
  const retry = retryIn(until, now);
  switch (kind) {
    case "account":
      return demo
        ? { title: "This PayPal account has run today's sample claims", description: `Each PayPal account can run ${plural(limit, "sample claim")} a day${where}, to keep its costs down. ${nothing}`, retry }
        : { title: "This PayPal account has started today's claims", description: `Each PayPal account can start ${plural(limit, "claim")} a day${where}, to keep its costs down. ${nothing}`, retry };
    case "daily":
      return { title: "Remedy has taken all the claims it can today", description: `${who} starts at most ${plural(limit, "claim")} a day, to keep its costs down. ${nothing}`, retry };
    case "monthly":
      return { title: "Remedy has taken all the claims it can this month", description: `${who} starts at most ${plural(limit, "claim")} in any 30 days, to keep its costs down. ${nothing}`, retry };
    case "checks":
      return { title: "Today's photo checks are used up", description: `${who} runs at most ${plural(limit, "photo check")} a day, to keep its costs down. ${nothing}`, retry };
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
export function LimitNotice({ refusal, demo, sandbox, notice, now = new Date() }: { refusal: Refusal; demo: boolean; sandbox?: boolean; notice?: RecallNotice; now?: Date }) {
  const { title, description, retry } = limitCopy(refusal, { demo, now, sandbox: demo || sandbox });
  return (
    <div id="limit-notice" tabIndex={-1} className="rounded-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      <FocusTitle id="limit-notice" />
      <ErrorState
        variant="inline"
        title={title}
        description={
          <>
            {description} You can start {demo ? "one" : "a claim"} again <ResetTime until={refusal.until.toISOString()} prefix="after " fallback={retry} />.{" "}
            {demo
              ? "Meanwhile, the company console shows the sample claims and the claims judges have run, with their photos and checks."
              : notice
                ? `Your refund is still owed: ${notice.company}'s recall notice says how to reach them for it.`
                : null}
          </>
        }
      />
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
      Read {notice.company}&apos;s recall notice
    </Button>
  );
}
