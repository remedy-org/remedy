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
 * with what it counts beside it, its top on the cap height of their first line; the lead under it, and the one fake's
 * sentence under that, on columns 1 to 7. The three supporting counts stand beside them on columns 8 to 12 on laptops,
 * a list on hairlines (each figure with its words), with the benchmark's footnote under them, the figures it sources,
 * ending on the fake's sentence's last line; on phones they follow the lead. On a tall laptop screen the section is a
 * slide: its top under the nav (the frame before it, Fraud checks' rule, never shows its eyebrow at the foot), the
 * statement and its counts one block in the slide's upper middle, so neither half of the slide and no band between the
 * copy and the counts reads empty.
 */
export function Proof() {
  return (
    <Section
      id="proof"
      // On a laptop screen 860px tall and up the section is a slide of its own (scroll/stops.ts frames its top under the
      // nav), its block a little above the slide's middle.
      className="lg:[@media(min-height:860px)]:flex lg:[@media(min-height:860px)]:min-h-[calc(100svh-4rem)] lg:[@media(min-height:860px)]:flex-col"
      padClassName="py-18 lg:py-24"
      pageClassName="w-full lg:[@media(min-height:860px)]:flex lg:[@media(min-height:860px)]:flex-1 lg:[@media(min-height:860px)]:flex-col lg:[@media(min-height:860px)]:justify-center lg:[@media(min-height:860px)]:pb-[calc(6rem+9svh)]"
      exhibit="Results"
      headingSpan={7}
      stack
      title={
        // The zero's top on the cap height of the words' first line: both boxes from the top, the zero lowered by the
        // difference between where each one's caps start in its line (Schibsted Grotesk: ascent 0.98, descent 0.26, cap
        // 0.70 of the size; the words at line-height 1.06, the zero at 0.9).
        <span className="flex items-start gap-x-3 sm:gap-x-4">
          <span
            aria-hidden="true"
            className="mt-[calc(var(--text-title-lg)*0.187-0.107em)] text-display leading-[0.9] min-[1600px]:text-[clamp(3.5rem,3.75vw,4.5rem)]"
          >
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
        <p className="max-w-[60ch] text-body text-pretty text-text-2">
          One fake passed the photo check in every try, a generated image of a cut pillow with the code drawn on, which is
          why photos only come from the claim&rsquo;s live camera.
        </p>
      }
      aside={
        <div>
          <dl>
            {FIGURES.map((f) => (
              <div key={f.text} className="flex items-baseline gap-x-4 border-t border-line py-4 lg:gap-x-6 lg:py-5">
                <dt className="w-[5.5ch] shrink-0 text-head-sm font-medium whitespace-nowrap sm:w-[6.5ch] sm:text-title lg:w-[3.25em] lg:text-title-lg">
                  {f.figure}
                </dt>
                <dd className="text-body text-pretty text-text-2">{f.text}</dd>
              </div>
            ))}
          </dl>
          {/* Where every figure on this slide comes from, once, under the counts, with no marks to send a reader down to it. */}
          <p className="border-t border-line pt-4 text-micro text-pretty text-faint">Remedy fraud benchmark, 7 Nov 2026: 36 claims, each run 3 times.</p>
        </div>
      }
    />
  );
}
