import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlowShell } from "@/components/claim/FlowShell";
import { companyName } from "@/components/claim/model";
import { SamplePicker, type DemoRun, type SampleOption } from "@/components/claim/SamplePicker";
import { DEMO_STEPS, StepMeter } from "@/components/claim/StepMeter";
import { DEMO_SAMPLES, demoSample, getAppStore, isDemoAllowed } from "@/lib/demo";
import { parseRefusal } from "@/lib/limits";
import { requireSession } from "@/lib/session";
import { getRecallBySlug } from "@/lib/store";

export const metadata: Metadata = { title: "Pick a sample claim" };

// /r/<slug>/try/samples: after the PayPal login, the judge picks which sample to send.
export default async function SamplesPage({ params, searchParams }: PageProps<"/r/[recall]/try/samples">) {
  const store = await getAppStore();
  const recall = await getRecallBySlug((await params).recall, store);
  if (!recall || !isDemoAllowed(recall)) notFound();
  const session = await requireSession("owner", `/r/${recall.slug}/try/samples`);

  // This judge's own demo claims, newest first, with the sample each one used.
  const rows = (await store.listClaims()).filter((r) => r.demo && r.payerId === session.payerId && r.recallId === recall.id);
  const claims = (await Promise.all(rows.slice(0, 12).map((r) => store.getClaim(r.id)))).filter((c) => c !== null);
  const sampleOf = (events: { type: string; detail: string }[]) => demoSample(events.find((e) => e.type === "demo_sample")?.detail ?? "");
  const runs: DemoRun[] = claims.map((c) => ({ id: c.id, href: `/r/${recall.slug}/try/${c.id}`, title: sampleOf(c.events)?.title ?? "Sample claim", decision: c.decision }));
  const ran = new Set(claims.filter((c) => c.photos.length > 0).map((c) => sampleOf(c.events)?.id));

  const options: SampleOption[] = DEMO_SAMPLES.map((sample) => ({
    sample,
    locked: sample.after && !ran.has(sample.after) ? `Send "${demoSample(sample.after)?.title}" first: this one reposts its photo.` : undefined,
  }));
  const selected = options.find((o) => !o.locked && !ran.has(o.sample.id))?.sample.id ?? "genuine";

  return (
    <FlowShell demo company={companyName(recall)}>
      <div className="flex flex-col gap-6">
        <StepMeter current={2} steps={DEMO_STEPS} />
        <SamplePicker slug={recall.slug} options={options} selected={selected} runs={runs} refusal={parseRefusal(await searchParams, new Date())} />
      </div>
    </FlowShell>
  );
}
