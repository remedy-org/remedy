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
 * with what it counts beside it, the lead and the method's footnote under it; the three supporting counts stand beside
 * them on columns 8 to 12, a list on hairlines with room to breathe, ending on the footnote's last line, so the frame is
 * one balanced slide, never a lone figure with an empty half. On a laptop screen 860px tall and up it is a screen of its
 * own (scroll/stops.ts frames the section's top under the nav), so For companies never shows at its foot: the block sits
 * a little above the screen's middle, the counts' rows opened up to hold it, so the slide is composed rather than its
 * top 40% used over 500px of empty paper (1920x1080).
 */
export function Proof() {
  return (
    <Section
      id="proof"
      className="lg:[@media(min-height:860px)]:flex lg:[@media(min-height:860px)]:min-h-[calc(100svh-4rem)] lg:[@media(min-height:860px)]:flex-col lg:[@media(min-height:860px)]:justify-center"
      padClassName="py-18 lg:py-24 lg:[@media(min-height:860px)]:pt-16 lg:[@media(min-height:860px)]:pb-28"
      pageClassName="w-full"
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
      aside={
        <dl className="flex flex-col">
          {FIGURES.map((f) => (
            <div
              key={f.text}
              className="flex items-baseline gap-x-4 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0 lg:py-8 lg:first:pt-0 lg:last:pb-0 lg:[@media(min-height:860px)]:py-11"
            >
              <dt className="w-[5.5ch] shrink-0 text-head-sm font-medium whitespace-nowrap sm:w-[6.5ch] sm:text-title">
                {f.figure}
              </dt>
              <dd className="text-body text-pretty text-text-2">{f.text}</dd>
            </div>
          ))}
        </dl>
      }
      note={
        <>
          {/* The one fake that passed, said once in the lead's own voice: it is why the camera is the first check. */}
          <p className="mt-4 max-w-[60ch] text-body text-pretty text-text-2 lg:mt-0">
            One fake passed the photo check in every try, a generated image of a cut pillow with the code drawn on, which is
            why photos only come from the claim&rsquo;s live camera.
          </p>
          {/* Where every figure on this slide comes from, once, with no marks to send a reader down to it. */}
          <p className="mt-3 text-micro text-pretty text-faint">Remedy fraud benchmark, 7 Nov 2026: 36 claims, each run 3 times.</p>
        </>
      }
    />
  );
}
