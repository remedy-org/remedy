import { Button, EmptyState } from "@/components/ui";
import { ClaimsTable } from "@/components/console/ClaimsTable";
import { CopyField } from "@/components/console/CopyField";
import { PartialNotice } from "@/components/console/PartialNotice";
import { RecallHeading } from "@/components/console/RecallHeading";
import { StatsBand } from "@/components/console/StatsBand";
import { requireSession } from "@/lib/session";
import { claimUrl } from "./_lib/links";
import { statsOf, toRow } from "./_lib/view";
import { loadClaims, loadWorkspace, pickRecall } from "./_lib/workspace";

export const metadata = { title: "Claims" };

export default async function ConsolePage({ searchParams }: PageProps<"/console">) {
  const session = await requireSession("company", "/console");
  const wanted = (await searchParams).recall;
  const { store, recalls, unreadable: lostRecalls } = await loadWorkspace(session, wanted);
  const recall = pickRecall(recalls, wanted);

  if (!recall) {
    return (
      <main className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <PartialNotice what="recalls" ids={lostRecalls} total={lostRecalls.length} />
        <EmptyState
          className="my-auto"
          eyebrow="No recalls"
          title="Start with your first recall"
          description="Paste a CPSC recall URL. Remedy drafts the photo checks from the notice; you review them and publish a claim link."
          action={<Button href="/console/recalls/new">Import a recall</Button>}
        />
      </main>
    );
  }

  const claims = await loadClaims(store, recall, session);
  const rows = claims.map((c) => toRow(c, recall));
  const stats = statsOf(claims, recall);

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <RecallHeading
        recall={recall}
        recalls={recalls}
        basePath="/console"
        actions={
          <>
            <Button href={`/console/report?recall=${recall.id}`} variant="tertiary" size="sm">
              CPSC report
            </Button>
            <Button href={`/console/recalls/${recall.id}`} variant="secondary" size="sm">
              Recall settings
            </Button>
          </>
        }
      />
      <PartialNotice what="recalls" ids={lostRecalls} total={recalls.length + lostRecalls.length} />
      <StatsBand stats={stats} />
      {rows.length ? (
        <ClaimsTable rows={rows} />
      ) : (
        <EmptyState
          eyebrow={`Recall ${recall.id}`}
          title="No claims yet"
          description="Claims appear here as owners file them. Share the claim link on the recall notice, your site and the receipt emails."
          action={
            <div className="flex w-[min(28rem,80vw)] flex-col gap-3">
              <CopyField value={claimUrl(recall.slug)} label="Claim link" />
              <Button href={`/console/recalls/${recall.id}`} variant="tertiary" size="sm" className="self-center">
                QR code and settings
              </Button>
            </div>
          }
        />
      )}
    </main>
  );
}
