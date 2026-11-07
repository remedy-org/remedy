"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ApiError } from "@/app/console/_lib/api";
import type { CpscSummary } from "@/app/console/_lib/recalls";
import { Button, CheckProgress, ErrorState, Field } from "@/components/ui";
import type { CheckSpec } from "@/lib/types";
import { api } from "./api";
import { CpscNotice } from "./CpscNotice";
import { PublishForm } from "./PublishForm";

type Step =
  | { at: "find"; error?: ApiError }
  | { at: "reading" }
  | { at: "drafting"; notice: CpscSummary }
  | { at: "draft_failed"; notice: CpscSummary; error: ApiError }
  | { at: "edit"; notice: CpscSummary; spec: CheckSpec; drafted: boolean };

const blankSpec = (n: CpscSummary): CheckSpec => ({
  recall: `${n.product || n.title} (CPSC ${n.id})`,
  source: n.url,
  product: "",
  label_must_show: [],
  proof_steps: [""],
});

/** Paste a CPSC link, read the notice, let the model draft the checks, then edit and publish. */
export function ImportRecall({ example }: { example: string }) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [step, setStep] = useState<Step>({ at: "find" });

  const draft = async (notice: CpscSummary) => {
    setStep({ at: "drafting", notice });
    const res = await api<CheckSpec>("/api/console/recalls/draft", { json: { ref } });
    setStep(res.ok ? { at: "edit", notice, spec: res.data, drafted: true } : { at: "draft_failed", notice, error: res.error });
  };

  const read = async (e: FormEvent) => {
    e.preventDefault();
    // Checked on submit, not by disabling the button: a disabled primary gives no reason.
    if (ref.trim().length < 5) return setStep({ at: "find", error: { error: "Paste a CPSC recall URL or number", fields: { ref: "Paste a cpsc.gov recall URL or a number like 27-071" } } });
    setStep({ at: "reading" });
    const res = await api<CpscSummary>("/api/console/recalls/import", { json: { ref } });
    if (!res.ok) return setStep({ at: "find", error: res.error });
    await draft(res.data);
  };

  if (step.at === "edit") {
    return (
      <Layout notice={step.notice}>
        <PublishForm
          cpscRef={ref}
          notice={step.notice}
          initial={step.spec}
          drafted={step.drafted}
          onPublished={(id) => router.push(`/console/recalls/${id}?published=1`)}
          onStartOver={() => setStep({ at: "find" })}
        />
      </Layout>
    );
  }

  if (step.at === "drafting" || step.at === "draft_failed") {
    return (
      <Layout notice={step.notice}>
        <section className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6">
          <div>
            <h2 className="text-body font-medium">Drafting the photo checks</h2>
            <p className="mt-1 text-ui text-muted">The model reads the notice and its photos, then writes what an owner&apos;s photos must show. You review every line before it goes live.</p>
          </div>
          <CheckProgress
            label="Import progress"
            steps={[
              { id: "cpsc", label: "Read CPSC's record", state: "pass", detail: `Recall ${step.notice.id}, ${step.notice.units || "unit count not given"}` },
              {
                id: "draft",
                label: "Draft the checks",
                state: step.at === "drafting" ? "running" : "hold",
                detail: step.at === "drafting" ? "About 15 seconds" : "No draft came back",
              },
              { id: "review", label: "You review and publish", state: "waiting" },
            ]}
          />
          {step.at === "draft_failed" && (
            <ErrorState
              variant="inline"
              title={step.error.error}
              action={
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" size="sm" onClick={() => draft(step.notice)}>
                    Try the draft again
                  </Button>
                  <Button variant="tertiary" size="sm" onClick={() => setStep({ at: "edit", notice: step.notice, spec: blankSpec(step.notice), drafted: false })}>
                    Write the checks yourself
                  </Button>
                </div>
              }
            />
          )}
        </section>
      </Layout>
    );
  }

  const error = step.at === "find" ? step.error : undefined;
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,40rem)_22rem] lg:gap-16">
      <form onSubmit={read} className="flex flex-col gap-6" noValidate>
        <Field
          label="CPSC recall URL or number"
          placeholder={example}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          error={error?.fields?.ref}
          help="The notice's page on cpsc.gov, or its number, such as 27-071."
          mono
          autoComplete="off"
          spellCheck={false}
          required
          disabled={step.at === "reading"}
        />
        {error && !error.fields?.ref && (
          <ErrorState
            variant="inline"
            title={error.error}
            action={
              error.existing ? (
                <Button href={`/console/recalls/${error.existing}`} variant="tertiary" size="sm">
                  Open recall {error.existing}
                </Button>
              ) : undefined
            }
          />
        )}
        <div>
          <Button type="submit" size="lg" pending={step.at === "reading"} pendingLabel="Reading the notice">
            Read the notice
          </Button>
        </div>
      </form>
      <aside className="rounded-card border border-line p-6">
        <h2 className="text-ui font-medium text-text">What happens next</h2>
        <CheckProgress
          label="Import steps"
          className="mt-2"
          steps={[
            { id: "cpsc", label: "Read CPSC's record", state: step.at === "reading" ? "running" : "waiting", detail: "Product, units sold and the remedy" },
            { id: "draft", label: "Draft the checks", state: "waiting", detail: "The model reads the notice and its photos" },
            { id: "review", label: "You review and publish", state: "waiting", detail: "Nothing goes live until you publish" },
          ]}
        />
      </aside>
    </div>
  );
}

function Layout({ notice, children }: { notice: CpscSummary; children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <div className="order-2 min-w-0 lg:order-1">{children}</div>
      <aside className="order-1 lg:sticky lg:top-6 lg:order-2">
        <CpscNotice notice={notice} />
      </aside>
    </div>
  );
}
