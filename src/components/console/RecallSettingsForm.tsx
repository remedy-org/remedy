"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ApiError } from "@/app/console/_lib/api";
import { Button, CheckIcon, ErrorState, Field, Input } from "@/components/ui";
import { api } from "./api";

/**
 * Refund amount and auto-pay. Auto-pay pauses or resumes in one click, the stop a safety lead reaches for when something
 * looks wrong: from then on every claim that passes the checks waits for a person. Saving a refund changes new claims
 * only; decided claims keep what they were paid.
 */
export function RecallSettingsForm({ recallId, refund: savedRefund, autoPay: savedAutoPay }: { recallId: string; refund: string; autoPay: boolean }) {
  const router = useRouter();
  const [refund, setRefund] = useState(savedRefund);
  const [saved, setSaved] = useState({ refund: savedRefund, autoPay: savedAutoPay });
  const [busy, setBusy] = useState<"refund" | "autoPay" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const dirty = refund !== saved.refund;

  const save = async (next: { refund: string; autoPay: boolean }, what: "refund" | "autoPay") => {
    setBusy(what);
    setError(null);
    setDone(null);
    const res = await api<{ refund: string; autoPay: boolean }>(`/api/console/recalls/${recallId}`, { method: "PATCH", json: next });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setSaved(res.data);
    // A pause leaves a refund being typed as it is.
    if (what === "refund") setRefund(res.data.refund);
    setDone(
      what === "refund" ? "Saved. New claims use this refund." : res.data.autoPay ? "Auto-pay resumed. Passing claims are paid at once." : "Auto-pay paused. Every passing claim now waits for a person.",
    );
    router.refresh();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save({ refund, autoPay: saved.autoPay }, "refund");
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Refund per unit" help="US dollars, through PayPal." error={error?.fields?.refund}>
          {(c) => (
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-body text-muted">$</span>
              <Input
                {...c}
                mono
                inputMode="decimal"
                value={refund}
                onChange={(e) => {
                  setRefund(e.target.value);
                  setDone(null);
                }}
                className="pl-7"
              />
            </div>
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-ui font-medium text-text">Auto-pay {saved.autoPay ? "on" : "paused"}</p>
          <p className="text-ui text-muted">{saved.autoPay ? "Passing claims are paid at once." : "Passing claims wait for your approval."}</p>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            pending={busy === "autoPay"}
            pendingLabel={saved.autoPay ? "Pausing" : "Resuming"}
            onClick={() => save({ refund: saved.refund, autoPay: !saved.autoPay }, "autoPay")}
          >
            {saved.autoPay ? "Pause auto-pay" : "Resume auto-pay"}
          </Button>
        </div>
      </div>
      {error && !error.fields && <ErrorState variant="inline" title={error.error} />}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="secondary" pending={busy === "refund"} pendingLabel="Saving" disabled={!dirty}>
          Save refund
        </Button>
        <span role="status" className="inline-flex items-center gap-1.5 text-ui text-muted">
          {done && (
            <>
              <CheckIcon className="text-pay" /> {done}
            </>
          )}
          {!done && dirty && "Unsaved changes"}
        </span>
      </div>
    </form>
  );
}
