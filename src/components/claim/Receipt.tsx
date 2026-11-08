import clsx from "clsx";
import type { ReactNode } from "react";
import { Money, Paper, Stamp } from "@/components/ui";
import type { CheckState } from "@/components/ui";
import styles from "./flow.module.css";
import { ClaimTime } from "./LocalTime";
import { PayoutRow } from "./ReceiptLive";

/** How long the receipt takes to feed out of its slot; the PAID stamp lands after it. */
export const FEED_MS = 900;

// The refund row's words, one per state: the amount waits on the checks, then goes, or doesn't.
const REFUND_WORD: Partial<Record<CheckState, string>> = {
  waiting: "After the checks",
  running: "Sending",
  pass: "Sent",
  hold: "Waiting for a person",
  skipped: "Not sent",
  reject: "Not sent",
  blocked: "Not sent",
};

/**
 * The refund while the checks run: what it is, its state in one word, and the amount, once, between hairlines. Its top
 * hairline is the slot the receipt prints out of: the paid result draws the receipt from the same line.
 */
export function RefundRow({ amount, state, className }: { amount: { value: string; currency: string }; state: CheckState; className?: string }) {
  const word = REFUND_WORD[state] ?? "After the checks";
  const sent = state === "pass";
  return (
    <div data-row="refund" className={clsx("flex items-center justify-between gap-4 border-y border-line-2 py-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body text-text">Refund to your PayPal</span>
        <span key={word} className={clsx("text-ui", sent ? "text-text" : state === "hold" ? "text-hold" : "text-muted", styles.swap)}>
          {word}
        </span>
      </div>
      <Money
        value={Number(amount.value)}
        currency={amount.currency}
        className={clsx("text-head-sm font-medium transition-colors duration-160", sent || state === "running" ? "text-text" : "text-muted")}
      />
    </div>
  );
}

export interface ReceiptProps {
  amount: { value: string; currency: string };
  /** The CPSC recall number. */
  recallId: string;
  claimId: string;
  /** The PayPal login the owner knows, masked; without one, the payer ID's tail. */
  account?: string | null;
  payerTail: string;
  /** PayPal's payout batch id: the reference PayPal itself shows. */
  payoutId?: string;
  sentAt?: string;
  /** Seconds from the photos arriving to the payout leaving. */
  took: number | null;
  /** Prints now: a claim decided under a minute ago. A reload, or a later visit, shows it at rest. */
  arrive: boolean;
  /** One quiet line at its foot. */
  foot?: ReactNode;
}

/**
 * The paid receipt, the flow's one physical moment: cream paper torn from a roll, the amount at full size with the PAID
 * stamp beside it, then PayPal's live status, who it went to, the claim, the PayPal payout id and when it left. It
 * prints out of the refund row's slot, and the stamp lands once it is out.
 */
export function Receipt({ amount, recallId, claimId, account, payerTail, payoutId, sentAt, took, arrive, foot }: ReceiptProps) {
  return (
    // The slot's lip stays where the refund row's top hairline was; the paper feeds down out of it.
    <div id="receipt" className={clsx("scroll-mt-24 border-t border-line-2", arrive && styles.feed)} style={{ ["--feed-ms" as string]: `${FEED_MS}ms` }}>
      <div>
        <Paper variant="receipt" perforated padding="none" as="article" aria-label="Refund receipt" data-paper="" className="w-full">
          <div className="flex flex-col px-6 pt-8 pb-6 sm:px-7">
            <div className="flex items-baseline justify-between gap-4 text-ui text-ink-muted">
              <span>Refund receipt</span>
              <span className="whitespace-nowrap">
                CPSC <span className="font-mono">{recallId}</span>
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <Money value={Number(amount.value)} currency={amount.currency} size="amount" className="text-ink" />
              <Stamp tone="pay" land={arrive ? FEED_MS : undefined} className="mr-1">
                Paid
              </Stamp>
            </div>
            <dl className="mt-5 border-t border-dashed border-paper-line text-ui">
              <PayoutRow />
              <Row label="To">
                {account ? (
                  <Masked text={account} />
                ) : (
                  <>
                    <span className="sr-only">PayPal account ending {payerTail}</span>
                    <span aria-hidden="true" className="font-mono">
                      ••••{payerTail}
                    </span>
                  </>
                )}
              </Row>
              <Row label="Claim" mono>
                {claimId}
              </Row>
              {payoutId && (
                <Row label="PayPal payout" mono>
                  {payoutId}
                </Row>
              )}
              {sentAt && (
                <Row label="Sent">
                  <ClaimTime iso={sentAt} format="stamp" />
                  {took !== null && (
                    <span className="block text-ink-muted">
                      {took} {took === 1 ? "second" : "seconds"} after your photo
                    </span>
                  )}
                </Row>
              )}
            </dl>
            {foot && <div className="mt-4 text-ui text-ink-muted">{foot}</div>}
          </div>
        </Paper>
      </div>
    </div>
  );
}

function Row({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-paper-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className={clsx("min-w-0 text-right text-ink [overflow-wrap:anywhere]", mono && "font-mono")}>{children}</dd>
    </div>
  );
}

/** "p••@owner.test": Schibsted's bullets sit wide apart, so the mask's run of them is set in mono, as the console's is. */
function Masked({ text }: { text: string }) {
  // Read out as "d, hidden, @owner.test" rather than a run of bullets.
  const spoken = text.replace(/•+/g, ", hidden, ");
  return (
    <>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true">
        {text.split(/(•+)/).map((part, i) =>
          part.startsWith("•") ? (
            <span key={i} className="font-mono tracking-[-0.08em]">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </span>
    </>
  );
}
