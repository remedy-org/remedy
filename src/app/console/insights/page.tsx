import { PartialNotice } from "@/components/console/PartialNotice";
import { RecallPicker } from "@/components/console/RecallPicker";
import { InsightsLoader } from "@/components/insights/InsightsLoader";
import { MobileSummary } from "@/components/insights/MobileSummary";
import { Button, EmptyState, NoBreakHyphens } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { buildInsights } from "./facts";
import { loadInsights } from "./load";

export const metadata = { title: "Insights" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "40 claims · filed 4–7 Nov 2026": how many, and the UTC days they were filed on, as the console dates a claim. */
function filed(dates: string[]): string {
  const n = `${dates.length.toLocaleString("en-US")} ${dates.length === 1 ? "claim" : "claims"}`;
  const days = dates.map((d) => d.slice(0, 10)).sort();
  if (!days.length) return n;
  const part = (iso: string) => ({ d: Number(iso.slice(8, 10)), m: MONTHS[Number(iso.slice(5, 7)) - 1], y: iso.slice(0, 4) });
  const a = part(days[0]);
  const b = part(days.at(-1)!);
  const range =
    a.y !== b.y ? `${a.d} ${a.m} ${a.y} – ${b.d} ${b.m} ${b.y}` : a.m !== b.m ? `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}` : a.d !== b.d ? `${a.d}–${b.d} ${b.m} ${b.y}` : `${b.d} ${b.m} ${b.y}`;
  return `${n} · filed ${range}`;
}

export default async function InsightsPage({ searchParams }: PageProps<"/console/insights">) {
  const session = await requireSession("company", "/console/insights");
  const { recall, recalls, claims, unreadable } = await loadInsights(session, (await searchParams).recall);

  if (!recall) {
    return (
      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          className="my-auto"
          title="Nothing to analyse yet"
          description="Insights reads a recall's claims. Import a recall and share its claim link; the report fills in as owners file."
          action={<Button href="/console/recalls/new">Import a recall</Button>}
        />
      </main>
    );
  }

  if (!claims.length) {
    return (
      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <PartialNotice what="claims" ids={unreadable} total={unreadable.length} />
        <EmptyState
          className="my-auto"
          title="No claims to report on"
          description="The report and the analyst work from claims. They appear here as owners file them."
          action={<Button href={`/console?recall=${recall.id}`}>Go to claims</Button>}
        />
      </main>
    );
  }

  const data = buildInsights(claims, recall, new Date());

  return (
    // On a laptop the report fills the window below the console header (56px and its hairline), so Studio's canvas
    // and the analyst's rail scroll on their own while the page stays put. Narrower, the page scrolls a summary.
    <main className="flex flex-col lg:h-[calc(100dvh-3.5rem-1px)] lg:min-h-[36rem]">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-4 pt-8 pb-5 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-h2 font-medium text-balance">
            <NoBreakHyphens>{recall.product}</NoBreakHyphens>
          </h1>
          <p className="mt-1.5 text-ui text-muted">{filed(data.claims.map((c) => c.filedAt))}</p>
        </div>
        {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath="/console/insights" />}
      </div>
      {unreadable.length > 0 && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <PartialNotice what="claims" ids={unreadable} total={claims.length + unreadable.length} />
        </div>
      )}
      <MobileSummary data={data} />
      <div className="hidden min-h-0 flex-1 overflow-hidden lg:block">
        <InsightsLoader data={data} />
      </div>
    </main>
  );
}
