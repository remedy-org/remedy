import { Section } from "./Section";

// Figures: docs/EVAL.md (7 Nov 2026), GPT-6.1 Sol, the model Remedy runs; the full table and method stay there. Each is
// a count of photos or claims out of those put to it, with the tries behind it (every claim was run 3 times), never a
// bare percentage and never a try counted as a photo:
// - web photos: w01 to w17 less the w03 control (the code check off), 16 photos, 48 tries, none paid;
// - genuine claims: 7 in round 2 and 2 held out, 9 claims, 27 tries, all paid;
// - wrong codes: 4 cases, 12 tries, all refused;
// - cost: $0.011 a claim.
// The one fake the photo check passed (c14, an AI-made image with the code drawn on, in all 3 runs) is said once, in
// body text under the lead, as the reason photos come only from the live camera.
const WEB = { photos: 16, tries: 48 };
const FIGURES: { figure: string; text: string }[] = [
  { figure: "9 of 9", text: "genuine claims paid, in all 27 tries" },
  { figure: "4 of 4", text: "wrong codes refused, in all 12 tries" },
  { figure: "1.1¢", text: "to check a claim" },
];

/**
 * Results: the one number that matters is the heading, the zero at the display size (never bigger than the hero's h1)
 * with what it counts beside it, the lead and the one fake's sentence under it on columns 1 to 7; the three supporting
 * counts along the foot, one per four columns on a hairline (a list on hairlines on phones), with the benchmark's
 * footnote under them, the figures it sources. On a tall laptop screen the section is a slide: the statement at its top
 * (the section's own 96px under the nav, so the frame before it, Fraud checks' rule, never shows its eyebrow at the
 * foot) and the counts on its foot, so the slide is composed from top to foot, never a block in the middle of a third
 * of empty screen, and it ends 48px under the counts' footnote, For companies' 96px after it.
 */
export function Proof() {
  return (
    <Section
      id="proof"
      // On a laptop screen 860px tall and up the section is a slide of its own (scroll/stops.ts frames its top under the
      // nav): the statement at its top, the counts pushed to its foot.
      className="lg:[@media(min-height:860px)]:flex lg:[@media(min-height:860px)]:min-h-[calc(100svh-4rem)] lg:[@media(min-height:860px)]:flex-col"
      padClassName="py-18 lg:py-24 lg:[@media(min-height:860px)]:pb-12"
      pageClassName="w-full lg:[@media(min-height:860px)]:flex lg:[@media(min-height:860px)]:flex-1 lg:[@media(min-height:860px)]:flex-col"
      bodyClassName="mt-10 lg:mt-16 lg:[@media(min-height:860px)]:mt-auto lg:[@media(min-height:860px)]:pt-16"
      exhibit="Results"
      headingSpan={7}
      stack
      title={
        <span className="flex items-baseline gap-x-3 sm:gap-x-4">
          <span aria-hidden="true" className="text-display leading-[0.9] min-[1600px]:text-[clamp(3.5rem,3.75vw,4.5rem)]">
            0
          </span>
          <span className="max-w-[22ch] text-balance">
            <span className="sr-only">0 </span>of {WEB.photos} stolen web photos paid, across {WEB.tries} tries.
          </span>
        </span>
      }
      lead="We put Remedy up against real owner photos, official recall photos, photos of screens, wrong codes and AI-made fakes. It reads the code on every tag character by character, so one wrong letter refuses the claim."
      note={
        // The one fake that passed, said once in the lead's own voice: it is why the camera is the first check.
        <p className="mt-4 max-w-[60ch] text-body text-pretty text-text-2 lg:mt-0">
          One fake passed the photo check in every try, a generated image of a cut pillow with the code drawn on, which is
          why photos only come from the claim&rsquo;s live camera.
        </p>
      }
    >
      <dl className="grid grid-cols-1 lg:grid-cols-12 lg:gap-x-(--col-gap)">
        {FIGURES.map((f) => (
          <div
            key={f.text}
            className="flex items-baseline gap-x-4 border-t border-line py-4 lg:col-span-4 lg:flex-col lg:gap-y-2 lg:pt-6 lg:pb-0"
          >
            <dt className="w-[5.5ch] shrink-0 text-head-sm font-medium whitespace-nowrap sm:w-[6.5ch] sm:text-title lg:w-auto lg:text-title-lg">
              {f.figure}
            </dt>
            <dd className="text-body text-pretty text-text-2">{f.text}</dd>
          </div>
        ))}
      </dl>
      {/* Where every figure on this slide comes from, once, under the counts, with no marks to send a reader down to it. */}
      <p className="mt-4 text-micro text-pretty text-faint lg:mt-6">Remedy fraud benchmark, 7 Nov 2026: 36 claims, each run 3 times.</p>
    </Section>
  );
}
