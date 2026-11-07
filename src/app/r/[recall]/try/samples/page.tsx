import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { notYet, roundClaims } from "@/app/api/claims/_lib/pipeline";
import { FlowShell } from "@/components/claim/FlowShell";
import { WithJudges } from "@/components/claim/Judges";
import { companyName, noModelAnswer } from "@/components/claim/model";
import { SamplePicker, type DemoRun, type SampleOption } from "@/components/claim/SamplePicker";
import { DEMO_STEPS, StepMeter } from "@/components/claim/StepMeter";
import { DEMO_SAMPLES, demoSample, getAppStore, isDemoAllowed } from "@/lib/demo";
import { parseRefusal } from "@/lib/limits";
import { getDemoRound, requireSession } from "@/lib/session";
import { getRecallBySlug } from "@/lib/store";

export const metadata: Metadata = { title: "Pick a sample claim" };

// /r/<slug>/try/samples: after the PayPal login, the judge picks which sample to send. ?sample=<id> (a result's "Next
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
  const rows = round ? roundClaims(await store.listClaims(), recall.id, round, session.payerId) : [];
  const runs: DemoRun[] = rows
    .slice(0, 12)
    .map((r) => ({ id: r.id, href: `/r/${recall.slug}/try/${r.id}`, title: demoSample(r.sample ?? "")?.title ?? "Sample claim", decision: r.decision, sample: r.photoHashes.length ? r.sample : undefined, unanswered: noModelAnswer(r.decision, [r.reason]) }));
  const ran = new Set(rows.filter((r) => r.photoHashes.length > 0).map((r) => r.sample));

  const options: SampleOption[] = DEMO_SAMPLES.map((sample) => ({ sample, locked: notYet(sample, rows) ?? undefined }));
  const asked = typeof query.sample === "string" ? options.find((o) => o.sample.id === query.sample && !o.locked)?.sample.id : undefined;
  const selected = asked ?? options.find((o) => !o.locked && !ran.has(o.sample.id))?.sample.id ?? "genuine";
  const roundDone = DEMO_SAMPLES.every((s) => ran.has(s.id));

  return (
    <FlowShell demo company={companyName(recall)}>
      {/* The sample cards show each one's latest outcome, so the rail doesn't repeat them in a scoreboard. */}
      <WithJudges demo step="samples">
        <div className="flex flex-col gap-6">
          <StepMeter current={2} steps={DEMO_STEPS} />
          <SamplePicker slug={recall.slug} options={options} selected={selected} runs={runs} roundDone={roundDone} refusal={parseRefusal(query, new Date())} />
        </div>
      </WithJudges>
    </FlowShell>
  );
}
