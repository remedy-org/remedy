import { Button, EmptyState } from "@/components/ui";
import { ClaimsQueue } from "@/components/console/ClaimsQueue";
import { CopyField } from "@/components/console/CopyField";
import { PartialNotice } from "@/components/console/PartialNotice";
import { RecallHeading } from "@/components/console/RecallHeading";
import { requireSession } from "@/lib/session";
import { claimUrl } from "./_lib/links";
import { gridRows } from "./_lib/queue";
import { loadClaims, loadWorkspace, pickRecall } from "./_lib/workspace";

export const metadata = { title: "Claims" };

// On laptops the queue fills the viewport under the 56px header (plus its hairline) and the page itself never
// scrolls; the grid scrolls inside. Phones keep the page's own scroll.
const VIEWPORT = "lg:h-[calc(100dvh-57px)] lg:min-h-[640px] lg:flex-none lg:overflow-hidden";

export default async function ConsolePage({ searchParams }: PageProps<"/console">) {
  const session = await requireSession("company", "/console");
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const wanted = params.recall;
  const { store, recalls, unreadable: lostRecalls } = await loadWorkspace(session, wanted);
  const recall = pickRecall(recalls, wanted);

  if (!recall) {
    return (
      <main className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <PartialNotice what="recalls" ids={lostRecalls} total={lostRecalls.length} />
        <EmptyState
          className="my-auto"
          title="Start with your first recall"
          description="Paste a CPSC recall URL. Remedy drafts the photo checks from the notice; you review them and publish a claim link."
          action={<Button href="/console/recalls/new">Import a recall</Button>}
        />
      </main>
    );
  }

  const claims = await loadClaims(store, recall, session);
  const rows = gridRows(claims, recall, session);

  return (
    <main className={`flex flex-1 flex-col gap-4 px-4 pt-6 pb-3 sm:px-6 lg:px-8 ${rows.length ? VIEWPORT : ""}`}>
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
              Recall details
            </Button>
          </>
        }
      />
      <PartialNotice what="recalls" ids={lostRecalls} total={recalls.length + lostRecalls.length} />
      {rows.length ? (
        // Keyed by recall: switching recalls starts a fresh queue (tabs, search, live updates).
        <ClaimsQueue
          key={recall.id}
          recall={{ id: recall.id, unitsSold: recall.unitsSold }}
          rows={rows}
          at={new Date().toISOString()}
          initialTab={one(params.tab)}
          initialSearch={one(params.q)}
          initialOpen={one(params.claim)}
        />
      ) : (
        <EmptyState
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
