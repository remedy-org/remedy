# Animated UI review and release

10 November 2026. The revised UI was reviewed separately on `ui/animated-review` before release approval. The approved version is being promoted to `main` and the canonical `https://remedy-recalls.vercel.app` site as part of submission closeout. The original animated implementation is preserved on `archive/original-ui` at `c37bb9d`, with its own `https://remedy-original-review.vercel.app` deployment. The flattened alternative remains archived on `ui/flat-review`.

## Preserved product story

The homepage retains the laptop, screen dolly, PayPal consent, one-time code, live-camera exhibit, five evidence checks, paid receipt and receipt-to-console transition. The problem sheet and interactive company console tour remain. Black/violet surfaces, supplied ABC Diatype typography, a distinct Remedy return-receipt mark and measured navigation geometry unify the visual treatment.

The desktop story controller gives each beat at least 1.65 seconds, absorbs continued wheel input and waits for a fresh gesture after landing. Moderate notched-wheel streams and held Page Down/Space are covered. Touch retains native scrolling. Nested scrollers, reverse direction, keyboard access and reduced motion remain available.

## Independent review

The review includes a first-time user, a hackathon judge and a separate component-fidelity check. Scores reflect observed evidence; an 8/10 target does not establish a hackathon result. Reports and screenshots live in `../planning/animation-review-2026-11-10/`.

The original baseline reproduces the reported pacing failure: three decaying trackpad bursts pass multiple settled story screens and continue moving after input stops. The revised controller passes continuous 60 × 50px input lasting over three seconds: it finishes the laptop zoom at 485px, stays there after input stops, advances to 830px on a fresh gesture and reverses correctly. Separate timed bursts may validly advance again after a completed landing and a quiet interval.

## Review access

Local preview: `http://127.0.0.1:3117/`. In-memory fixtures: `/dev/redesign` (company queue), `?view=insights`, `?view=report`, and `/dev/claim?s=code`, `?s=paid-settled`, `?s=held`, `?s=rejected`, `?s=camera-denied`. These fixtures return not-found in production.

Browser reviews run headlessly with API requests blocked. No authenticated console, fresh claim submission, model turn or payout is exercised. Authenticated console GETs can reconcile stored claims and are outside this UI verification under the standing write restriction. A fresh phone-camera/handwriting and PayPal sandbox payment run remains separate runtime validation.

## Fonts and release

The user supplied ABC Diatype Regular/Bold and reported permission from the font team for hackathon use. The WOFF2 binaries are included in CLI deployments but ignored by Git. Clean source checkouts use Inter headings and Work Sans body text, with IBM Plex Mono identifiers.

The user approved the final release during submission closeout. Use the canonical site for judging, login returns, README links and recording. The separate original and animated-review URLs remain available for comparison. No API, auth, rule, payment or persisted-state implementation changes belong to this visual iteration.

## Verification results

- Production build and TypeScript: passed.
- ESLint: passed.
- Focused homepage/story, claim presentation, SVG and skip-link tests: 264 passed, one existing skip across 23 files. The full application suite is excluded because some tests write persisted application state.
- Six homepage widths (375, 390, 768, 1024, 1280, 1440px), ten owner/company fixtures, reduced motion, skip link and section focus: passed with no page errors or page overflow.
- Independent user review: 8.4/10, improved from 7.6 baseline. Independent header fidelity/behavior review: 9.0/10 after a fix-and-retest round. A separate code review reports no remaining blockers. Independent judge simulation: 8.5/10 after two defect fixes and final wheel/held-key retests. Full evidence is retained in the review directory.
- Actual headless wheel, held-key, reversal, touchscreen and video review supplement unit tests; still screenshots alone are not motion verification.

The existing PayPal OAuth flow uses the canonical APP_URL. Promoting the approved build to that same domain aligns the public and authenticated UI without changing provider configuration. The revised authenticated screens were reviewed through local fixtures; a fresh live authentication/payment completion remains unverified. See [submission materials](SUBMISSION.md) and the [manual recording checklist](RECORDING-CHECKLIST.md).

The final claim-lane iteration, included in the approved release, docks each 48px photo 20px inside its check row with a 12px result gap and a centered wire. Its scroll-driven landing eases to zero velocity before the verdict reveals. The latest audited pure UI/view suite passed 293 tests, with one existing recording-dependent skip; lint passed again during submission closeout. These are UI checks, not evidence of a new live payout.
