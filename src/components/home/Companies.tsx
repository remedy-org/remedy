import { ARRIVE_ID, PREVIEW_OPEN_ID, previewProps, replicaRows, reportPreview } from "@/components/console/preview";
import { ProgressReport } from "@/components/console/ProgressReport";
import { STUDIO_ON_HOME } from "@/components/insights/InsightsPreviewLazy";
import { InsightsStill } from "@/components/insights/InsightsStill";
import { insightsPreview, insightsPreviewForStudio } from "@/components/insights/preview";
import { insightsStill } from "@/components/insights/still";
import { Button } from "@/components/ui";
import { AnalystRail, RECORDING } from "./AnalystRail";
import { ConsoleStory } from "./ConsoleStory";
import { ConsoleTour } from "./ConsoleTour";
import { Section } from "./Section";
import { describe, stepSentences, TOUR } from "./tour-copy";

// The Insights canvas in Studio's 16px rows: the frame's body (776px less chrome and title row) less its padding.
const STUDIO_ROWS = 40;

// Without JS the tour's tabs can't work: the story shows at every width instead (the HeroDevice.tsx pattern), its
// photos shown (they fade in on load, which needs JS).
const NOSCRIPT = `<style>[data-tour]{display:none!important}[data-story]{display:block!important}[data-story] img{opacity:1!important}</style>`;

/**
 * For companies: a four-step tour of the console on laptops (ConsoleTour), the same four steps as a story on phones and
 * without JS (ConsoleStory). Everything in both comes from one seed (components/console/preview.ts): the 40 claims,
 * their Insights and their CPSC report draft. The server renders both; CSS shows one by breakpoint.
 */
export function Companies() {
  const grid = previewProps();
  const replica = replicaRows(grid.rows);
  const still = insightsStill(insightsPreview());
  const { recall, report, generated } = reportPreview();
  const evidence = grid.rows.find((r) => r.id === PREVIEW_OPEN_ID)?.evidence ?? null;
  // Step 03 names the recall analyst only when its recorded answer is there to show.
  const sentences = stepSentences(Boolean(RECORDING));
  const descriptions = describe(still.totals, { id: PREVIEW_OPEN_ID, amount: evidence?.amount ?? "" }, RECORDING);
  const sheet = <ProgressReport recall={recall} report={report} generated={generated} />;

  return (
    <Section id="companies" title={TOUR.title} muted={TOUR.muted} headingSpan={9} bodyClassName="mt-12">
      <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT }} />
      <div data-tour className="hidden lg:block">
        <ConsoleTour
          rows={grid.rows}
          sentences={sentences}
          ledger={grid.ledger!}
          counts={grid.counts!}
          openId={PREVIEW_OPEN_ID}
          arriveId={ARRIVE_ID}
          descriptions={descriptions}
          insights={<InsightsStill data={still} rail={RECORDING ? <AnalystRail /> : undefined} refusalNote={TOUR.refusalNote} />}
          report={sheet}
          studio={STUDIO_ON_HOME ? { data: insightsPreviewForStudio(), rows: STUDIO_ROWS } : null}
        />
      </div>
      <div data-story className="max-w-[720px] lg:hidden">
        <ConsoleStory replica={replica} sentences={sentences} evidence={evidence} insights={<InsightsStill data={still} rail={RECORDING ? <AnalystRail form="phone" /> : undefined} form="phone" />} report={sheet} />
      </div>

      <div className="mt-14 grid-12 gap-y-6 lg:mt-16 lg:items-center">
        <p className="col-span-12 max-w-[60ch] text-body text-pretty text-text-2 lg:col-span-7">{TOUR.cta.body}</p>
        <Button href="/signin" variant="secondary" size="lg" className="col-span-12 w-full justify-center sm:w-auto sm:justify-self-start lg:col-span-5 lg:col-start-8 lg:justify-self-end">
          {TOUR.cta.button}
        </Button>
      </div>
    </Section>
  );
}
