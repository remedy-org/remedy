import { analystModel } from "@/app/api/console/ai/guard";
import { formatDate } from "@/components/console/format";
import { PartialNotice } from "@/components/console/PartialNotice";
import { RecallPicker } from "@/components/console/RecallPicker";
import { InsightsLoader } from "@/components/insights/InsightsLoader";
import { MobileSummary } from "@/components/insights/MobileSummary";
import { Button, EmptyState, ExhibitLabel, NoBreakHyphens } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { buildInsights } from "./facts";
import { loadInsights } from "./load";

export const metadata = { title: "Insights" };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// Where the claims came from, every one of them, so the parts add up to the total and no number reads as more than it is.
function whose(total: number, samples: number, demo: number): string {
  const parts = [plural(total, "claim")];
  const live = total - samples - demo;
  if (samples === total) parts.push("all samples from the eval set, never paid to a real owner");
  else if (samples) parts.push(`${samples} ${samples === 1 ? "is a sample" : "are samples"} from the eval set, never paid to a real owner`);
  if (demo) parts.push(`${plural(demo, "judges’ demo claim")} in sandbox money`);
  if (live && live !== total) parts.push(`${plural(live, "live claim")} from ${live === 1 ? "a real owner" : "real owners"}`);
  return `${parts.join(" · ")}.`;
}

export default async function InsightsPage({ searchParams }: PageProps<"/console/insights">) {
  const session = await requireSession("company", "/console/insights");
  const { recall, recalls, claims, unreadable } = await loadInsights(session, (await searchParams).recall);

  if (!recall) {
    return (
      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          className="my-auto"
          eyebrow="No recalls"
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
          eyebrow={`CPSC ${recall.id}`}
          title="No claims to report on"
          description="The report and the analyst work from claims. They appear here as owners file them."
          action={<Button href={`/console?recall=${recall.id}`}>Go to claims</Button>}
        />
      </main>
    );
  }

  const data = buildInsights(claims, recall, new Date());
  const samples = data.claims.filter((c) => c.source === "Sample").length;
  const demo = data.claims.filter((c) => c.source === "Judges' demo").length;

  return (
    // On a laptop the report fills the window below the console header (56px and its hairline), so Studio's canvas
    // and the analyst's rail scroll on their own while the page stays put. Narrower, the page scrolls: a summary, then
    // the analyst's chat at a fixed height.
    <main className="flex flex-col lg:h-[calc(100dvh-3.5rem-1px)] lg:min-h-[36rem]">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-line px-4 pt-6 pb-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <ExhibitLabel leader="none">
            CPSC {recall.id} · Recalled {formatDate(recall.recallDate)} · Insights
          </ExhibitLabel>
          <h1 className="mt-2 text-h2 font-medium text-balance">
            <NoBreakHyphens>{recall.product}</NoBreakHyphens>
          </h1>
          <p className="mt-1.5 max-w-[100ch] text-ui text-muted">{whose(data.claims.length, samples, demo)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {recalls.length > 1 && <RecallPicker recalls={recalls.map((r) => ({ id: r.id, product: r.product }))} current={recall.id} basePath="/console/insights" />}
          <p className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-2 text-micro whitespace-nowrap text-muted" title="The analyst reads, charts and drafts. Approving, rejecting and paying stay with a person and the rule.">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-faint" />
            <span className="text-text">Recall analyst</span>
            <span className="hidden font-mono text-faint sm:inline">{analystModel()}</span>
            <span aria-hidden="true" className="text-faint">·</span>
            <span>can&rsquo;t approve or pay</span>
          </p>
        </div>
      </div>
      {unreadable.length > 0 && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <PartialNotice what="claims" ids={unreadable} total={claims.length + unreadable.length} />
        </div>
      )}
      <MobileSummary data={data} />
      <div className="h-[40rem] overflow-hidden border-t border-line lg:h-auto lg:min-h-0 lg:flex-1 lg:border-t-0">
        <InsightsLoader data={data} />
      </div>
    </main>
  );
}
