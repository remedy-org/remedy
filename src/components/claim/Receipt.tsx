import clsx from "clsx";
import type { ReactNode } from "react";
import { Money, Paper } from "@/components/ui";
import type { CheckState } from "@/components/ui";
import styles from "./flow.module.css";
import { ClaimTime } from "./LocalTime";
import { FEED_MS } from "./model";
import { PaidStamp, PayoutRow } from "./ReceiptLive";

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
 * The refund while the checks run: what it is, its state in one word, and the amount, once. It comes right under the
 * checks (on a laptop too, in the same column), whose last hairline is above it, so it draws only its own foot.
 */
export function RefundRow({ amount, state, className }: { amount: { value: string; currency: string }; state: CheckState; className?: string }) {
  const word = REFUND_WORD[state] ?? "After the checks";
  const sent = state === "pass";
  return (
    <div data-row="refund" className={clsx("flex items-center justify-between gap-4 border-b border-line-2 py-4", className)}>
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
  /** The PayPal login the owner knows, masked; without one, "Your PayPal account". */
  account?: string | null;
  /** PayPal's payout batch id: the reference PayPal itself shows. */
  payoutId?: string;
  sentAt?: string;
  /** Seconds from the photos arriving to the payout leaving. */
  took: number | null;
  /** Seconds from the photos arriving to PayPal confirming the payout, once it has. */
  confirmed?: number | null;
  /** Prints now: a claim decided under a minute ago. A reload, or a later visit, shows it at rest. */
  arrive: boolean;
  /** Arriving: how long to wait before printing (the passed checks fold first). */
  delay?: number;
  /** One quiet line at its foot. */
  foot?: ReactNode;
}

/**
 * The paid receipt, the flow's one physical moment: cream paper torn from a roll, its claim id in the header as the
 * homepage's receipt has it, the amount at full size with the PAID stamp beside it, then PayPal's live status, who it
 * went to, the recall, the PayPal payout id and when it left. It prints out of the refund row's slot, and the stamp
 * lands once it is out.
 */
export function Receipt({ amount, recallId, claimId, account, payoutId, sentAt, took, confirmed, arrive, delay = 0, foot }: ReceiptProps) {
  return (
    // The slot is drawn while it prints: a dark lip a little wider than the paper, which feeds down out of it, so the
    // paper's edge reads as the slot it comes from, never as a clipping. Once the paper is out, the lip fades (300ms),
    // so the receipt at rest is paper alone; reduced motion never draws it.
    <div id="receipt" className="relative scroll-mt-24">
      {arrive && (
        <span
          aria-hidden="true"
          className="absolute -inset-x-2 -top-px z-10 h-[3px] rounded-full bg-text/75 opacity-0 transition-opacity duration-300 ease-snap starting:opacity-100 motion-reduce:hidden"
          style={{ transitionDelay: `${FEED_MS + delay}ms` }}
        />
      )}
      <div className={clsx(arrive && styles.feed)} style={{ ["--feed-ms" as string]: `${FEED_MS}ms`, ["--feed-delay" as string]: `${delay}ms` }}>
      <div>
        <Paper
          variant="receipt"
          perforated
          padding="none"
          as="article"
          aria-label="Refund receipt"
          data-paper=""
          className="w-full"
        >
          <div className="flex flex-col px-6 pt-8 pb-6 sm:px-7">
            <div className="flex items-baseline justify-between gap-4 text-ui text-ink-muted">
              <span>Refund receipt</span>
              <span className="font-mono whitespace-nowrap text-ink">{claimId}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <Money value={Number(amount.value)} currency={amount.currency} size="amount" className="text-ink" />
              <PaidStamp arrive={arrive} delay={delay} />
            </div>
            <dl className="mt-5 border-t border-dashed border-paper-line text-ui">
              <PayoutRow confirmed={confirmed} />
              <Row label="To">{account ? <Masked text={account} /> : "Your PayPal account"}</Row>
              <Row label="Recall">
                CPSC <span className="font-mono">{recallId}</span>
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

/** "p••@o••••.com": Schibsted's bullets sit wide apart, so the mask's run of them is set in mono, as the console's is. */
function Masked({ text }: { text: string }) {
  // Read out as "p, hidden, @o, hidden, .com" rather than a run of bullets.
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
