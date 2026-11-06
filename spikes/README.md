# Remedy spikes: two tests before we build

Go/no-go: **Fri 6 Nov, 21:00 IST.** If either fails, we switch to Upkeep (IDEA.md §3).

**Both passed:** spike 1 on 6 Nov, spike 2 on 7 Nov. Build on GPT-6.1 Sol at high effort.

```bash
cd /Users/mohit/dev/hackathon/paypal_ai/remedy
cp .env.example .env    # then fill it in as below; .env is git-ignored
```

## Spike 1: the PayPal money chain (about 30 minutes, mostly clicking)

You do steps 1–4 in the PayPal dashboard yourself. They need your login, and nobody else should type your credentials.

1. **Create two US sandbox accounts.** Go to [developer.paypal.com](https://developer.paypal.com) → **Testing Tools → Sandbox Accounts → Create account**.
   - **Business**, country **United States**. This one sends the refunds.
   - **Personal**, country **United States**. This one plays the owner who gets refunded.
   - Don't use the default India business account: India sandbox accounts reportedly get `USER_COUNTRY_NOT_ALLOWED` on Payouts.
2. **Create the app.** **Apps & Credentials → Sandbox → Create App**. Name it `Remedy`, type Merchant, and pick the **US business** sandbox account from step 1. Copy the Client ID and Secret into `.env`.
3. **Turn on the features**, on the app's page:
   - Tick **Payouts**.
   - Tick **Log in with PayPal**, set the Return URL to `http://127.0.0.1:8787/callback`, and open **Advanced settings**. Tick email, full name, **PayPal account ID (payer ID)** and **account verification status**. If it asks for privacy-policy and user-agreement URLs, any URL works for the sandbox.
   - Save. A `http://localhost…` Return URL makes the save fail ("Something went wrong saving the application", HTTP 520); `127.0.0.1` saves fine. If it still won't save, skip it: test 4 below is the fallback.
4. **Finish `.env`.** Set `PAYPAL_RECEIVER_EMAIL` to the US personal sandbox account's email (from Sandbox Accounts → View/Edit).
5. **Run it:**
   ```bash
   npm run spike:paypal
   ```
   It sends a $1.00 payout by email straight away. Then open http://127.0.0.1:8787 and use the **US personal** sandbox account:
   - **Test 3, Log in with PayPal:** gets your payer ID, then pays exactly that account.
   - **Test 4, a $1 hold then release:** the fallback identity check.
   - Click **Finish** when done. Results are saved in `spikes/out/spike1.json`.

If PayPal also rejects `127.0.0.1`, run `ngrok http 8787`. Use the `https://…ngrok…/callback` address both in the dashboard and as `PAYPAL_REDIRECT_URI` in `.env`.

**Pass:** tests 1 and 2 pass, plus either test 3 or test 4.

## Spike 2: the camera check

**Result, 7 Nov: GO with GPT-6.1 Sol at high effort.**
- Across 36 claims, 3 runs each, it paid every real claim and rejected every wrong code, wrong label and wrong model.
- It never paid a web photo.
- It costs about 1.1¢ and 16 seconds a claim.
- Its one miss is an AI image with a subtle physical flaw. That's a job for the capture path, not the model (see "What this can't show").

### The test set: 36 claims

| Set | Cases | What it tests |
|---|---|---|
| Web photos | `w01`–`w17`: real owner photos (Govee, Aloha Breeze, Midea); official "correct photo" examples (Steamfast, Lexmark); CPSC product shots (DREO, HotHands, Kikea); traps (other pillows, AI fakes from news coverage, a screenshot, a photo of a monitor, a photo against the wrong recall) | Reading labels and steps. No web photo can carry this claim's code, so none may ever pay. `w03` turns the code check off and should pass. |
| Code-on | `c01`–`c14`, AI images made by `make-code-photos.mjs`: eight real-looking claims with the code (`c01`–`c08`); wrong codes (`c09` has K7O written, while `c11`–`c13` reuse a good photo under a different expected code); a photo of a screen (`c10`); an AI artifact (`c14`, three cut ends on two pieces) | The pass path, and the character-by-character code check |
| Held out | `h01`–`h05`, written after the round-1 fixes: new HotHands and Kikea claims, a wrong label (X-VESOLIE), a model that isn't recalled (SF-430), a slit instead of a cut | Whether the fixes hold on photos they never saw |

Each case scores every answer (label, each step, code, screen) against an answer key, not just the decision. Every image was checked by eye before its key was trusted. Sources and prompts are in `spikes/photos/SOURCES.md`; the images are git-ignored.

```bash
npm run spike:vision                                    # GPT-6.1 Sol, high effort, all cases
npm run spike:vision -- --model gpt-6.1-terra --effort medium --out spikes/out/x.json
node --env-file=.env spikes/make-code-photos.mjs        # makes any code-on case that's missing
node spikes/summarize.mjs spikes/out/runs               # one row per model across repeated runs
```

Claude runs the same way with `--model claude-opus-5-5` once `ANTHROPIC_API_KEY` is in `.env`. It hasn't been run yet.

### Results: 3 runs per model, high effort

Round 2 covers the 31 `w` and `c` claims; the held-out set is the 5 `h` claims. Each cell shows round 2 first, then held out.

| Model | Decisions right | Real claims paid | Fakes paid | Answers right | Seconds per claim | Cost per claim |
|---|---|---|---|---|---|---|
| **GPT-6.1 Sol** | 29–30 of 31 · 5 of 5 | 21 of 21 · 6 of 6 | 3, all `c14` · 0 | 91% · 96% | 16 (max 40) | $0.011 |
| GPT-6 Astra | 29–30 of 31 · 5 of 5 | 21 of 21 · 6 of 6 | 1, `c14` · 0 | 90% · 96% | 26 (max 67) | $0.064 |
| GPT-6.1 Terra | 29–30 of 31 · 5 of 5 | 18 of 21 · 6 of 6 | 2, `c14` · 0 | 93% · 96% | 10 (max 19) | $0.005 |
| GPT-6 Luna | 28–29 of 31 · 4–5 of 5 | 16 of 21 · 6 of 6 | 3, `c14` · 2, `h03` | 93% · 96% | 10 (max 27) | $0.0006 |

All four models rejected all 12 wrong-code attempts and every web photo, in every run.

Why Sol:
- **Terra** holds the two-photo claim because it can't confirm both photos show the same pillow.
- **Luna** reads "R8D" as "R&D" every time, and paid the X-VESOLIE label twice.
- **Astra** is 6× the price and too slow to demo. It does catch the `c14` flaw (2 of 3 runs here, 3 of 3 in round 1).
- **Sol at medium effort** matched Sol at high on the 17 web claims, at 8 s a claim. That's an option if the demo needs speed.

The harness's strict GO line still prints NO-GO for every model, because every model paid `c14` at least once.

### What changed between rounds

In round 1, Sol paid 16 of 21 real claims and Terra only 3. None of the holds was a vision failure. The models were right to hold, given what they'd been told:
1. The stand-in spec never said the handwritten X-VESOLJE tag *is* the stand-in's label, so Terra doubted it was a product label.
2. The HotHands spec asked for "the claim number" in "permanent marker". The models couldn't know the one-time code is the claim number, can't see permanence, and couldn't tell which printed number is the batch code.
3. The Kikea spec copied CPSC's text ("leaves"), but the pillow also has blue flowers.
4. Two answer keys were wrong, and both were my mistakes:
   - **w05:** I wrote the key from the first frame only. The second frame does show the cut stub, as every large model said.
   - **c03:** its photo 2 had three cut ends on two pieces, which Astra spotted and I'd missed. It became `c14`, and `c03` was remade.

Round 1 results are kept in `spikes/out/runs-v1`.

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
  - the capture path: a live camera only, with the code issued inside that session;
  - one claim per verified PayPal account per unit.
- **Claude**, which needs an Anthropic key.
- **An independent answer key.** One person wrote the keys and checked them by eye.

Spend for the whole spike: about $18 of OpenAI usage. That's $0.83 on images and the rest on vision runs.

### Before the demo: one real capture

Shoot one real claim on any phone: a cheap pillow or cushion as the stand-in, cut in half, with a paper tag reading `X-VESOLJE` and that claim's code. Put it in `spikes/photos/r01-real-capture/` with a `case.json` such as `{ "code": "<the code>", "expect": "pass", "spec": "spikes/specs/standin-pillow.json" }` and run `npm run spike:vision`.

The model only describes what it sees; a fixed rule in the code decides pass, hold or reject.
