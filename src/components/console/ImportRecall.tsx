"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { ApiError } from "@/app/console/_lib/api";
import type { CpscSummary } from "@/app/console/_lib/recalls";
import Link from "next/link";
import { Button, Field, type CheckStep } from "@/components/ui";
import type { CheckSpec } from "@/lib/types";
import { api } from "./api";
import { CheckList } from "./CheckList";
import { formatCount } from "./format";
import { CpscNotice } from "./CpscNotice";
import { sameFirm } from "./firm";
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
    { id: "cpsc", label: "Read CPSC’s record", state: read, detail: notice ? `Recall ${notice.id}, ${units(notice)}` : "Product, units sold and the remedy" },
    { id: "draft", label: "Draft the photo checks", state: draft, detail: at === "draft_failed" ? "No draft came back" : "From the notice and its photos, about 15 seconds" },
    { id: "review", label: "You review and publish", state: "waiting", detail: "Nothing goes live until you publish" },
  ];
}

/**
 * A remedy other than a refund, from the notice's own words: "contact Sleep Technologies to receive a free cover" ->
 * "free cover". Remedy pays refunds for destroyed units, so a recall whose remedy is a repair, a cover or a replacement
 * needs a second look before its claim page goes live. Null when the notice offers a refund.
 */
export function otherRemedy(remedy: string): string | null {
  if (/\brefund/i.test(remedy)) return null;
  const m = remedy.match(/\bfree\s+(?:[a-z-]+\s+){0,2}?(?:cover|repair|replacement|kit|part|retrofit|inspection)s?\b|\brepair kit\b|\breplacement\b|\brepair\b|\bretrofit\b/i);
  return m ? m[0].toLowerCase() : null;
}

const blankSpec = (n: CpscSummary): CheckSpec => ({
  recall: `${n.product || n.title} (CPSC ${n.id})`,
  source: n.url,
  // CPSC's own product name to start from: the company describes it further.
  product: n.product,
  label_must_show: [],
  proof_steps: [""],
});

/** Paste a CPSC link, read the notice, let the model draft the checks, then edit and publish. company: the signed-in
 * company's name, to say so when CPSC names another firm. */
export function ImportRecall({ example, company }: { example: string; company?: string | null }) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [step, setStep] = useState<Step>({ at: "find" });
  // Each new stage takes focus at its heading, so a screen reader hears where the import is; the field keeps it while
  // CPSC is read.
  const stage = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step.at === "drafting" || step.at === "draft_failed" || step.at === "edit") stage.current?.focus();
  }, [step.at]);

  const draft = async (notice: CpscSummary) => {
    setStep({ at: "drafting", notice });
    const res = await api<CheckSpec>("/api/console/recalls/draft", { json: { ref } });
    setStep(res.ok ? { at: "edit", notice, spec: res.data, drafted: true } : { at: "draft_failed", notice, error: res.error });
  };

  const read = async (e: FormEvent) => {
    e.preventDefault();
    // Checked on submit, not by disabling the button: a disabled primary gives no reason.
    if (ref.trim().length < 5) return setStep({ at: "find", error: { error: "Paste a CPSC recall URL or number", fields: { ref: "Paste a cpsc.gov recall URL or a number like 27-068" } } });
    setStep({ at: "reading" });
    const res = await api<CpscSummary>("/api/console/recalls/import", { json: { ref } });
    if (!res.ok) return setStep({ at: "find", error: res.error });
    await draft(res.data);
  };

  if (step.at === "edit") {
    return (
      <Layout notice={step.notice} company={company} intro={INTRO.edit}>
        <h2 ref={stage} tabIndex={-1} className="sr-only">
          Photo checks
        </h2>
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
      <Layout notice={step.notice} company={company} intro={INTRO.drafting}>
        <section className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6">
          <div>
            <h2 ref={stage} tabIndex={-1} className="text-body font-medium outline-none">
              Drafting the photo checks
            </h2>
            <p className="mt-1 text-ui text-muted">From the notice and its photos, Remedy writes what an owner&rsquo;s photos must show.</p>
          </div>
          <CheckList label="Import progress" steps={importSteps(step.at, step.notice)} words={{ hold: "Didn’t finish", running: "Drafting" }} quiet={["draft"]} />
          {/* The failure in the card's own type, one line and its two ways on: no box inside the box. */}
          {step.at === "draft_failed" && (
            <div className="flex flex-col gap-3">
              <p role="alert" className="text-ui text-stop">
                {step.error.error}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" size="sm" onClick={() => draft(step.notice)}>
                  Try the draft again
                </Button>
                <Button variant="tertiary" size="sm" onClick={() => setStep({ at: "edit", notice: step.notice, spec: blankSpec(step.notice), drafted: false })}>
                  Write the checks yourself
                </Button>
              </div>
            </div>
          )}
        </section>
      </Layout>
    );
  }

  const error = step.at === "find" ? step.error : undefined;
  // The steps sit in the right column, where CPSC's card takes their place once the notice is read: nothing on the page
  // moves between steps, and a laptop's first screen isn't a narrow form beside an empty half.
  return (
    <Frame intro={INTRO.find} asideLast aside={<CheckList label="Import progress" steps={importSteps(step.at)} words={{ running: "Reading" }} className="rounded-card border border-line bg-surface px-6 py-2" />}>
      <form onSubmit={read} className="flex max-w-[40rem] flex-col gap-4" noValidate>
        {/* The field and what happened to it, 8px apart; the button 24px under them, never 48. */}
        <div className="flex flex-col gap-2">
        <Field
          label="The cpsc.gov link or recall number"
          placeholder={example}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          error={error?.fields?.ref}
          mono
          autoComplete="off"
          spellCheck={false}
          required
          // Read-only, not disabled, while CPSC is read: focus stays in the field rather than dropping to the page.
          readOnly={step.at === "reading"}
          // The page is for this one field: the cursor is in it on arrival.
          autoFocus
        />
        {/* What happened, announced: a recall already here isn't a failure, so it says where it is. */}
        <div role="status">
          {error?.existing && (
            <p className="text-ui text-text-2">
              <span className="font-mono">{error.existing}</span> is already in your workspace.{" "}
              <Link href={`/console/recalls/${error.existing}`} className="font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
                Open it <span aria-hidden="true">→</span>
              </Link>
            </p>
          )}
          {error && !error.fields?.ref && !error.existing && (
            <p role="alert" className="text-ui text-stop">
              {error.error}
            </p>
          )}
        </div>
        </div>
        <div>
          <Button type="submit" size="lg" pending={step.at === "reading"} pendingLabel="Reading the notice">
            Read the notice
          </Button>
        </div>
      </form>
    </Frame>
  );
}

// The page's heading says the step it is on: what to paste, what Remedy is doing, what to review.
const INTRO = {
  find: {
    title: "Import a recall from CPSC",
    lead: "Paste the cpsc.gov link or recall number. Remedy reads CPSC’s record, drafts the photo checks from its text and photos, and you edit them before the claim page goes live.",
  },
  drafting: {
    title: "Import a recall from CPSC",
    lead: "Remedy has read CPSC’s record and is drafting the photo checks. You review every line before anything goes live.",
  },
  edit: {
    title: "Review the photo checks",
    lead: "Edit what an owner’s photos must show, set the refund, then publish the claim link. Nothing goes live until you publish.",
  },
};

/** The page on every step: its heading, then the step's column and the right-hand one (the steps, then CPSC's card). */
function Frame({ intro, aside, asideLast, children }: { intro: { title: string; lead: string }; aside: ReactNode; asideLast?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-read">
        <p className="mb-3 font-display text-ui text-accent-text">Recall setup</p>
        <h1 className="font-display text-h2 font-semibold">{intro.title}</h1>
        <p className="mt-3 text-body text-muted">{intro.lead}</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        {/* On a phone CPSC's card leads the step it informs; the waiting steps follow the form. */}
        <div className={clsx("flex min-w-0 flex-col gap-6 lg:order-1", !asideLast && "order-2")}>{children}</div>
        <aside className={clsx("lg:sticky lg:top-6 lg:order-2", !asideLast && "order-1")}>{aside}</aside>
      </div>
    </div>
  );
}

function Layout({ notice, company, intro, children }: { notice: CpscSummary; company?: string | null; intro: { title: string; lead: string }; children: ReactNode }) {
  const other = otherRemedy(notice.remedy);
  const otherFirm = company && notice.firm && !sameFirm(notice.firm, company) ? notice.firm : null;
  return (
    <Frame intro={intro} aside={<CpscNotice notice={notice} />}>
        {/* The first thing on the page when it applies: a claim page here would pay owners to destroy what the
            recall repairs. Publishing stays possible; the company decides. */}
        {other && (
          <p className="border-l-2 border-hold pl-3 text-ui text-text">
            CPSC lists a {other} as this recall&rsquo;s remedy. Remedy pays refunds for destroyed units.
          </p>
        )}
        {/* Quiet, not a stop: a company can run a recall CPSC files under its maker or its retailer. */}
        {otherFirm && (
          <p className="text-ui text-muted">
            CPSC names {otherFirm} for this recall; you&rsquo;re signed in as {company}. Publish it only if your company runs this recall.
          </p>
        )}
        {children}
    </Frame>
  );
}
