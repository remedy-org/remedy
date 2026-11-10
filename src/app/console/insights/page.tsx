import { PartialNotice } from "@/components/console/PartialNotice";
import { RecallPicker } from "@/components/console/RecallPicker";
import { WorkspaceNote } from "@/components/console/WorkspaceNote";
import { InsightsLoader } from "@/components/insights/InsightsLoader";
import { InsightsReport } from "@/components/insights/InsightsReport";
import { MobileSummary } from "@/components/insights/MobileSummary";
import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";
import { INSIGHTS_ACTIONS } from "@/components/insights/actions";
import { keepHyphens } from "@/components/console/format";
import { studioLicence } from "@/lib/agStudioLicence";
import { requireSession } from "@/lib/session";
import { viewerOf } from "../_lib/workspace";
import { buildInsights } from "./facts";
import { loadInsights } from "./load";

export const metadata = { title: "Insights" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "7 claims · filed 5–7 Nov 2026": how many, and the UTC days they were filed on, as the console dates a claim. */
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
  const session = await viewerOf(await requireSession("company", "/console/insights"));
  const { recall, recalls, claims, unreadable } = await loadInsights(session, (await searchParams).recall);

  if (!recall) {
    return (
      <main className="page flex flex-1 flex-col py-8">
        <EmptyState
          className="my-auto"
          title="Nothing to analyse yet"
          description="Insights reads a recall’s claims. Import a recall and share its claim link; the report fills in as owners file."
          action={<Button href="/console/recalls/new">Import a recall</Button>}
        />
      </main>
    );
  }

  if (!claims.length) {
    return (
      <main className="page flex flex-1 flex-col py-8">
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
    // The page scrolls as one: Studio's canvas is sized to the report, so no panel scrolls inside another. The analyst's
    // sheet floats over the page's right edge (insights.css), so opening it reflows neither the header nor the report.
    <main className="flex flex-col pb-8">
      {/* The note over the page's full width, as on Claims, so it breaks where Claims' does. */}
      <div className="page pt-8 pb-5">
        <div className="mb-3 empty:hidden">
          <WorkspaceNote recall={recall} recalls={recalls} company={session.name} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className="mb-2 font-display text-micro text-accent-text">Recall insights</p>
            <h1 className="font-display text-h2 font-semibold text-balance">{keepHyphens(recall.product)}</h1>
            <p className="mt-1.5 text-ui text-muted">
              {filed(data.claims.map((c) => c.filedAt))} ·{" "}
              <Link href={`/console?recall=${recall.id}`} className="text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
                Open in Claims
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath="/console/insights" />}
            {/* "Ask the analyst" lands here once Studio's report has loaded (InsightsStudio); Remedy's own report has no analyst. */}
            <div id={INSIGHTS_ACTIONS} className="contents" />
          </div>
        </div>
      </div>
      {unreadable.length > 0 && (
        <div className="page pt-4">
          <PartialNotice what="claims" ids={unreadable} total={claims.length + unreadable.length} />
        </div>
      )}
      <MobileSummary data={data} />
      {/* AG Studio only under a valid, unexpired key; otherwise Remedy's own report, and Studio's module never loads. */}
      <div className="hidden sm:block">{studioLicence() ? <InsightsLoader data={data} /> : <InsightsReport data={data} />}</div>
    </main>
  );
}
