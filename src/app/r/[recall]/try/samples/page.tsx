import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { notYet, roundClaims } from "@/app/api/claims/_lib/pipeline";
import { FlowShell, recallContext } from "@/components/claim/FlowShell";
import { ClaimFrame } from "@/components/claim/Exhibit";
import { inFourOrder } from "@/components/claim/fourOrder";
import { companyName, maskPayer, noModelAnswer, productNoun } from "@/components/claim/model";
import { SamplePicker, type DemoRun, type SampleOption } from "@/components/claim/SamplePicker";
import { askedSample, DEMO_SAMPLES, demoSample, getAppStore, isDemoAllowed } from "@/lib/demo";
import { claimRefusal, limits, parseRefusal } from "@/lib/limits";
import { getDemoRound, requireSession } from "@/lib/session";
import { getRecallBySlug } from "@/lib/store";

export const metadata: Metadata = { title: "Choose a claim" };

// /r/<slug>/try/samples: after the PayPal login, the owner picks which demo claim to send. ?claim=<name> (or the older
// ?sample=<id>) selects that one when it can run.
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

  // Listed in Fraud checks' order (fourOrder.ts); the one it opens on is the guided order's first still to run.
  const options: SampleOption[] = inFourOrder(DEMO_SAMPLES).map((sample) => ({ sample, locked: notYet(sample, rows) ?? undefined }));
  const wanted = askedSample(query);
  const asked = wanted ? options.find((o) => o.sample.id === wanted && !o.locked)?.sample.id : undefined;
  const open = (id: string) => options.find((o) => o.sample.id === id && !o.locked && !ran.has(id));
  const selected = asked ?? DEMO_SAMPLES.find((s) => open(s.id))?.id ?? "genuine";
  const roundDone = DEMO_SAMPLES.every((s) => ran.has(s.id));
  // A run the claim limits would refuse is never offered: the notice shows before "Start this claim", from the same
  // index.json read. Today's photo checks aren't read here (another Blob read on every view); the start still refuses
  // on them, and redirects back with ?limit=.
  const now = new Date();
  const refusal = parseRefusal(query, now) ?? claimRefusal(all, { payerId: session.payerId, demo: true, now, limits: limits() });

  return (
    <FlowShell context={recallContext(recall)}>
      <ClaimFrame>
        <SamplePicker
          slug={recall.slug}
          company={companyName(recall)}
          options={options}
          selected={selected}
          runs={runs}
          roundDone={roundDone}
          refusal={refusal}
          product={productNoun(recall)}
          signedInAs={session.name ?? maskPayer(session.payerId)}
          cleared={query.cleared === "1" && !runs.length}
        />
      </ClaimFrame>
    </FlowShell>
  );
}
