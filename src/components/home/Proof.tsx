import { Section } from "./Section";

// Figures: docs/EVAL.md (7 Nov 2026), GPT-6.1 Sol, the model Remedy runs; the full table and method stay there. Each is
// a count out of the attempts it was put to, never a bare percentage:
// - web photos: w01 to w17 less the w03 control (the code check off), 16 photos in 3 runs, none paid;
// - wrong codes: 4 cases in 3 runs, all refused;
// - genuine claims: 21 of 21 in round 2 and 6 of 6 held out, paid;
// - cost: $0.011 a claim.
const WEB_PHOTOS = 48;
const FIGURES: { figure: string; text: string }[] = [
  { figure: "27 of 27", text: "genuine claims paid" },
  { figure: "12 of 12", text: "wrong codes refused" },
  { figure: "1.1¢", text: "to check a claim" },
];

/**
 * The footnote mark: a 24px hit area around the small figure (wider still on a touch screen), jumping to the method line
 * at the section's foot. Its name says which figure it sources, so a list of the page's links tells them apart.
 */
function Note({ figure }: { figure: string }) {
  return (
    <sup className="ml-1 align-super text-micro font-normal tracking-normal">
      {/* Its focus ring hugs the figure with a 1px gap, so it never lands on the word before it. */}
      <a
        href="#proof-note"
        aria-label={`Note 1: the source for ${figure}`}
        className="relative rounded-[3px] px-0.5 text-faint no-underline transition-colors duration-160 before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] hover:text-text-2 focus-visible:outline-offset-1"
      >
        1
      </a>
    </sup>
  );
}

/**
 * Results: the one number that matters is the heading, the zero at display size with what it counts beside it, the
 * method under it, then the three supporting counts on a hairline at a size near it. On a tall laptop screen (1000px and
 * up) it is a screen of its own, its content centred in it, so its stop never leaves half the screen empty
 * (scroll/stops.ts frames the section's top there).
 */
export function Proof() {
  return (
    <Section
      id="proof"
      className="lg:[@media(min-height:1000px)]:flex lg:[@media(min-height:1000px)]:min-h-[calc(100svh-4rem)] lg:[@media(min-height:1000px)]:items-center"
      pageClassName="w-full"
      exhibit="Results"
      headingSpan={9}
      stack
      title={
        <span className="flex items-baseline gap-x-4 sm:gap-x-6">
          <span aria-hidden="true" className="text-[clamp(4rem,8vw,7rem)] leading-[0.9] tracking-[-0.04em]">
            0
          </span>
          <span className="max-w-[20ch] text-balance">
            <span className="sr-only">0 </span>of {WEB_PHOTOS} stolen web photos paid out.
            <Note figure={`0 of ${WEB_PHOTOS} stolen web photos paid out`} />
          </span>
        </span>
      }
      lead="We put Remedy up against real owner photos, official recall photos, photos of screens, wrong codes and deliberate fakes. It reads the code on every tag character by character, so one wrong letter refuses the claim."
      bodyClassName="mt-12 lg:mt-14"
    >
      <dl className="grid-12 gap-y-6 border-t border-line pt-8">
        {FIGURES.map((f) => (
          <div key={f.text} className="col-span-12 flex items-baseline gap-x-3 sm:col-span-4 sm:flex-col">
            <dt className="text-head-sm font-medium whitespace-nowrap sm:text-title">
              {f.figure}
              <Note figure={`${f.figure} ${f.text}`} />
            </dt>
            <dd className="text-body text-pretty text-text-2 sm:mt-2">{f.text}</dd>
          </div>
        ))}
      </dl>

      <p id="proof-note" className="mt-10 max-w-[68ch] scroll-mt-24 text-[0.75rem]/[1.5] text-pretty text-faint sm:mt-12">
        ¹ Remedy fraud benchmark: 36 claims, 3 runs each, 7 Nov 2026.
      </p>
    </Section>
  );
}
