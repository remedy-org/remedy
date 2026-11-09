import { Section } from "./Section";

// Figures: docs/EVAL.md (7 Nov 2026), GPT-6.1 Sol, the model Remedy runs; the full table and method stay there. Each is
// a count of photos or claims out of those put to it, with the tries behind it (every claim was run 3 times), never a
// bare percentage and never a try counted as a photo:
// - web photos: w01 to w17 less the w03 control (the code check off), 16 photos, 48 tries, none paid;
// - genuine claims: 7 in round 2 and 2 held out, 9 claims, 27 tries, all paid;
// - wrong codes: 4 cases, 12 tries, all refused;
// - cost: $0.011 a claim.
// The one fake the photo check passed (c14, an AI-made image with the code drawn on, in all 3 runs) is said in the note.
const WEB = { photos: 16, tries: 48 };
const FIGURES: { figure: string; text: string }[] = [
  { figure: "9 of 9", text: "genuine claims paid, in all 27 tries" },
  { figure: "4 of 4", text: "wrong codes refused, in all 12 tries" },
  { figure: "1.1¢", text: "to check a claim" },
];

/**
 * The footnote mark: a 24px hit area around the small figure (wider still on a touch screen), jumping to the method line
 * at the section's foot. Its name says which figure it sources, so a list of the page's links tells them apart. It sits
 * against the figure, with no space before it.
 */
function Note({ figure }: { figure: string }) {
  return (
    <sup className="align-super text-micro font-normal tracking-normal">
      {/* Its focus ring hugs the figure with a 1px gap, so it never lands on the word before it. */}
      <a
        href="#proof-note"
        aria-label={`Note 1: the source for ${figure}`}
        className="relative rounded-[3px] px-px text-faint no-underline transition-colors duration-160 before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] hover:text-text-2 focus-visible:outline-offset-1"
      >
        1
      </a>
    </sup>
  );
}

/**
 * Results: the one number that matters is the heading, the zero at the display size (never bigger than the hero's h1)
 * with what it counts beside it, the lead and the method's footnote under it; the three supporting counts stand beside
 * them on columns 8 to 12, a list on hairlines with room to breathe, ending on the footnote's last line, so the frame is
 * one balanced slide, never a lone figure with an empty half. On a tall laptop
 * screen (1000px and up) it is a screen of its own, its content centred in it (scroll/stops.ts frames the section's top
 * there).
 */
export function Proof() {
  return (
    <Section
      id="proof"
      className="lg:[@media(min-height:1000px)]:flex lg:[@media(min-height:1000px)]:min-h-[calc(100svh-4rem)] lg:[@media(min-height:1000px)]:items-center"
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
            <Note figure={`0 of ${WEB.photos} stolen web photos paid`} />
          </span>
        </span>
      }
      lead="We put Remedy up against real owner photos, official recall photos, photos of screens, wrong codes and AI-made fakes. It reads the code on every tag character by character, so one wrong letter refuses the claim."
      aside={
        <dl className="flex flex-col">
          {FIGURES.map((f) => (
            <div key={f.text} className="flex items-baseline gap-x-4 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0 lg:py-8 lg:first:pt-0 lg:last:pb-0">
              <dt className="w-[5.5ch] shrink-0 text-head-sm font-medium whitespace-nowrap sm:w-[6.5ch] sm:text-title">
                {f.figure}
                <Note figure={`${f.figure} ${f.text}`} />
              </dt>
              <dd className="text-body text-pretty text-text-2">{f.text}</dd>
            </div>
          ))}
        </dl>
      }
      note={
        <p id="proof-note" className="mt-3 max-w-[80ch] scroll-mt-24 text-[0.75rem]/[1.5] text-pretty text-faint lg:mt-5">
          ¹ Remedy fraud benchmark, 7 Nov 2026: 36 claims, each run 3 times. The photo check passed one AI-made image of a cut
          pillow with the code drawn on, in every try; in Remedy a photo comes only from the claim&rsquo;s own live camera, so
          an image like it would have to be shown to the camera on a screen or a print, which the photo check looks for.
        </p>
      }
    />
  );
}
