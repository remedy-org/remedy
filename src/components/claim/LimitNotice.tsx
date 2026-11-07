import { ErrorState } from "@/components/ui";
import { plural, retryIn, type Refusal } from "@/lib/limits";

/** What a start refused by a spending limit says: which limit, that nothing was started, and when to come back. */
export function limitCopy({ kind, limit, until }: Refusal, { demo, now }: { demo: boolean; now: Date }): { title: string; description: string } {
  const when = kind === "monthly" ? retryIn(until, now) : `${retryIn(until, now)}, after 00:00 UTC`;
  const nothing = demo ? "No sample claim was started." : "Nothing was started and nothing is lost.";
  switch (kind) {
    case "account":
      return demo
        ? { title: "This PayPal account has run today's sample claims", description: `Each PayPal account can run ${plural(limit, "sample claim")} a day, which keeps this live demo affordable. ${nothing} Try again ${when}.` }
        : { title: "This PayPal account has started today's claims", description: `Each PayPal account can start ${plural(limit, "claim")} a day, which keeps this live demo affordable. ${nothing} Try again ${when}.` };
    case "daily":
      return { title: "Remedy has taken all the claims it can today", description: `This live demo starts at most ${plural(limit, "claim")} a day so it stays affordable. ${nothing} Try again ${when}.` };
    case "monthly":
      return { title: "Remedy has taken all the claims it can this month", description: `This live demo starts at most ${plural(limit, "claim")} in any 30 days so it stays affordable. ${nothing} Try again ${when}.` };
    case "checks":
      return { title: "Today's photo checks are used up", description: `Remedy runs at most ${plural(limit, "photo check")} a day so this live demo stays affordable. ${nothing} Try again ${when}.` };
  }
}

/** The refused start's button, muted until the limit resets: "Available after 00:00 UTC", "Available again in 3 days". */
export const retryLabel = ({ kind, until }: Refusal, now = new Date()) => (kind === "monthly" ? `Available again ${retryIn(until, now)}` : "Available after 00:00 UTC");

export function LimitNotice({ refusal, demo, now = new Date() }: { refusal: Refusal; demo: boolean; now?: Date }) {
  const { title, description } = limitCopy(refusal, { demo, now });
  return <ErrorState variant="inline" title={title} description={description} />;
}
