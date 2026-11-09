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
 * without JS (ConsoleStory). Everything in both comes from one seed (components/console/preview.ts): the seven claims,
 * their Insights and their CPSC report draft. The server renders both; CSS shows one by breakpoint.
 */
export function Companies() {
  const grid = previewProps();
  const still = insightsStill(insightsPreview());
  const { recall, report, generated, daysIn } = reportPreview();
  const evidence = grid.rows.find((r) => r.id === PREVIEW_OPEN_ID)?.evidence ?? null;
  // Step 03 names the recall analyst only when its recorded answer is there to show.
  const sentences = stepSentences(Boolean(RECORDING));
  const descriptions = describe(still.totals, { id: PREVIEW_OPEN_ID, amount: evidence?.amount ?? "" }, RECORDING);
  const sheet = <ProgressReport recall={recall} report={report} generated={generated} daysIn={daysIn} home />;

  return (
    <Section
      id="companies"
      exhibit="For companies"
      title={TOUR.title}
      headingSpan={12}
      bodyClassName="mt-10 lg:mt-6"
      // The console frame and its heading share one laptop screen: less air above than the page's other sections.
      padClassName="py-18 lg:pt-20 lg:pb-24"
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

      {/* One grid row: the sentence and the buyer's facts (who funds the refunds, what a check costs, what New recall
          takes) on columns 1 to 7, the button on column 8, where the step sentences above start. The button is the quiet
          one at the nav's 44px: the footer tag's Try a claim, a screen below, is the page's brass, and two never share a
          view. Under it, which PayPal account it means. The section's one Log in with PayPal (the footer tag has none). */}
      <div data-cta className="mt-14 grid-12 gap-y-5 lg:mt-16">
        <div className="col-span-12 flex flex-col gap-3 lg:col-span-7">
          <p className="max-w-[60ch] text-body text-pretty text-text-2">{TOUR.cta.body}</p>
          <p className="max-w-[64ch] text-ui text-pretty text-muted">{TOUR.cta.facts}</p>
        </div>
        <div className="col-span-12 flex flex-col items-start gap-3 lg:col-span-5 lg:col-start-8">
          <Button href="/signin" variant="secondary" className="w-full justify-center sm:w-auto">
            {TOUR.cta.button}
          </Button>
          <p className="text-ui text-pretty text-muted">{TOUR.cta.account}</p>
        </div>
      </div>
    </Section>
  );
}
