import { Button, ErrorState } from "@/components/ui";
import { plural, retryIn, type Refusal } from "@/lib/limits";
import { FocusTitle } from "./FocusTitle";
import { ResetTime } from "./LocalTime";

/**
 * What a start refused by a spending limit says: which limit and that nothing was started. `retry` is when to come back
 * without a time zone ("in about 6 hours"); a daily limit's notice shows the reset in the viewer's own time once it can.
 */
export function limitCopy({ kind, limit, until }: Refusal, { demo, now, sandbox = true }: { demo: boolean; now: Date; sandbox?: boolean }): { title: string; description: string; retry: string } {
  const nothing = demo ? "No sample claim was started." : "Nothing was started and nothing is lost.";
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

/**
 * The refused start's button, muted until the limit resets, without a time zone: "Available again in about 6 hours",
 * "Available again in 3 days". RetryLabel says a daily reset in the viewer's own time.
 */
export const retryLabel = ({ until }: Refusal, now = new Date()) => `Available again ${retryIn(until, now)}`;

/** The button's words: "Available after 05:30 tomorrow" for a daily limit, once the client knows its zone. */
export function RetryLabel({ refusal, now = new Date() }: { refusal: Refusal; now?: Date }) {
  const fallback = retryLabel(refusal, now);
  return refusal.kind === "monthly" ? fallback : <ResetTime until={refusal.until.toISOString()} prefix="Available after " fallback={fallback} />;
}

/**
 * The notice, shown before the start button (which stays muted) and focused on arrival, so a keyboard or screen reader
 * lands on it. The judges' demo also offers what can still be seen: the claims already run, in the company console.
 */
export function LimitNotice({ refusal, demo, sandbox, now = new Date() }: { refusal: Refusal; demo: boolean; sandbox?: boolean; now?: Date }) {
  const { title, description, retry } = limitCopy(refusal, { demo, now, sandbox: demo || sandbox });
  return (
    <div id="limit-notice" tabIndex={-1} className="rounded-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <FocusTitle id="limit-notice" />
      <ErrorState
        variant="inline"
        title={title}
        description={
          <>
            {description} Try again {refusal.kind === "monthly" ? retry : <ResetTime until={refusal.until.toISOString()} prefix="after " fallback={retry} />}.
          </>
        }
        action={
          demo && (
            <div className="flex flex-col items-start gap-1">
              <p className="text-ui text-muted">Meanwhile, the company console shows the sample claims and the claims judges have run, with their photos and checks.</p>
              <Button href="/console" variant="tertiary" size="sm" prefetch={false}>
                Open the company console
              </Button>
            </div>
          )
        }
      />
    </div>
  );
}
