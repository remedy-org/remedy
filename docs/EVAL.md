# Remedy evals: the two tests before we built

Go/no-go was **Fri 6 Nov, 21:00 IST**. If either failed, we'd switch to Upkeep (IDEA.md §3).

**Both passed:** spike 1 on 6 Nov, spike 2 on 7 Nov. Build on GPT-6.1 Sol at high effort.

```bash
cd /Users/mohit/dev/hackathon/paypal_ai/remedy
cp .env.example .env    # then fill it in as below; .env is git-ignored
```

## Spike 1: the PayPal money chain

**Result, 6 Nov: pass.** In the sandbox: the app token carried the Payouts and Log in with PayPal scopes (test 1); a $1.00 payout by email succeeded (test 2); Log in with PayPal returned a verified payer ID, and a payout to that exact payer ID succeeded (test 3). Test 4, the fallback, wasn't needed. Results are in `eval/out/spike1.json`.

The spike script is gone: `src/lib/paypal` now makes the same calls. The dashboard setup still applies. You do it yourself: it needs your login, and nobody else should type your credentials.

1. **Create two US sandbox accounts.** Go to [developer.paypal.com](https://developer.paypal.com) → **Testing Tools → Sandbox Accounts → Create account**.
   - **Business**, country **United States**. This one sends the refunds.
   - **Personal**, country **United States**. This one plays the owner who gets refunded.
   - Don't use the default India business account: India sandbox accounts reportedly get `USER_COUNTRY_NOT_ALLOWED` on Payouts.
2. **Create the app.** **Apps & Credentials → Sandbox → Create App**. Name it `Remedy`, type Merchant, and pick the **US business** sandbox account from step 1. Copy the Client ID and Secret into `.env`.
3. **Turn on the features**, on the app's page:
   - Tick **Payouts**.
   - Tick **Log in with PayPal**, set the Return URL to `http://127.0.0.1:8787/callback`, and open **Advanced settings**. Tick email, full name, **PayPal account ID (payer ID)** and **account verification status**. If it asks for privacy-policy and user-agreement URLs, any URL works for the sandbox.
   - Save. A `http://localhost…` Return URL makes the save fail ("Something went wrong saving the application", HTTP 520); `127.0.0.1` saves fine.
4. **Finish `.env`.** Set `PAYPAL_RECEIVER_EMAIL` to the US personal sandbox account's email (from Sandbox Accounts → View/Edit).

If PayPal also rejects `127.0.0.1`, run `ngrok http 8787`. Use the `https://…ngrok…/callback` address both in the dashboard and as `PAYPAL_REDIRECT_URI` in `.env`.

**Pass line:** tests 1 and 2 pass, plus either test 3 or test 4.

## Spike 2: the camera check

**Result, 7 Nov: GO with GPT-6.1 Sol at high effort.**
- Across 36 claims, 3 runs each, it paid every real claim and rejected every wrong code, wrong label and wrong model.
- With the code check on, it never paid a web photo. (`w03`, the control with the code check off, is meant to pass.)
- It costs about 1.1¢ and 16 seconds a claim.
- Its one miss is an AI image with a subtle physical flaw. That's a job for the capture path, not the model (see "What this can't show").

### The test set: 36 claims

| Set | Cases | What it tests |
|---|---|---|
| Web photos | `w01`–`w17`: real owner photos (Govee, Aloha Breeze, Midea); official "correct photo" examples (Steamfast, Lexmark); CPSC product shots (DREO, HotHands, Kikea); traps (other pillows, AI fakes from news coverage, a screenshot, a photo of a monitor, a photo against the wrong recall) | Reading labels and steps. No web photo can carry this claim's code, so none may ever pay. `w03` turns the code check off and should pass. |
| Code-on | `c01`–`c14`, AI images made by `eval/make-photos.ts`: eight real-looking claims with the code (`c01`–`c08`); wrong codes (`c09` has K7O written, while `c11`–`c13` reuse a good photo under a different expected code); a photo of a screen (`c10`); an AI artifact (`c14`, three cut ends on two pieces) | The pass path, and the character-by-character code check |
| Held out | `h01`–`h05`, written after the round-1 fixes: new HotHands and Kikea claims, a wrong label (X-VESOLIE), a model that isn't recalled (SF-430), a slit instead of a cut | Whether the fixes hold on photos they never saw |

Each claim is a folder under `eval/photos/` with 1-3 photos and a `case.json`:

```json
{ "code": "K7Q", "expect": "pass", "spec": "eval/specs/standin-pillow.json",
  "truth": { "label": "yes", "steps": ["done", "done"], "code": "yes", "screen": "no" } }
```

`"code": null` turns the code check off. `expect` and each `truth` value may list several acceptable answers. Each case scores every answer (label, each step, code, screen) against this answer key, not just the decision. Every image was checked by eye before its key was trusted. Sources and prompts are in `eval/photos/SOURCES.md`; the images are git-ignored. The check specs are in `eval/specs/`.

### Running it

The runner calls the app's own `runVisionCheck` and `decide` from `src/lib`, so it tests exactly what the app runs: the same prompt, schema, image resizing and rule. It reads `.env`, which needs everything `src/lib/env.ts` asks for, `APP_URL` included.

```bash
npm run eval:run                                        # GPT-6.1 Sol, high effort, all cases
npm run eval:run -- --model gpt-6.1-terra --effort medium --out eval/out/x.json
npm run eval:run -- path/to/cases                       # another folder of case folders
npm run eval:photos                                     # makes any code-on case that's missing
npm run eval:photos -- c01-pillow-cut-daylight          # remakes one case
npm run eval:summarize -- eval/out/runs                 # one row per model across repeated runs
```

**Go line:** at least 90% of decisions and answers match, no answer errs toward paying, and no fake is ever "pass".

The results below came from the first runner, a plain-JS copy of the check that resized with macOS `sips`. The app's check keeps its prompt, schema and rule, and resizes with `sharp`. The app's check calls OpenAI only, so Claude can't be evaluated through it.

### Results: 3 runs per model, high effort

Round 2 covers the 31 `w` and `c` claims; the held-out set is the 5 `h` claims. Each cell shows round 2 first, then held out. "Decisions right" counts claims in one run; the paid columns add up all 3 runs (7 genuine claims, `c01`–`c03` and `c05`–`c08`, make 21; the held-out `h01` and `h02` make 6).

| Model | Decisions right | Genuine claims paid (3 runs) | Fakes paid (3 runs) | Answers right | Seconds per claim | Cost per claim |
|---|---|---|---|---|---|---|
| **GPT-6.1 Sol** | 29–30 of 31 · 5 of 5 | 21 of 21 · 6 of 6 | 3, all `c14` · 0 | 91% · 96% | 16 (max 40) | $0.011 |
| GPT-6 Astra | 29–30 of 31 · 5 of 5 | 21 of 21 · 6 of 6 | 1, `c14` · 0 | 90% · 96% | 26 (max 67) | $0.064 |
| GPT-6.1 Terra | 29–30 of 31 · 5 of 5 | 18 of 21 · 6 of 6 | 2, `c14` · 0 | 93% · 96% | 10 (max 19) | $0.005 |
| GPT-6 Luna | 28–29 of 31 · 4–5 of 5 | 16 of 21 · 6 of 6 | 3, `c14` · 2, `h03` | 93% · 96% | 10 (max 27) | $0.0006 |

All four models rejected all 12 wrong-code attempts (4 cases, 3 runs) and, with the code check on, every web photo, in every run. `w03`, the control with the code check off, was paid as expected in 7 runs. The raw runs are in `eval/out/runs` (round 2) and `eval/out/holdout`.

Why Sol:
- **Terra** holds the two-photo claim because it can't confirm both photos show the same pillow.
- **Luna** reads "R8D" as "R&D" every time, and paid the X-VESOLIE label twice.
- **Astra** is 6× the price and too slow to demo. It does catch the `c14` flaw (2 of 3 runs here, 3 of 3 in round 1).
- **Sol at medium effort** matched Sol at high on the 17 web claims, at 8 s a claim. That's an option if the demo needs speed.

The strict go line still prints NO-GO for every model, because every model paid `c14` at least once.

### What changed between rounds

In round 1, Sol paid 16 of 21 real claims and Terra only 3. None of the holds was a vision failure. The models were right to hold, given what they'd been told:
1. The stand-in spec never said the handwritten X-VESOLJE tag *is* the stand-in's label, so Terra doubted it was a product label.
2. The HotHands spec asked for "the claim number" in "permanent marker". The models couldn't know the one-time code is the claim number, can't see permanence, and couldn't tell which printed number is the batch code.
3. The Kikea spec copied CPSC's text ("leaves"), but the pillow also has blue flowers.
4. Two answer keys were wrong, and both were my mistakes:
   - **w05:** I wrote the key from the first frame only. The second frame does show the cut stub, as every large model said.
   - **c03:** its photo 2 had three cut ends on two pieces, which Astra spotted and I'd missed. It became `c14`, and `c03` was remade.

Round 1 results are kept in `eval/out/runs-v1`.

### Rules for the spec generator (this feeds the build)

- Ask only for what a photo can show: "in marker", not "in permanent marker".
- Say where each identifier sits on the label, as the notice's diagram does ("the batch code at the bottom right").
- Describe the product's look from the notice's photos, not only its text.
- Wherever the notice asks for a claim number, say the one-time code is the claim number.
- Issue codes from an alphabet with no look-alikes, and never anything word-like:
  - leave out O, 0 and Q;
  - leave out I, 1 and L;
  - leave out 8, B, 5, S, 2 and Z.

### What this can't show

- **Real handwriting in a real phone photo.** Every code-on photo is AI-made, because no web photo can carry a per-claim code. The first real one will be the demo capture.
- **AI fakes.** The models passed `c01`–`c08`, and all of them are AI images. The vision check can't tell a clean AI image from a photo, so it isn't the defence against fakes. These are:
  - the capture path: photos must arrive inside the claim's 10-minute camera session, carrying its key, with the code issued inside that session (this proves when and through which session a photo was sent, not that a camera took it);
  - one claim per verified PayPal account per unit.
- **Claude**, which needs an Anthropic key, and isn't wired into the app's check.
- **An independent answer key.** One person wrote the keys and checked them by eye.

Spend for the whole spike: about $18 of OpenAI usage. That's $0.83 on images and the rest on vision runs.

### Before the demo: one real capture

Shoot one real claim on any phone: a cheap pillow or cushion as the stand-in, cut in half, with a paper tag reading `X-VESOLJE` and that claim's code. Put it in `eval/photos/r01-real-capture/` with a `case.json` such as `{ "code": "<the code>", "expect": "pass", "spec": "eval/specs/standin-pillow.json" }` and run `npm run eval:run`. Save it as JPEG: the app's resizer, `sharp`, can't read an iPhone's HEIC.

The model only describes what it sees; a fixed rule in the code decides pass, hold or reject.

## The demo recall's photos, remade (9 Nov 2026)

The demo claims used plain stand-in pillows, and the spec said a plain pillow of any colour counted. The spec is now
`eval/specs/kikea-tagged.json` (word for word `DEMO_SPEC`): only the three recalled prints count, the pillow carries no
label (CPSC), and the owner ties on a paper tag with X-VESOLJE and the claim's code. The photos (`k01`–`k11`) are edits
of the CPSC photo (`w09`, with `h02` for the cut) by `eval/make-photos.ts`; each was checked by eye. The app's model
(gpt-6.1-sol, high) ran three times on each (`eval/out/runs/kikea*-gpt-6.1-sol-r1..3.json`):

| Case | Claim | Code | Decision, 3 runs | Deciding check |
| --- | --- | --- | --- | --- |
| k01 feather print, cut, tag M4T | RM-0442, the `/try` genuine sample | M4T | pass 3/3 | all pass |
| k02 floral print, cut, tag K7Q | RM-0118, the `/try` wrong-code sample | K7P | reject 3/3 | the code alone |
| k04 puzzle print, still joined by a strip | RM-6276 (RM-2125 reposts it) | F3X | reject 3/3 | cut in half |
| k10 puzzle print, shot far and dim | RM-9629 | H9D | hold 3/3 | label, code, tag on pillow unclear |
| k06 floral print on a laptop screen | dev preview | C7W | reject 3/3 | photo of a screen |
| k05 puzzle print, cut, tag J4R | (replaced by k11) | J4R | pass 3/3 | all pass |
| k03 one cut half in frame | not used | H9D | reject 3/3 | cut in half |
| k07 tag lying loose | not used | H9D | reject 3/3 | tag on the pillow |
| k08 smudge beside the code | not used | H9D | pass 3/3 | all pass (the code stayed readable) |
| k09 only the H showing | not used | H9D | reject 3/3 | the code (reads H) |

`k11` (feather print, J4R) is RM-9475's photo, blocked before the photo check, so it has no answer. The old RM-0442
photo (a plain navy pillow, `c02`) under the new spec: rejected, "Label doesn't match the recalled product". Run 1 of
each case in use is stored verbatim in `src/lib/demo/verdicts.json` and `src/lib/review/replay.json`
(`npm run demo:assets`). Spend: about $0.62 on images and $0.36 on vision runs.

## The repost fingerprint against edits (9 Nov 2026, no model calls)

The duplicate check (`src/lib/fingerprint.ts`) treats two photos as the same at a dHash distance of at most
`SAME_PHOTO_THRESHOLD`, 8 bits of 64. Each edit of k01 (the eval original and `public/demo/k01-1.jpg`) went through
the claim page's own encode first (longest side 1600 px, JPEG 0.85), as an upload would, and was compared with the
original's upload. The two k01 files are 3 bits apart.

| Edit | eval k01 | demo k01-1 | Same photo? |
| --- | --- | --- | --- |
| Re-saved as JPEG 90 / 70 / 50 | 1 / 1 / 1 | 0 / 1 / 0 | yes |
| Resized to 50% | 2 | 2 | yes |
| Brightness +15% / -15% | 3 / 4 | 0 / 1 | yes |
| Contrast +15% / -15% | 3 / 1 | 0 / 1 | yes |
| Cropped 2%, evenly from every side | 2 | 1 | yes |
| Cropped 2% off the right and bottom | 4 | 5 | yes |
| Cropped 5%, evenly | 5 | 4 | yes |
| Rotated 2°, cropped back to fill | 8 | 5 | yes (eval k01 at the threshold) |
| Cropped 10%, evenly | 9 | 7 | no / yes |
| Cropped 5% / 10% / 20% off the right and bottom | 12 / 21 / 29 | 11 / 21 / 30 | no |
| Cropped 20%, evenly | 18 | 19 | no |
| Rotated 2°, white corners | 13 | 9 | no |
| Mirrored left to right | 30 | 34 | no |
| Screenshot on a phone (black frame, status bar) | 16 | 18 | no |
| Screenshot in a desktop viewer (grey margins) | 28 | 28 | no |

So the homepage says a repost is refused "even resized, re-saved or brightened", never "edited" in general: a mirror,
a crop of 5% or more off one side, a screenshot or a rotation with white corners gets past the fingerprint, and the
other checks stand in the way: a reposted tag carries the earlier claim's code, not the new one (the `/try` repost
sent to the model anyway was rejected on its code, 3 of 3), and a screenshot meets the screen check. `fingerprint.test.ts` pins
the edits the page names.
