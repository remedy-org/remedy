"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ApiError } from "@/app/console/_lib/api";
import { Button, CheckIcon, ErrorState, Field, Input } from "@/components/ui";
import { api } from "./api";
import { Switch } from "./Switch";

/** Refund amount and auto-pay. Saving changes new claims only; decided claims keep what they were paid. */
export function RecallSettingsForm({ recallId, refund: savedRefund, autoPay: savedAutoPay }: { recallId: string; refund: string; autoPay: boolean }) {
  const router = useRouter();
  const [refund, setRefund] = useState(savedRefund);
  const [autoPay, setAutoPay] = useState(savedAutoPay);
  const [saved, setSaved] = useState({ refund: savedRefund, autoPay: savedAutoPay });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  const dirty = refund !== saved.refund || autoPay !== saved.autoPay;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    const res = await api<{ refund: string; autoPay: boolean }>(`/api/console/recalls/${recallId}`, { method: "PATCH", json: { refund, autoPay } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSaved(res.data);
    setRefund(res.data.refund);
    setDone(true);
    router.refresh();
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
                  setDone(false);
                }}
                className="pl-7"
              />
            </div>
          )}
        </Field>
        <Field label="Auto-pay" help={autoPay ? "Passing claims are paid at once." : "Passing claims wait for your approval."}>
          {(c) => (
            <Switch
              id={c.id}
              aria-describedby={c["aria-describedby"]}
              checked={autoPay}
              onChange={(on) => {
                setAutoPay(on);
                setDone(false);
              }}
            />
          )}
        </Field>
      </div>
      {error && !error.fields && <ErrorState variant="inline" title={error.error} />}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="secondary" pending={busy} pendingLabel="Saving" disabled={!dirty}>
          Save settings
        </Button>
        <span role="status" className="inline-flex items-center gap-1.5 text-ui text-muted">
          {done && (
            <>
              <CheckIcon className="text-pay" /> Saved. New claims use these settings.
            </>
          )}
          {!done && dirty && "Unsaved changes"}
        </span>
      </div>
    </form>
  );
}
