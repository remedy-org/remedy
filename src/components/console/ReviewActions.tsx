"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import clsx from "clsx";
import { AlertIcon, Button, ErrorState, Field, Textarea } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
import type { DrawerClaim, ReviewedClaim } from "@/app/console/_lib/drawer";
import { api } from "./api";
import { formatClock } from "./format";

type Mode = "idle" | "approve" | "reject";

// The reject route's own minimum (reject/route.ts), checked here first so an empty reason never sends a request.
const REASON_MIN = 8;
const REASON_SHORT = "Say why in a few words, so the owner knows what to fix";
// One-click reasons for the common refusals, in the words the owner reads; the reviewer can edit them.
const QUICK: { label: string; text: (code: string) => string }[] = [
  { label: "Wrong code", text: (code) => `The tag in the photo doesn't read ${code}, this claim's code.` },
  { label: "No tag", text: (code) => `The tag with the code ${code} isn't in the photo.` },
  { label: "Not destroyed", text: () => "The photos don't show the product destroyed as the recall asks." },
  { label: "Wrong product", text: () => "The photos don't show the recalled product." },
];

export interface ReviewIntent {
  mode: "approve" | "reject";
  // Changes on every key press, so pressing A twice re-opens the confirm.
  n: number;
}

type PayoutFailure = { at: string; detail: string };

const typingIn = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/** A held claim whose last payout attempt PayPal refused: when, and PayPal's answer. The panel keeps saying so (and
 * offers to try again) until a payout goes through; the claim's history keeps it after. */
export function payoutFailure(claim: Pick<DrawerClaim, "decision" | "events">): PayoutFailure | null {
  if (claim.decision !== "held") return null;
  const last = [...claim.events].reverse().find((e) => e.type === "payout_failed" || e.type === "payout_sent");
  if (last?.type !== "payout_failed") return null;
  // PayPal's own answer: kept apart from the plain line by the drawer (drawer.ts), or after it on older views.
  const raw = last.raw ?? last.detail.replace(/^PayPal didn't take the payout[:;]\s*/, "");
  return { at: last.at, detail: raw.startsWith("nothing was paid") ? "" : raw };
}

/**
 * Approve and pay, or reject with a reason, for a held claim. Paying takes a second, explicit press: Pay, or A again.
 * A seeded claim's review is a sample: the server says what it would have done, and the claim stays held. The
 * keyboard's A and R (intent) open the same confirm or form as the buttons and move focus into it. While the confirm or
 * form is open (data-review-open), the queue's A and R do nothing; the confirm takes A itself. onMode tells the panel
 * which form opened (the reject form brings the photos into view).
 */
export function ReviewActions({
  claim,
  onDone,
  onFailed,
  intent,
  onMode,
}: {
  claim: DrawerClaim;
  onMode?: (mode: Mode) => void;
  onDone: (c: DrawerClaim) => void;
  // A refused approve still writes the claim's history (payout_failed, approve_refused): the panel reloads it.
  onFailed?: () => void;
  intent?: ReviewIntent | null;
}) {
  // A or R pressed while the panel was still loading opens the confirm as soon as it mounts.
  const [mode, setMode] = useState<Mode>(intent?.mode ?? "idle");
  // After Esc or Cancel, focus goes back to the button that opened the confirm, so a second Esc closes the panel.
  const [back, setBack] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [reason, setReason] = useState("");
  const [sample, setSample] = useState<string | null>(null);
  // PayPal refused the payout just now: shown at once, as the reloaded claim will show it (payoutFailure), not as a
  // second design of the same message.
  const [refused, setRefused] = useState<PayoutFailure | null>(null);
  // A press on Pay that didn't send: the second click of a double-click on Approve. Said, never silent.
  const [dropped, setDropped] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    onMode?.(mode);
  }, [mode, onMode]);
  // A reason the route or the check below refused: focus goes back into the reason, never to the page, where the next
  // letter typed would be a shortcut.
  const reasonError = error?.fields?.reason;
  useEffect(() => {
    if (reasonError) form.current?.querySelector("textarea")?.focus();
  }, [reasonError]);
  const [seenIntent, setSeenIntent] = useState(intent);
  if (intent !== seenIntent) {
    setSeenIntent(intent);
    if (intent && !busy) {
      setSample(null);
      setError(null);
      setDropped(false);
      setMode(intent.mode);
    }
  }
  // The reloaded claim now says why the approve was refused (the panel's top box): the alert said it first, once.
  const [seenRefusal, setSeenRefusal] = useState(claim.refused?.at);
  if (claim.refused?.at !== seenRefusal) {
    setSeenRefusal(claim.refused?.at);
    if (claim.refused) setError(null);
  }
  const review = claim.review;
  if (!review) return null;
  const failure = payoutFailure(claim) ?? refused;

  const run = async (url: string, json?: unknown) => {
    setBusy(true);
    setError(null);
    const result = await api<ReviewedClaim>(url, { method: "POST", json });
    setBusy(false);
    if (!result.ok) {
      if (result.status === 502 && mode === "approve") {
        // PayPal didn't take it: back to the held claim's buttons, under the titled alert the reload keeps showing.
        setRefused({ at: new Date().toISOString(), detail: "" });
        setBack("approve");
        setMode("idle");
      } else {
        setError(result.error);
        // The checks run again stopped the payout (or the claim was decided elsewhere): back to the buttons, where the
        // panel's reload says why, with Reject in reach.
        if (result.status === 409 && mode === "approve") {
          setBack("reject");
          setMode("idle");
        }
      }
      return onFailed?.();
    }
    setRefused(null);
    if (!result.data.sample) return onDone(result.data);
    setSample(result.data.sample);
    setMode("idle");
  };

  const base = `/api/console/claims/${claim.id}`;
  // The second click of a double-click on Approve lands where Approve was: it doesn't pay, and the confirm says so. A
  // press from the keyboard (detail 0) always pays; a held key's repeats never reach it (payKeys).
  const pay = (e: MouseEvent) => {
    if (e.detail > 1) return setDropped(true);
    run(`${base}/approve`);
  };
  const payKeys = (e: KeyboardEvent) => {
    if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault();
  };
  const reset = () => {
    if (mode !== "idle") setBack(mode);
    setMode("idle");
    setError(null);
    setDropped(false);
  };
  // The checks run again on approve stopped the payout, and nothing was approved since: approving again meets the same
  // conflict, so Reject leads.
  const stuck = Boolean(claim.refused) && !failure;

  return (
    <div
      className="flex flex-col gap-4"
      data-review-open={mode !== "idle" || busy || undefined}
      onKeyDown={(e) => {
        // Esc cancels the open confirm or reason first; the console's own Esc (close the panel) never sees this one.
        if (e.key === "Escape" && mode !== "idle" && !busy) {
          e.preventDefault();
          e.stopPropagation();
          reset();
        }
        // A again pays, as the shortcuts say (A opened this confirm); a held A's repeats don't.
        if ((e.key === "a" || e.key === "A") && mode === "approve" && !busy && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !typingIn(e.target)) {
          e.preventDefault();
          run(`${base}/approve`);
        }
      }}
    >
      {error && !error.fields?.reason && <ErrorState variant="inline" title={error.error} reference={error.reference} />}

      {mode === "idle" && (
        <>
          {/* The footer is the buttons alone, so the evidence keeps its room; a sample's result or a refused payout sits
              above them. A seeded claim's note is in the evidence (EvidenceDrawer). */}
          {sample ? (
            <p role="status" className="text-ui text-muted">
              <span className="micro mr-2 text-text-2">Sample result</span>
              {sample}
            </p>
          ) : failure && !error && !payoutFailure(claim) ? (
            // Just now, before the panel reloads the claim; after it, the panel's top box says it (EvidenceDrawer).
            <div className="flex gap-3 rounded-card border border-line bg-stop-soft px-4 py-3">
              <AlertIcon className="mt-0.5 shrink-0 text-stop" />
              <div className="min-w-0 text-ui text-muted">
                <p className="font-medium text-text">
                  PayPal didn&apos;t take the payout at <span className="font-mono">{formatClock(failure.at)}</span> UTC
                </p>
                <p className="mt-1">Nothing was paid and the claim is still held. Try again, or reject it.</p>
              </div>
            </div>
          ) : failure?.detail && !error ? (
            <details className="text-micro text-faint">
              <summary className="cursor-pointer hover:text-muted">PayPal&apos;s answer at {formatClock(failure.at)} UTC</summary>
              <p className="mt-1 font-mono break-words">{failure.detail}</p>
            </details>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              variant={stuck ? "secondary" : "primary"}
              onClick={() => (setSample(null), setMode("approve"))}
              autoFocus={back === "approve"}
              className="flex-1 sm:flex-none"
            >
              {review.sample ? "Approve" : `${failure || stuck ? "Try again: pay" : "Approve and pay"} ${claim.amount}${claim.sandbox ? " sandbox" : ""}`}
            </Button>
            <Button
              variant={stuck ? "primary" : "secondary"}
              onClick={() => (setSample(null), setMode("reject"))}
              autoFocus={back === "reject"}
              className="flex-1 sm:flex-none"
            >
              Reject
            </Button>
          </div>
        </>
      )}

      {mode === "approve" && (
        <>
          {review.sample ? (
            <p className="text-ui text-muted">
              On a real claim, this sends <span className="font-mono text-text">{claim.amount}</span> through PayPal Payouts. This sample&apos;s account,{" "}
              <span className="font-mono text-text">{claim.payer}</span>, is made up, so Remedy sends nothing and the claim stays held.
            </p>
          ) : (
            <p className="text-ui text-muted">
              Remedy runs the duplicate and account checks again, then sends <span className="font-mono text-text">{claim.amount}</span> to{" "}
              <span className="font-mono text-text">{claim.payer}</span> through PayPal Payouts, from Remedy&apos;s PayPal {claim.sandbox ? "sandbox " : ""}account in
              this build{claim.sandbox ? ": sandbox money, not real" : ""}.
            </p>
          )}
          {dropped && (
            <p role="status" className="text-ui text-text-2">
              Not paid yet: that was the second click of a double-click. Press Pay once to send it.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {review.sample ? (
              <Button onClick={pay} onKeyDown={payKeys} pending={busy} pendingLabel="Approving the sample" autoFocus className="flex-1 sm:flex-none">
                Approve the sample
              </Button>
            ) : (
              <Button onClick={pay} onKeyDown={payKeys} pending={busy} pendingLabel="Paying through PayPal" autoFocus className="flex-1 sm:flex-none">
                Pay {claim.amount}
                {claim.sandbox ? " sandbox" : ""}
              </Button>
            )}
            <Button variant="secondary" onClick={reset} disabled={busy} className="flex-1 sm:flex-none">
              Cancel
            </Button>
          </div>
        </>
      )}

      {mode === "reject" && (
        <form
          ref={form}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < REASON_MIN) {
              setError({ error: REASON_SHORT, fields: { reason: REASON_SHORT } });
              form.current?.querySelector("textarea")?.focus();
              return;
            }
            run(`${base}/reject`, { reason });
          }}
        >
          <Field
            label="Why it's rejected"
            hint={
              <>
                Tag must read <span className="font-mono font-medium text-text">{claim.code}</span>
              </>
            }
            help="The owner sees this on their claim page."
            error={error?.fields?.reason}
          >
            {(f) => <Textarea {...f} rows={2} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus required minLength={REASON_MIN} />}
          </Field>
          <div className="-mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Quick reasons">
            {QUICK.map((q) => {
              const text = q.text(claim.code);
              return (
                <button
                  key={q.label}
                  type="button"
                  aria-pressed={reason === text}
                  onClick={() => {
                    setReason(text);
                    setError(null);
                  }}
                  className={clsx(
                    "inline-flex h-8 items-center rounded-control px-2 text-ui shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-surface-3 hover:text-text",
                    reason === text ? "bg-surface-3 text-text" : "bg-surface-2 text-muted",
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="secondary" pending={busy} pendingLabel="Rejecting" className="flex-1 sm:flex-none">
              {review.sample ? "Reject the sample" : "Reject claim"}
            </Button>
            <Button variant="tertiary" arrow={false} onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
