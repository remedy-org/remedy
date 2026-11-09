"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import clsx from "clsx";
import { AlertIcon, Button, ErrorState, Field, Textarea } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
import type { DrawerClaim, PayoutFailureWords, ReviewedClaim } from "@/app/console/_lib/drawer";
import { api } from "./api";
import { formatClock } from "./format";
import { idsIn, LinkedIds } from "./LinkedIds";
import { quickReasons } from "./quickReasons";

type Mode = "idle" | "approve" | "reject";

// The reject route's own minimum (reject/route.ts), checked here first so an empty reason never sends a request.
export const REASON_MIN = 8;
export const REASON_SHORT = "Say why in a few words, so the owner knows what to fix";

export interface ReviewIntent {
  mode: "approve" | "reject";
  // Changes on every key press, so pressing A twice re-opens the confirm.
  n: number;
  // The claim the key was pressed for: a panel still showing another claim leaves it for that claim's panel.
  id?: string;
}

type PayoutFailure = PayoutFailureWords & { at: string; raw: string };

const typingIn = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const NETWORK: PayoutFailureWords = { kind: "network", what: "Remedy couldn't reach PayPal (a network error)", next: "Nothing was sent, so it's safe to try again." };
const REFUSED: PayoutFailureWords = { kind: "paypal", what: "PayPal didn't take the payout", next: "Nothing was sent." };

/** A held claim whose last payout attempt failed: when, what happened in words (drawer.ts), and the raw answer for
 * support. The panel keeps saying so (and offers to try again) until a payout goes through; the history keeps it after. */
export function payoutFailure(claim: Pick<DrawerClaim, "decision" | "events">): PayoutFailure | null {
  if (claim.decision !== "held") return null;
  const last = [...claim.events].reverse().find((e) => e.type === "payout_failed" || e.type === "payout_sent");
  if (last?.type !== "payout_failed") return null;
  return { at: last.at, ...(last.failure ?? REFUSED), raw: last.raw ?? "" };
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * One name for each review action, the same on the panel's buttons, the photo viewer's and the key hints: "Pay $29.99…"
 * (or "Try again: pay…" after a payout that failed on the way to PayPal), "Reject…". blocked: approve's checks would
 * stop the payout now (DrawerClaim.stops), so Reject leads and approve isn't offered as a button. confirmKey: what A
 * does once the confirm is open.
 */
export function reviewLabels(claim: Pick<DrawerClaim, "review" | "amount" | "decision" | "events" | "stops">) {
  const failure = payoutFailure(claim);
  return {
    blocked: claim.stops.length > 0,
    approve: `${failure ? "Try again: pay" : "Pay"} ${claim.amount}…`,
    approveKey: "Pay",
    confirmKey: `Pay ${claim.amount}`,
    reject: "Reject…",
  };
}

/**
 * Approve and pay, or reject with a reason, for a held claim. Paying takes a second, explicit press: Pay, or A again.
 * The keyboard's A and R (intent) open the same confirm or form as the buttons and move focus into it. While the
 * confirm or form is open (data-review-open), the queue's A and R do nothing; the confirm takes A itself, the reason
 * takes ⌘↵ (Ctrl+Enter), and 1 to 4 pick a quick reason while it is empty or holds another quick reason. onMode tells the panel which form opened (the
 * reject form brings the photos into view).
 */
export function ReviewActions({
  claim,
  onDone,
  onFailed,
  intent,
  onMode,
  onBusy,
  onOpen,
}: {
  claim: DrawerClaim;
  onMode?: (mode: Mode) => void;
  // A decision is saving: the panel's key line says the keys wait (the queue holds them for the next claim).
  onBusy?: (busy: boolean) => void;
  onDone: (c: ReviewedClaim) => void;
  // A refused approve still writes the claim's history (payout_failed, approve_refused): the panel reloads it.
  onFailed?: () => void;
  intent?: ReviewIntent | null;
  // Opens a claim a refusal names (the account's other claim) in the same panel.
  onOpen?: (id: string) => void;
}) {
  // A or R pressed while the panel was still loading opens the confirm as soon as it mounts.
  const [mode, setMode] = useState<Mode>(intent?.mode ?? "idle");
  // After Esc or Cancel, focus goes back to the button that opened the confirm, so a second Esc closes the panel.
  const [back, setBack] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [reason, setReason] = useState("");
  // The payout failed just now: shown at once, as the reloaded claim will show it (payoutFailure), not as a second
  // design of the same message.
  const [refused, setRefused] = useState<PayoutFailure | null>(null);
  // An approve the checks run again stopped: said in one result line, as a saved decision is (EvidenceDrawer), and kept
  // through the reload that follows, until the next action.
  const [notPaid, setNotPaid] = useState<{ at: string; reasons: string[] } | null>(null);
  // A press on Pay that didn't send: the second click of a double-click on Approve. Said, never silent.
  const [dropped, setDropped] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    onMode?.(mode);
  }, [mode, onMode]);
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);
  // The decision unmounts the buttons in the same render that ends the save.
  useEffect(() => () => onBusy?.(false), [onBusy]);
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
      setError(null);
      setNotPaid(null);
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
  const labels = reviewLabels(claim);
  // The claim the stopping check names (the account's other claim): the footer offers to open it.
  const other = idsIn(claim.stops.join(" ")).find((id) => id !== claim.id);

  const run = async (url: string, json?: unknown) => {
    setBusy(true);
    setError(null);
    setNotPaid(null);
    const result = await api<ReviewedClaim>(url, { method: "POST", json });
    setBusy(false);
    if (!result.ok) {
      if (result.status === 502 && mode === "approve") {
        // The payout didn't reach PayPal or PayPal didn't take it: back to the held claim's buttons, under the titled
        // alert the reload keeps showing.
        setRefused({ at: new Date().toISOString(), ...(result.error.error.startsWith("Remedy couldn't reach PayPal") ? NETWORK : REFUSED), raw: "" });
        setBack("approve");
        setMode("idle");
      } else if (result.status === 409 && mode === "approve" && result.error.reasons?.length) {
        // The checks run again stopped the payout: one result line says so, and Reject is in reach.
        setNotPaid({ at: new Date().toISOString(), reasons: result.error.reasons });
        setBack("reject");
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
    onDone(result.data);
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
  // The checks run again on approve would stop the payout (they did, or would now): approve steps back to a quiet button.
  const stuck = labels.blocked || Boolean(notPaid);
  const openReject = () => (setNotPaid(null), setMode("reject"));
  // This claim's quick reasons (quickReasons.ts): what held it first, never one a passed check contradicts.
  const QUICK = quickReasons(claim.fiveRows.flatMap((r) => r.parts));
  const quickKey = (k: string) => /^[1-9]$/.test(k) && Number(k) <= QUICK.length;
  const quick = (i: number) => {
    const q = QUICK[i];
    if (!q) return;
    setReason(q.text(claim.code));
    setError(null);
  };
  // What held the claim, said again over the reason as it is written: the form scrolls the panel's heading away.
  const heldFor = claim.checks.find((c) => c.outcome !== "pass")?.rule ?? claim.preChecks.find((p) => p.state === "hold" || p.state === "reject")?.detail ?? null;

  return (
    <div
      className="flex flex-col gap-4"
      data-review-open={mode !== "idle" || busy || undefined}
      // The queue holds keys typed while this is set, and replays them on the next claim (keyQueue.ts).
      data-saving={busy || undefined}
      onKeyDown={(e) => {
        // Esc cancels the open confirm or reason first; the console's own Esc (close the panel) never sees this one.
        if (e.key === "Escape" && mode !== "idle" && !busy) {
          e.preventDefault();
          e.stopPropagation();
          reset();
        }
        // A again pays, as the shortcuts say (A opened this confirm); a held A's repeats don't.
        if ((e.key === "a" || e.key === "A") && mode === "approve" && !labels.blocked && !busy && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !typingIn(e.target)) {
          e.preventDefault();
          run(`${base}/approve`);
        }
      }}
    >
      {error && !error.fields?.reason && <ErrorState variant="inline" title={error.error} reference={error.reference} />}

      {mode === "idle" && (
        <>
          {/* The footer is the buttons alone, so the evidence keeps its room; a refused payout sits above them. */}
          {notPaid ? (
            // The same result line as a saved decision's (EvidenceDrawer), for the approve that paid nothing.
            <p role="status" className="text-ui text-muted">
              <span className="font-medium text-text">
                Approved · not paid at <span className="font-mono">{formatClock(notPaid.at)}</span> UTC:
              </span>{" "}
              <LinkedIds text={lowerFirst(notPaid.reasons.join("; "))} onOpen={onOpen} self={claim.id} />. Nothing was sent.
            </p>
          ) : failure && !error && !payoutFailure(claim) ? (
            // Just now, before the panel reloads the claim; after it, the panel's top box says it (EvidenceDrawer).
            <div role="status" className="flex gap-3 rounded-card border border-line bg-stop-soft px-4 py-3">
              <AlertIcon className="mt-0.5 shrink-0 text-stop" />
              <div className="min-w-0 text-ui text-muted">
                <p className="font-medium text-text">
                  {failure.what} at <span className="font-mono">{formatClock(failure.at)}</span> UTC
                </p>
                <p className="mt-1">{failure.next} The claim is still held: try again, or reject it.</p>
              </div>
            </div>
          ) : failure?.raw && !error ? (
            // The plain words lead in the panel's top box; the service's own answer is for support.
            <details className="text-micro text-faint">
              <summary className="cursor-pointer hover:text-muted">Details for support · {formatClock(failure.at)} UTC</summary>
              <p className="mt-1 font-mono break-words">{failure.raw}</p>
            </details>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {labels.blocked ? (
              // Approve isn't a button while its checks would stop the payout: Reject leads, and the claim they name opens
              // beside it. The A key still opens the confirm, which says why.
              <>
                {/* Amber is for moving money only: a reject is the quiet button even when it leads. */}
                <Button key="reject" variant="secondary" onClick={openReject} autoFocus={back === "reject"} className="flex-1 sm:flex-none">
                  {labels.reject}
                </Button>
                {other && onOpen && (
                  <Button key="open" variant="secondary" onClick={() => onOpen(other)} className="flex-1 sm:flex-none">
                    Open <span className="font-mono">{other}</span>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  key="approve"
                  // The held claim's decision is the panel's one action, amber here as in the photo viewer, since it moves
                  // money; once approve can't pay (its checks would stop the payout) it is a quiet button too.
                  variant={stuck ? "secondary" : "primary"}
                  onClick={() => (setNotPaid(null), setMode("approve"))}
                  autoFocus={back === "approve"}
                  className="flex-1 sm:flex-none"
                >
                  {labels.approve}
                </Button>
                <Button key="reject" variant="secondary" onClick={openReject} autoFocus={back === "reject"} className="flex-1 sm:flex-none">
                  {labels.reject}
                </Button>
              </>
            )}
          </div>
        </>
      )}

      {mode === "approve" && labels.blocked && (
        <>
          <p className="text-ui text-muted">
            <span className="font-medium text-text">Approve won&apos;t pay:</span>{" "}
            <LinkedIds text={lowerFirst(claim.stops.join("; "))} onOpen={onOpen} self={claim.id} />. Remedy runs this check again on approve and would stop the payout, so
            nothing would be sent.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={openReject} autoFocus className="flex-1 sm:flex-none">
              {labels.reject}
            </Button>
            <Button variant="tertiary" arrow={false} onClick={reset}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {mode === "approve" && !labels.blocked && (
        <>
          {/* One line, so the evidence above keeps its height. */}
          {/* A claim the console starts with has no PayPal payout behind it: approve records the decision and sends
              nothing, so it says Approve, never Pay. */}
          <p className="text-ui text-muted">
            <span className="font-medium text-text">
              {claim.seeded ? "Approve" : "Pay"} <span className="font-mono">{claim.amount}</span> {claim.seeded ? "for" : "to"} <span className="font-mono">{claim.payer}</span>?
            </span>{" "}
            {claim.seeded ? "Nothing is sent through PayPal." : "Through PayPal Payouts."}
          </p>
          {dropped && (
            <p role="status" className="text-ui text-text-2">
              Not paid yet: that was the second click of a double-click. Press Pay once to send it.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={pay} onKeyDown={payKeys} pending={busy} pendingLabel={claim.seeded ? "Approving" : "Paying through PayPal"} autoFocus className="flex-1 sm:flex-none">
              {claim.seeded ? "Approve" : "Pay"} {claim.amount}
            </Button>
            <Button variant="tertiary" arrow={false} onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {mode === "reject" && (
        <form
          ref={form}
          noValidate
          // Compact, so the photos it is about keep their room above it: the code to read is beside them (TagCode).
          className="flex flex-col gap-3"
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
          {/* On a short window the reason and the quick reasons scroll, so the photos keep their room and the buttons stay in
              view below them. The padding keeps the field's focus ring inside the scroller. */}
          <div className="-m-1 flex max-h-[max(7.5rem,calc(100dvh-34rem))] flex-col gap-3 overflow-y-auto overscroll-contain p-1 [@media(max-height:600px)]:max-h-none [@media(max-height:600px)]:overflow-visible">
            {heldFor && (
              <p className="text-ui text-muted">
                <span className="text-text-2">Held:</span> <LinkedIds text={heldFor} onOpen={onOpen} self={claim.id} />
              </p>
            )}
            <Field
              label="Why it's rejected"
              hint="The owner reads this on their claim page"
              error={error?.fields?.reason}
            >
              {(f) => (
                <Textarea
                  {...f}
                  rows={2}
                  maxLength={280}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => {
                    // ⌘↵ or Ctrl+Enter sends it; 1, 2… pick a quick reason while the field is empty or holds one.
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      form.current?.requestSubmit();
                    } else if ((!reason || QUICK.some((q) => q.text(claim.code) === reason)) && quickKey(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      quick(Number(e.key) - 1);
                    }
                  }}
                  autoFocus
                  required
                  minLength={REASON_MIN}
                />
              )}
            </Field>
            {/* Outlined, in the text colour: choices, not disabled chips. One row in the panel, each with its number key. */}
            {QUICK.length > 0 && <div
              className="-mt-1 flex flex-wrap gap-1.5"
              role="group"
              aria-label="Quick reasons"
              onKeyDown={(e) => {
                if (quickKey(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  quick(Number(e.key) - 1);
                }
              }}
            >
              {QUICK.map((q, i) => {
                const text = q.text(claim.code);
                return (
                  <button
                    key={q.label}
                    type="button"
                    aria-pressed={reason === text}
                    aria-keyshortcuts={String(i + 1)}
                    onClick={() => quick(i)}
                    className={clsx(
                      "inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-ui whitespace-nowrap text-text shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-160 hover:bg-surface-2 max-sm:h-11 max-sm:px-3",
                      reason === text && "bg-surface-3 shadow-[inset_0_0_0_1px_var(--text-2)]",
                    )}
                  >
                    <span aria-hidden="true" className="font-mono text-micro text-faint">
                      {i + 1}
                    </span>
                    {q.label}
                  </button>
                );
              })}
            </div>}
          </div>
          {/* On a short window the panel scrolls as one: these two stay in view at its foot. */}
          <div className="flex flex-wrap gap-3 [@media(max-height:600px)]:sticky [@media(max-height:600px)]:bottom-0 [@media(max-height:600px)]:-mb-4 [@media(max-height:600px)]:bg-surface [@media(max-height:600px)]:py-3">
            {/* The quiet button: amber is kept for moving money. */}
            <Button type="submit" variant="secondary" pending={busy} pendingLabel="Rejecting" className="flex-1 sm:flex-none">
              Reject claim
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
