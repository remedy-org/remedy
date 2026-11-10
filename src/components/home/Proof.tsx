import { Section } from "./Section";

// Figures: docs/EVAL.md (7 Nov 2026), GPT-6.1 Sol, the model Remedy runs; the full table and method stay there. Each is
// a count of photos or claims out of those put to it, with the tries behind it (every claim was run 3 times), never a
// bare percentage and never a try counted as a photo:
// - web photos: w01 to w17 less the w03 control (the code check off), 16 photos, 48 tries, none passed;
// - prepared eligible claims with AI-made photos: 7 in round 2 and 2 held out, 9 claims, 27 tries, all passed;
// - wrong codes: 4 cases, 12 tries, all refused;
// - model cost: $0.011 a photo check.
// The one fake the photo check passed (c14, an AI-made image with the code drawn on, in all 3 runs; the 9 Nov test's
// two clean fakes passed too, 6 of 6) is said once, in body text under the lead, as the reason for what stops it: the
// claim's own camera session and one claim per verified PayPal account. The session check proves the photos arrived
// with the session's key inside its 10 minutes, not that a camera took them, so the sentence says only that.
const WEB = { photos: 16, tries: 48 };
const FIGURES: { figure: string; text: string }[] = [
  { figure: "9 of 9", text: "prepared eligible claims passed, in all 27 tries" },
  { figure: "4 of 4", text: "wrong codes refused, in all 12 tries" },
  { figure: "1.1¢", text: "model cost per photo check" },
];

/** Recorded results stay explicit about denominators and the boundary between photo reading and other controls. */
export function Proof() {
  return (
    <Section
      id="proof"
      padClassName="py-18 lg:pt-16 lg:pb-26"
      exhibit="Results"
      headingSpan={7}
      stack
      title={<>0 of {WEB.photos} web photos passed the rule.</>}
      lead={`Each web photo was tried three times: ${WEB.tries} attempts, none passed. The benchmark also covers prepared eligible claims with AI-made photos, wrong codes and photos of screens.`}
      note={
        // Preserve the failed photo-check case: these figures are not a generated-image detection guarantee.
        <p className="max-w-[60ch] text-body text-pretty text-text-2">
          A generated cut-pillow image with the right code passed the photo check in every try. The session and account checks are separate controls: neither establishes that a camera took the picture.
        </p>
      }
      aside={
        <div>
          <dl aria-label="Recorded benchmark figures">
            {FIGURES.map((f) => (
              <div key={f.text} className="flex items-baseline gap-x-4 border-t border-line py-4 lg:gap-x-6 lg:py-5">
                <dt className="w-[5.5ch] shrink-0 text-title font-medium tabular-nums whitespace-nowrap sm:w-[6.5ch] lg:w-[3.75em]">
                  {f.figure}
                </dt>
                <dd className="text-ui text-pretty text-text-2">{f.text}</dd>
              </div>
            ))}
          </dl>
          {/* Where every figure on this slide comes from, once, under the counts, with no marks to send a reader down to it. */}
          <p className="border-t border-line pt-4 text-micro text-pretty text-faint">Photo-check benchmark, 7 Nov 2026: 36 claims, each run 3 times. No PayPal payouts were run in this benchmark.</p>
        </div>
      }
    />
  );
}
