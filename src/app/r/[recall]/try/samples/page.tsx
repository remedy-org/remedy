import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { notYet, roundClaims } from "@/app/api/claims/_lib/pipeline";
import { FlowShell } from "@/components/claim/FlowShell";
import { ClaimFrame } from "@/components/claim/Exhibit";
import { companyName, noModelAnswer } from "@/components/claim/model";
import { SamplePicker, type DemoRun, type SampleOption } from "@/components/claim/SamplePicker";
import { DEMO_STEPS, StepMeter } from "@/components/claim/StepMeter";
import { DEMO_SAMPLES, demoSample, getAppStore, isDemoAllowed } from "@/lib/demo";
import { claimRefusal, limits, parseRefusal } from "@/lib/limits";
import { getDemoRound, requireSession } from "@/lib/session";
import { getRecallBySlug } from "@/lib/store";

export const metadata: Metadata = { title: "Choose a claim" };

// /r/<slug>/try/samples: after the PayPal login, the owner picks which demo claim to send. ?sample=<id> (a result's "Next
// sample") selects that one when it can run.
export default async function SamplesPage({ params, searchParams }: PageProps<"/r/[recall]/try/samples">) {
  const store = await getAppStore();
  const recall = await getRecallBySlug((await params).recall, store);
  if (!recall || !isDemoAllowed(recall)) notFound();
  const session = await requireSession("owner", `/r/${recall.slug}/try/samples`);
  const query = await searchParams;

  // This round's demo claims for this PayPal account, newest first, with the sample each one used: all from
  // index.json's rows. The proxy started a round for this browser if it had none.
  const round = await getDemoRound();
  const all = await store.listClaims();
  const rows = round ? roundClaims(all, recall.id, round, session.payerId) : [];
  const runs: DemoRun[] = rows
    .slice(0, 12)
    .map((r) => ({ id: r.id, href: `/r/${recall.slug}/try/${r.id}`, title: demoSample(r.sample ?? "")?.title ?? "Demo claim", decision: r.decision, sample: r.photoHashes.length ? r.sample : undefined, unanswered: noModelAnswer(r.decision, [r.reason]) }));
  const ran = new Set(rows.filter((r) => r.photoHashes.length > 0).map((r) => r.sample));

  const options: SampleOption[] = DEMO_SAMPLES.map((sample) => ({ sample, locked: notYet(sample, rows) ?? undefined }));
  const asked = typeof query.sample === "string" ? options.find((o) => o.sample.id === query.sample && !o.locked)?.sample.id : undefined;
  const selected = asked ?? options.find((o) => !o.locked && !ran.has(o.sample.id))?.sample.id ?? "genuine";
  const roundDone = DEMO_SAMPLES.every((s) => ran.has(s.id));
  // A run the claim limits would refuse is never offered: the notice shows before "Run this sample", from the same
  // index.json read. Today's photo checks aren't read here (another Blob read on every view); the start still refuses
  // on them, and redirects back with ?limit=.
  const now = new Date();
  const refusal = parseRefusal(query, now) ?? claimRefusal(all, { payerId: session.payerId, demo: true, now, limits: limits() });

  return (
    <FlowShell>
      <ClaimFrame>
        {/* Once all four have run, the page is their record, not a step: no meter. */}
        {!roundDone && <StepMeter current={2} steps={DEMO_STEPS} />}
        <SamplePicker slug={recall.slug} company={companyName(recall)} options={options} selected={selected} runs={runs} roundDone={roundDone} refusal={refusal} />
      </ClaimFrame>
    </FlowShell>
  );
}
