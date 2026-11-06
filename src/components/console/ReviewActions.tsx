"use client";

import { useState } from "react";
import { Button, ErrorState, Field, Textarea } from "@/components/ui";
import type { ApiError } from "@/app/console/_lib/api";
import type { DrawerClaim } from "@/app/console/_lib/drawer";
import { api } from "./api";

type Mode = "idle" | "approve" | "reject";

/** Approve and pay, or reject with a reason, for a held claim. Paying takes a second, explicit click. */
export function ReviewActions({ claim, onDone }: { claim: DrawerClaim; onDone: (c: DrawerClaim) => void }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [reason, setReason] = useState("");
  const review = claim.review;
  if (!review) return null;

  const run = async (url: string, json?: unknown) => {
    setBusy(true);
    setError(null);
    const result = await api<DrawerClaim>(url, { method: "POST", json });
    setBusy(false);
    if (result.ok) onDone(result.data);
    else setError(result.error);
  };

  const base = `/api/console/claims/${claim.id}`;
  const reset = () => {
    setMode("idle");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && !error.fields?.reason && <ErrorState variant="inline" title={error.error} reference={error.reference} />}

      {mode === "idle" && (
        <>
          {review.note && <p className="text-ui text-muted">{review.note}</p>}
          <div className="flex flex-wrap gap-3">
            {review.approve && (
              <Button onClick={() => setMode("approve")} className="flex-1 sm:flex-none">
                Approve and pay {claim.amount}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setMode("reject")} className="flex-1 sm:flex-none">
              Reject
            </Button>
          </div>
        </>
      )}

      {mode === "approve" && (
        <>
          <p className="text-ui text-muted">
            Remedy runs the duplicate and account checks again, then sends <span className="font-mono text-text">{claim.amount}</span> to{" "}
            <span className="font-mono text-text">{claim.payer}</span> from your PayPal business account.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => run(`${base}/approve`)} pending={busy} pendingLabel="Paying through PayPal" className="flex-1 sm:flex-none">
              Pay {claim.amount}
            </Button>
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
