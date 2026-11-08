"use client";

import { useState, type FormEvent } from "react";
import type { ApiError } from "@/app/console/_lib/api";
import type { CpscSummary } from "@/app/console/_lib/recalls";
import { Button, ErrorState, Field, Input, Textarea } from "@/components/ui";
import type { CheckSpec } from "@/lib/types";
import { api } from "./api";
import { ListEditor } from "./ListEditor";
import { Switch } from "./Switch";

export interface PublishFormProps {
  cpscRef: string;
  notice: CpscSummary;
  initial: CheckSpec;
  // false when the company is writing the checks from scratch.
  drafted: boolean;
  onPublished: (id: string) => void;
  onStartOver: () => void;
}

// Field errors keyed by index, from the API's "spec.proof_steps.1" style paths.
const indexed = (fields: Record<string, string> | undefined, prefix: string) =>
  Object.fromEntries(
    Object.entries(fields ?? {})
      .filter(([k]) => k.startsWith(`${prefix}.`))
      .map(([k, v]) => [Number(k.slice(prefix.length + 1)), v]),
  );

/** A proof step's placeholder in the notice's own words: "Cut the pillow in half", from "...asked to cut the pillow in
 * half after confirming...". */
export function proofHint(remedy: string): string {
  const act = remedy.match(/\b(?:cut|destroy|puncture|discard|dispose of|throw away|remove)\b.*?(?=\s+(?:after|and|then|before|to|by)\b|[.,;]|$)/i)?.[0];
  return act && act.length <= 60 ? act[0].toUpperCase() + act.slice(1) : "Cut fully in half";
}

/** The drafted checks, editable, then the refund, auto-pay and claim link. Publishing makes /r/<slug> live. */
export function PublishForm({ cpscRef, notice, initial, drafted, onPublished, onStartOver }: PublishFormProps) {
  const [spec, setSpec] = useState(initial);
  const [refund, setRefund] = useState("");
  const [autoPay, setAutoPay] = useState(false);
  const [slug, setSlug] = useState(notice.slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const f = error?.fields;
  // Why Publish can't be pressed yet, said beside it: a disabled button gives no reason of its own.
  const missing = !spec.product.trim() ? "Describe the product to publish." : !refund.trim() ? "Set the refund per unit to publish." : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const clean = { ...spec, label_must_show: spec.label_must_show.filter((s) => s.trim()), note: spec.note?.trim() || undefined };
    const res = await api<{ id: string }>("/api/console/recalls", { json: { ref: cpscRef, spec: clean, refund, autoPay, slug } });
    if (res.ok) return onPublished(res.data.id);
    setBusy(false);
    setError(res.error);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8" noValidate>
      <section className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6">
        <div>
          <h2 className="text-body font-medium">What an owner&apos;s photos must show</h2>
          <p className="mt-1 text-ui text-muted">
            {drafted ? "Drafted from the notice. " : ""}The model checks every claim against these lines, and money moves only if each one is visibly confirmed. Ask only
            for what a photo can show.
          </p>
        </div>

        <Field label="The product" help="Its look, from the notice's photos: shape, colours, prints and distinctive parts." error={f?.["spec.product"]}>
          {(c) => <Textarea {...c} rows={3} className="field-sizing-content" value={spec.product} onChange={(e) => setSpec({ ...spec, product: e.target.value })} />}
        </Field>

        <ListEditor
          legend="The label must show"
          help="Identifiers such as model numbers or date codes, each with where it sits. Leave empty if the product has no label."
          items={spec.label_must_show}
          onChange={(label_must_show) => setSpec({ ...spec, label_must_show })}
          addLabel="Add a label line"
          errors={indexed(f, "spec.label_must_show")}
          placeholder="Model NP001, printed on the sewn-in tag"
        />

        <ListEditor
          legend="Proof steps"
          items={spec.proof_steps}
          onChange={(proof_steps) => setSpec({ ...spec, proof_steps })}
          addLabel="Add a step"
          min={1}
          errors={indexed(f, "spec.proof_steps")}
          placeholder={proofHint(notice.remedy)}
        />
        {f?.["spec.proof_steps"] && <p className="-mt-4 text-ui text-stop">{f["spec.proof_steps"]}</p>}

        {spec.note !== undefined && (
          <Field label="Note from the draft" hint="Reviewers only">
            {(c) => <Textarea {...c} rows={2} className="field-sizing-content" value={spec.note ?? ""} onChange={(e) => setSpec({ ...spec, note: e.target.value })} />}
          </Field>
        )}
      </section>

      <section className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6">
        <h2 className="text-body font-medium">Refund and claim link</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Refund per unit" error={f?.refund}>
            {(c) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-body text-muted">$</span>
                <Input {...c} mono inputMode="decimal" placeholder="29.99" value={refund} onChange={(e) => setRefund(e.target.value)} className="pl-7" />
              </div>
            )}
          </Field>
          <Field label="Auto-pay" help={autoPay ? "Passing claims are paid at once." : "A person approves each passing claim."}>
            {(c) => <Switch id={c.id} aria-describedby={c["aria-describedby"]} checked={autoPay} onChange={setAutoPay} />}
          </Field>
        </div>
        <Field label="Claim link" error={f?.slug}>
          {(c) => (
            <div className="flex min-w-0 items-stretch overflow-hidden rounded-control border border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
              <span className="flex items-center border-r border-line-strong bg-surface-2 px-3 font-mono text-ui text-muted">/r/</span>
              <input
                id={c.id}
                aria-describedby={c["aria-describedby"]}
                aria-invalid={c.invalid || undefined}
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                spellCheck={false}
                className="h-11 min-w-0 flex-1 bg-surface px-3 font-mono text-ui text-text focus-visible:outline-none"
              />
            </div>
          )}
        </Field>
      </section>

      {error && !f && <ErrorState variant="inline" title={error.error} />}
      {error && f && <ErrorState variant="inline" title="Some fields need a fix" description="Each one is marked above." />}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Not ready: a neutral button, not a dimmed amber; the line beside it says what's missing. */}
        <Button
          type="submit"
          size="lg"
          variant={missing ? "secondary" : "primary"}
          pending={busy}
          pendingLabel="Publishing"
          disabled={Boolean(missing)}
          aria-describedby={missing ? "publish-missing" : undefined}
        >
          Publish the claim page
        </Button>
        {missing && (
          <p id="publish-missing" className="text-ui text-muted">
            {missing}
          </p>
        )}
        <Button variant="tertiary" arrow={false} onClick={onStartOver} disabled={busy}>
          Start over with another recall
        </Button>
      </div>
    </form>
  );
}
