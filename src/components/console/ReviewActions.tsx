"use client";

import { useState } from "react";
import { Button, ErrorState, Field, Textarea } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
import type { DrawerClaim, ReviewedClaim } from "@/app/console/_lib/drawer";
import { api } from "./api";

type Mode = "idle" | "approve" | "reject";

export interface ReviewIntent {
  mode: "approve" | "reject";
  // Changes on every key press, so pressing A twice re-opens the confirm.
  n: number;
}

/**
 * Approve and pay, or reject with a reason, for a held claim. Paying takes a second, explicit click. A seeded claim's
 * review is a sample: the server says what it would have done, and the claim stays held. The keyboard's A and R
 * (intent) open the same confirm or form as the buttons and move focus into it; paying still takes a second press.
 */
export function ReviewActions({ claim, onDone, intent }: { claim: DrawerClaim; onDone: (c: DrawerClaim) => void; intent?: ReviewIntent | null }) {
  // A or R pressed while the panel was still loading opens the confirm as soon as it mounts.
  const [mode, setMode] = useState<Mode>(intent?.mode ?? "idle");
  // After Esc or Cancel, focus goes back to the button that opened the confirm, so a second Esc closes the panel.
  const [back, setBack] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [reason, setReason] = useState("");
  const [sample, setSample] = useState<string | null>(null);
  const [seenIntent, setSeenIntent] = useState(intent);
  if (intent !== seenIntent) {
    setSeenIntent(intent);
    if (intent && !busy) {
      setSample(null);
      setError(null);
      setMode(intent.mode);
    }
  }
  const review = claim.review;
  if (!review) return null;

  const run = async (url: string, json?: unknown) => {
    setBusy(true);
    setError(null);
    const result = await api<ReviewedClaim>(url, { method: "POST", json });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (!result.data.sample) return onDone(result.data);
    setSample(result.data.sample);
    setMode("idle");
  };

  const base = `/api/console/claims/${claim.id}`;
  const reset = () => {
    if (mode !== "idle") setBack(mode);
    setMode("idle");
    setError(null);
  };

  return (
    <div
      className="flex flex-col gap-4"
      onKeyDown={(e) => {
        // Esc cancels the open confirm or reason first; the console's own Esc (close the panel) never sees this one.
        if (e.key === "Escape" && mode !== "idle" && !busy) {
          e.preventDefault();
          e.stopPropagation();
          reset();
        }
      }}
    >
      {error && !error.fields?.reason && <ErrorState variant="inline" title={error.error} reference={error.reference} />}

      {mode === "idle" && (
        <>
          {sample ? (
            <p role="status" className="rounded-control border border-line bg-surface-2 px-4 py-3 text-ui text-muted">
              {sample}
            </p>
          ) : (
            review.note && <p className="text-ui text-muted">{review.note}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => (setSample(null), setMode("approve"))} autoFocus={back === "approve"} className="flex-1 sm:flex-none">
              {review.sample ? "Approve" : `Approve and pay ${claim.amount}${claim.sandbox ? " sandbox" : ""}`}
            </Button>
            <Button variant="secondary" onClick={() => (setSample(null), setMode("reject"))} autoFocus={back === "reject"} className="flex-1 sm:flex-none">
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
          <div className="flex flex-wrap gap-3">
            {review.sample ? (
              <Button onClick={() => run(`${base}/approve`)} pending={busy} pendingLabel="Approving the sample" autoFocus className="flex-1 sm:flex-none">
                Approve the sample
              </Button>
            ) : (
              <Button onClick={() => run(`${base}/approve`)} pending={busy} pendingLabel="Paying through PayPal" autoFocus className="flex-1 sm:flex-none">
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
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(`${base}/reject`, { reason });
          }}
        >
          <Field
            label="Why it's rejected"
            help="The owner sees this. Say what to fix, for example: the code isn't on the cut pillow."
            error={error?.fields?.reason}
          >
            {(f) => <Textarea {...f} rows={3} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus required minLength={8} />}
          </Field>
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
