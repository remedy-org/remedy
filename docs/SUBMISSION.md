# Remedy — submission package

Prepared 10 November 2026. The text below describes the implemented build. Publication, the final video link and the live rehearsal are separate completion checks; this document does not assert that Devpost has been submitted.

## Entry fields

| Field | Value |
| --- | --- |
| Project name | Remedy |
| Tagline | From recall evidence to traceable PayPal refunds. |
| Website | https://remedy-recalls.vercel.app |
| Source | https://github.com/remedy-org/remedy |
| Owner demo | https://remedy-recalls.vercel.app/r/kikea-x-vesolje/try |
| Company demo | https://remedy-recalls.vercel.app/signin |
| Video | https://youtu.be/25YfQlkGHDc |
| Built With | PayPal, OpenAI, AG Grid, AG Studio, Next.js, React, TypeScript, Tailwind CSS, Vercel, Vercel Blob, CPSC API, three.js, Motion, Lenis |

## Project description

### Inspiration

Some safety recalls ask owners to destroy a product and email a photograph for a refund. That leaves the company reviewing an inbox and the owner waiting for a decision. The CPSC's public recall notices gave me a concrete workflow to build around: a recalled product, specific destruction instructions and a refund owed to an eligible owner.

I wanted to shorten that path while making each decision inspectable. The challenge is that a convincing picture is not proof of authenticity. Remedy makes the evidence, admission checks, rule and payment status visible together instead of presenting an AI verdict as certainty.

### What it does

An owner opens the recall's link, signs in with PayPal, receives a short one-time code and photographs the required destruction with the code beside the product. Remedy first checks the capture-session admission, photo reuse and verified-account eligibility. AI then describes the visible label, code and destruction evidence in structured answers with quotations. A fixed rule decides whether the claim passes, is rejected or needs a person.

An eligible claim can trigger a PayPal sandbox payout to the exact payer ID that signed in. The receipt distinguishes a submitted payout from PayPal's confirmed status. The company sees the same claim in its evidence queue, with the deciding check first, the model's answers and the payout reference.

The company workspace also imports CPSC notices, drafts editable photo checks, provides an AG Grid review queue, displays recall progress in AG Studio and generates a printable progress-report draft. A Recall analyst can explain claims and build or inspect report views; it has no approval or payment tools.

### How I built it

Remedy is one Next.js application on Vercel, written in TypeScript. It calls PayPal's REST APIs directly for Log in with PayPal, Payouts, payout status and webhook verification. Consumer refunds use Payouts rather than a reversal of an original PayPal purchase. Payout requests reuse a stable claim key for idempotency, and eligibility checks run again before payment.

The OpenAI Responses API returns structured visual observations. The model describes; deterministic code decides eligibility and routes uncertainty to human review. A 64-bit perceptual fingerprint catches exact and some modified reposts. Claims and private evidence use Vercel Blob with conditional updates.

AG Grid supplies the live claims queue with custom photo, check and timeline cells. AG Studio hosts custom progress, funnel, refusal, decision and timing widgets, cross-filtered reporting, and a custom Recall analyst that delegates to Studio's data, page and widget agents. The analyst's server proxy keeps credentials on the server and rejects money-moving tool names.

### Challenges

The hardest problem was the boundary between reading evidence and proving that it is real. Generated images with the correct code can pass the visual check. I kept that failure in the evaluation and documented it rather than claiming a fraud-proof camera.

The payment path had its own edge cases: PayPal sandbox account eligibility, the verified-account value arriving as a string, idempotent retries and payouts that remain unsettled. The UI needs to explain those states without telling an owner that accepted means paid.

### Accomplishments

I connected a concrete recall workflow to PayPal identity and Payouts, with a shared evidence trail for owners and companies. Historical sandbox testing confirmed a successful payout to the authenticated payer ID. Model experiments include genuine-looking prepared samples, wrong codes, web photographs, screen photographs and ambiguous destruction evidence. The committed evaluation describes both successful checks and generated-image failures.

The product also explains its workflow through an animated laptop-to-phone-to-console story, while retaining mobile, reduced-motion and static fallbacks. The 11 November verification passed the production build, lint, TypeScript, 476 selected tests, 37 isolated browser scenarios and 52 public deployment checks. The isolated scenarios use synthetic responses, and the public checks are read-only; these checks did not certify a fresh live transaction.

### What I learned

Photo interpretation, claim eligibility and payment confirmation are three separate problems. Treating them separately makes the system easier to inspect and test. Quoted model observations, deterministic rules and explicit held states are more useful than a single confidence score.

### What's next

The next validation is real phone photography and handwriting across more products, lighting conditions and accessibility needs. Beyond the hackathon, per-company payment accounts would require PayPal partner onboarding. A supervised seller pilot should measure owner completion, manual review time and incorrect decisions before expanding automatic payments.

## Judge access and expected outcomes

1. Open the [prepared owner demo](https://remedy-recalls.vercel.app/r/kikea-x-vesolje/try). Use the sandbox credentials shown in its **Demo account** panel and log in with PayPal. No personal PayPal account or real money is needed.
2. Run **A genuine claim** first. Its prepared tag matches M4T; the intended result is a $29.99 PayPal sandbox payout. Then run the repost, which needs that first photo to exist in the round.
3. Run the remaining samples. The photo from outside the session and the reused photo should be blocked before AI; the wrong-code photo reads K7Q where K7P is required and should be rejected after the model's transcription.
4. Follow the result's company link or open [sign-in](https://remedy-recalls.vercel.app/signin), expand **Explore with the demo account** and use the same sandbox login. Inspect the new claim's evidence and payout status. Keep the same browser so its demo round is visible.
5. Inspect the Claims queue, Insights, Recall analyst and report. The seven built-in claims are illustrative; a new `/try` claim is a real sandbox execution beside them.

Do not infer success from these expected outcomes: the actual result and PayPal confirmation are the evidence. If a provider fails, the claim can be held for a person; report that result honestly.

## Required disclosures

- All payments use PayPal sandbox money from Remedy's single sandbox business account. No real-money deployment or per-company partner onboarding is claimed.
- The four judge-demo photographs are prepared AI-made edits of the public product image. `/try` does not use the visitor's camera. It makes real model and sandbox calls when a claim is run.
- The homepage and seven built-in console claims are illustrative. Their stored model answers come from actual experiments; their payer IDs, relative dates, receipt and payment timings are stand-ins.
- The real-owner page implements camera capture, but real phone/handwriting validation was still pending when this package was prepared. Do not describe that test as complete until its results are recorded.
- Generated images can pass the photo check. Session admission proves when a submission arrived through its session, not camera provenance; the fingerprint does not detect every edit.
- The CPSC recall is public. Kikea Store is the firm named in that notice, not a Remedy customer or partner. The $29.99 amount is a demo setting.
- Implemented webhook signature verification is not a claim that a fresh webhook delivery has been demonstrated. Payout polling is also implemented.

## Final form check

- Use the final canonical URL, public source URL and processed public YouTube link consistently.
- Add current screenshots from the approved release: owner evidence/result, the company evidence queue and Insights. Label prepared or illustrative content in captions.
- Confirm all actual teammates have accepted their invitations; the README currently describes a solo build.
- Select the sponsor tools actually used. For the AG Grid/AG Studio award, show the custom Studio widgets and Recall analyst integration, not just a stock grid screenshot.
- Copy the description above into Devpost's matching fields and review the rendered preview. Confirm the source is accessible while signed out.
- Submit by **12 November 2026, noon PST / 13 November 2026, 01:30 IST**. Keep linked source, README and video unchanged after the deadline until the winner announcement, per the [latest organizer update](https://paypalaihackathon.devpost.com/updates/47308-3-days-left-submissions-close-thursday-at-noon-pst).

Suggested gallery order and captions:

1. **From proof to PayPal:** the animated owner-to-company story. Illustrative walkthrough; PayPal sandbox.
2. **One decision, five evidence checks:** the prepared owner demo shows the photo, readable tag and each check's outcome.
3. **The evidence behind every decision:** the company queue connects a claim's photo, quoted model observations, eligibility rule and PayPal status. Mark fixture-only screenshots as illustrative.
4. **Recall progress, with explanations:** custom AG Studio widgets and the Recall analyst turn claim evidence into an inspectable report. Mark built-in sample records as illustrative.

Video and sponsor requirements: [official rules](https://paypalaihackathon.devpost.com/rules), [submission checklist](https://paypalaihackathon.devpost.com/updates/47307-submission-checklist-it-s-go-time), [video guidance](https://paypalaihackathon.devpost.com/updates/47306-lights-camera-paypal-video-tips-and-how-judging-works).
