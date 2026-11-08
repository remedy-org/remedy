"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ApiError } from "@/app/console/_lib/api";
import type { CpscSummary } from "@/app/console/_lib/recalls";
import Link from "next/link";
import { Button, ErrorState, Field, type CheckStep } from "@/components/ui";
import type { CheckSpec } from "@/lib/types";
import { api } from "./api";
import { CheckList } from "./CheckList";
import { formatCount } from "./format";
import { CpscNotice } from "./CpscNotice";
import { PublishForm } from "./PublishForm";

type Step =
  | { at: "find"; error?: ApiError }
  | { at: "reading" }
  | { at: "drafting"; notice: CpscSummary }
  | { at: "draft_failed"; notice: CpscSummary; error: ApiError }
  | { at: "edit"; notice: CpscSummary; spec: CheckSpec; drafted: boolean };

const units = (n: CpscSummary) => (n.unitsSold ? `about ${formatCount(n.unitsSold)} units` : "no unit count given");

/** The import's three steps, named for what each one does, with where this import has got to. */
function importSteps(at: Step["at"], notice?: CpscSummary): CheckStep[] {
  const read = at === "reading" ? "running" : notice ? "pass" : "waiting";
  const draft = at === "drafting" ? "running" : at === "draft_failed" ? "hold" : "waiting";
  return [
    { id: "cpsc", label: "Read CPSC's record", state: read, detail: notice ? `Recall ${notice.id}, ${units(notice)}` : "Product, units sold and the remedy" },
    { id: "draft", label: "Draft the photo checks", state: draft, detail: at === "draft_failed" ? "No draft came back" : "The model reads the notice and its photos, about 15 seconds" },
    { id: "review", label: "You review and publish", state: "waiting", detail: "Nothing goes live until you publish" },
  ];
}

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
          <CheckList label="Import progress" steps={importSteps(step.at, step.notice)} words={{ hold: "Didn't finish" }} />
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
    <div className="flex max-w-[40rem] flex-col gap-8">
      <form onSubmit={read} className="flex flex-col gap-6" noValidate>
        <Field
          label="CPSC recall URL or number"
          placeholder={example}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          error={error?.fields?.ref}
          mono
          autoComplete="off"
          spellCheck={false}
          required
          disabled={step.at === "reading"}
        />
        {/* A recall already here isn't a failure: say where it is. */}
        {error?.existing && (
          <p className="text-ui text-text-2">
            <span className="font-mono">{error.existing}</span> is already in your workspace.{" "}
            <Link href={`/console/recalls/${error.existing}`} className="font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
              Open it <span aria-hidden="true">→</span>
            </Link>
          </p>
        )}
        {error && !error.fields?.ref && !error.existing && (
          <ErrorState
            variant="inline"
            title={error.error}
          />
        )}
        <div>
          <Button type="submit" size="lg" pending={step.at === "reading"} pendingLabel="Reading the notice">
            Read the notice
          </Button>
        </div>
      </form>
      {step.at === "reading" && <CheckList label="Import progress" steps={importSteps(step.at)} className="rounded-card border border-line bg-surface px-6 py-2" />}
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
