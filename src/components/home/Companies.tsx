import { ARRIVE_ID, PREVIEW_OPEN_ID, previewProps, reportPreview, STILL_ROWS } from "@/components/console/preview";
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
  const still = insightsStill(insightsPreview());
  const { recall, report, generated } = reportPreview();
  const evidence = grid.rows.find((r) => r.id === PREVIEW_OPEN_ID)?.evidence ?? null;
  // Step 03 names the recall analyst only when its recorded answer is there to show.
  const sentences = stepSentences(Boolean(RECORDING));
  const descriptions = describe(still.totals, { id: PREVIEW_OPEN_ID, amount: evidence?.amount ?? "" }, RECORDING);
  const sheet = <ProgressReport recall={recall} report={report} generated={generated} home />;

  return (
    <Section
      id="companies"
      exhibit="For companies"
      title={TOUR.title}
      // Its own block, so it fills the measure (pretty) instead of breaking early to balance (the heading's text-balance).
      muted={<span className="block text-pretty">{TOUR.muted}</span>}
      headingSpan={12}
      bodyClassName="mt-10 lg:mt-8"
      // The console frame and its heading share one laptop screen: less air above than the page's other sections.
      padClassName="py-18 lg:pt-20 lg:pb-32"
      reveal="rise"
    >
      <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT }} />
      <div data-tour className="hidden lg:block">
        <ConsoleTour
          rows={grid.rows}
          stillRows={STILL_ROWS}
          sentences={sentences}
          unitsSold={recall.unitsSold}
          openId={PREVIEW_OPEN_ID}
          arriveId={ARRIVE_ID}
          descriptions={descriptions}
          insights={<InsightsStill data={still} rail={RECORDING ? <AnalystRail /> : undefined} flat />}
          report={sheet}
          studio={STUDIO_ON_HOME ? { data: insightsPreviewForStudio() } : null}
        />
      </div>
      <div data-story className="lg:hidden">
        <ConsoleStory
          rows={grid.rows}
          sentences={sentences}
          evidence={evidence}
          insights={
            <InsightsStill data={still} rail={RECORDING ? <AnalystRail form="phone" /> : undefined} form="phone" flat />
          }
          report={sheet}
        />
      </div>

      <div className="mt-14 grid-12 gap-y-6 lg:mt-16 lg:items-center">
        <p className="col-span-12 max-w-[60ch] text-body text-pretty text-text-2 lg:col-span-7">{TOUR.cta.body}</p>
        <Button href="/signin" size="lg" className="col-span-12 w-full justify-center sm:w-auto sm:justify-self-start lg:col-span-5 lg:col-start-8 lg:justify-self-end">
          {TOUR.cta.button}
        </Button>
      </div>
    </Section>
  );
}
