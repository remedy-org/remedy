# Remedy: product map

What we build for the PayPal AI Hackathon (submit 11 Nov 2026), and how each screen behaves. `DESIGN.md` owns how it looks; this file owns what exists and what it does.

**One line:** recall refunds in a minute for people who really destroyed the product, and never for a faked photo.

Remedy is its own website built on PayPal's public APIs. Companies running a recall are the customers; owners of the recalled product never create a Remedy account. At launch, refunds go from the company's PayPal business account straight to the owner's PayPal account, and Remedy never holds money. In this build they come from Remedy's own PayPal sandbox business account (see Decisions), and the copy says so.

## Decisions (7 Nov 2026)

| Topic | Decision |
|---|---|
| Stack | One Next.js 16 app (Tailwind 4, AG Grid 36) on Vercel. API in route handlers; no separate backend. |
| Language | TypeScript, strict, for all new code. The `.mjs` spike scripts stay as the record of the experiments. |
| Storage | Vercel Blob: private photos, one JSON file per claim, one index file. No database. |
| Vision | GPT-6.1 Sol at high effort describes; a fixed rule in code decides. |
| Photos | Real claims use the live camera (laptop webcam or phone): the page has no upload, and a photo counts only if it arrives inside the claim's 10-minute camera session, carrying its key. Judges get a labelled "Try with sample photos" demo. |
| Company sign-in | Log in with PayPal (business account). A new company's workspace starts with the Kikea demo recall. |
| Screens | Laptop first everywhere, and fully usable on a phone. |
| Repo | Private until the freeze (Tue 10 Nov 23:59 IST), then public with its history. |
| Payout account | This build sends every refund from Remedy's one PayPal sandbox business account (the app's `PAYPAL_CLIENT_ID`). Per-company accounts need PayPal partner onboarding, after the hackathon. Until then the copy names Remedy's account, recalls published from the console start with auto-pay off, and the demo recall's settings are fixed. |
| Demo mode | `/r/<slug>/try` and sample claims exist only for the Kikea demo recall, and only while `PAYPAL_API_BASE` is PayPal's sandbox. Judges log in with one PayPal sandbox personal account, on /try and on /signin alike: the business account that owns the PayPal app can't sign in to it (FEEDBACK.md #2). |

## Routes

| Route | Who | What |
|---|---|---|
| `/` | Everyone, judges first | The homepage that sells the idea. Sign in for companies; a "Try a claim with sample photos" path for judges. |
| `/signin` | Companies | Log in with PayPal, then on to `/console`. |
| `/console` | Companies | Claims grid (AG Grid) with the evidence drawer, overrides and the remedied-against-sold meter. |
| `/console/recalls/new` | Companies | Import a recall from a CPSC URL or number; review the drafted checks; publish. |
| `/console/recalls/[id]` | Companies | Recall settings: refund amount, auto-pay on or off, claim link and QR code. |
| `/console/report` | Companies | The CPSC progress-report draft, generated from the claims. |
| `/r/[recall]` | Owners | The claim flow (below). |
| `/r/[recall]/try` | Judges | Demo mode with sample photos, labelled on every screen. |
| `/api/...` | System | PayPal login callback, claim start, photo capture, PayPal webhooks, recall import. |

## The owner's claim flow

1. **Recall.** What was recalled and why, the refund amount, and the four steps ahead. One action: Log in with PayPal.
2. **PayPal login.** PayPal's own consent page. We get the payer ID and the verified flag.
3. **Code.** A one-time code (letter-digit-letter, no look-alike characters) and how to write it on a tag. The capture session lasts 10 minutes.
4. **Capture.** A live camera with no upload control. On a laptop: the webcam, or a QR code to continue on a phone. Up to 3 photos: the label, the destruction, the code (or one photo with all three).
5. **Checking.** Each check appears as it resolves: sent in the camera session, photo not used before, one claim per verified PayPal account, then the model's answers.
6. **Result.**
   - **Paid:** the amount, PayPal's payout status, and the time.
   - **Held:** what a person will look at, and when.
   - **Rejected:** the exact reason, and what to do instead.

## The company's console

- **Claims grid:** claim, time, PayPal account (masked, verified), decision, reason, payout status, amount. Filter by decision; sort by time.
- **Evidence drawer:** photos, every model answer with its quoted evidence, the pre-checks, the rule's decision, and approve or reject for held claims. Approve re-runs the duplicate and account checks, then pays through the same idempotent payout as the pipeline (the claim's payoutKey); if PayPal refuses, the claim stays held. Seeded sample claims are in every workspace and have made-up PayPal accounts, so approving or rejecting one says what would happen and saves nothing.
- **Header:** units remedied of units sold, paid out, waiting for review, refused.
- **Recall import:** paste a CPSC URL. The model drafts the checks under the five spec rules (`docs/EVAL.md`); the company edits, then publishes.

## Demo mode for judges

`/r/kikea-x-vesolje/try` runs the real pipeline on sample photos:
- a genuine claim, which pays;
- an AI image sent without a live session, refused before the model;
- a photo reposted from an earlier claim, refused as a duplicate;
- a wrong code, rejected by the model's reading.

Each run states that it is demo mode, and all money is sandbox money.

Demo claims are grouped in rounds, one per browser and PayPal account (an httpOnly cookie the samples page sets): the duplicate-photo, one-claim-per-account and repost-after-genuine checks compare a demo claim only with its own round's, never with real claims, so many judges on one sandbox login each get the four outcomes, and "Run the samples again" starts a new round. The genuine sample is compared only with the round's other genuine claims, so the other samples, run alongside it, never hold or block it. A run the model never answered (held for a person by the fallback) doesn't count against a run of the same sample, so the result's "Run this sample again" gets the model's answer; the scoreboard counts such runs as "model unavailable", not as misses. Demo claims never count towards the claim limits real owners meet: they have their own, per PayPal account (below).

A demo claim opens on its sample's photo: the tag is already written, so there is no code step and no timer. The photo step names the claim's code, what the photo must show and what the tag in it reads. "Next sample" on a result files the next sample and lands on its photo.

## States every data view must handle

Empty, loading, error, partial and success. Examples: a console with no claims yet; a claim whose payout is still pending; PayPal or the model being down (the claim is held, never lost).

## Setup

- **Log in with PayPal return URL:** the app returns to `APP_URL` + `/api/auth/paypal/callback`, e.g. `http://127.0.0.1:3000/api/auth/paypal/callback` locally. Add that Return URL under the app's **Log in with PayPal** settings in the PayPal dashboard (the owner does this; it needs the dashboard login). Browse the app at the `APP_URL` host: `/api/auth/paypal/start` moves `localhost` to `127.0.0.1` itself, so the login cookie and PayPal's return land on the same host.
- **Payout webhook:** in the PayPal dashboard, add a webhook on the app at `APP_URL` + `/api/webhooks/paypal` (e.g. `https://remedy-recalls.vercel.app/api/webhooks/paypal`), subscribed to the `PAYMENT.PAYOUTS-ITEM.*` events, and put its webhook ID in `PAYPAL_WEBHOOK_ID`. Without the ID the route refuses every event, since it can't verify them. Webhooks only make status changes land sooner: the console also asks PayPal again about up to 10 unsettled payouts when it loads (each at most once a minute per server instance), and the owner's claim page saves the status it shows.
- **Sessions:** `SESSION_SECRET` signs the session cookies. Local dev has a built-in default; production refuses to start a session without its own (`openssl rand -base64 32`).
- **Spending limits:** the live demo caps what a burst of traffic can cost. Days are UTC; every variable is optional and defaults to the number shown.
  - `VISION_DAILY_LIMIT` (100): photo checks a day, counted once per model call in `usage/<day>.json`. Past it, a real claim whose photos arrived is held for a person ("Remedy's daily photo-check limit is reached; a person will review this claim"), never rejected; a new demo claim is refused.
  - `DRAFT_DAILY_LIMIT` (20): recall-check drafts a day in the console. Past it, the import says so and the company writes the checks itself.
  - `CLAIM_DAILY_LIMIT` (10) and `CLAIM_MONTHLY_LIMIT` (30, any 30 days): new real claims, counted from `index.json` at no extra write. Demo and seeded claims never count, so judges sharing the production server can't lock real owners out, nor real owners judges. A claim costs about 10 Vercel Blob writes and the Hobby plan allows 2,000 a month, so 30 real claims are about 300.
  - `ACCOUNT_CLAIM_DAILY_LIMIT` (5) and `ACCOUNT_DEMO_DAILY_LIMIT` (40): real claims one PayPal account can start a day (abandoned and expired ones count), and demo claims it can run. A demo start left before its photo was sent stops counting towards its account's day once its 10-minute camera session ends (it cost no photo check), and the console leaves it out; pressing "Run this sample" again within 5 minutes continues the same start. Judges share one sandbox login, so 40 is 10 rounds of the four samples a day for all of them; two of the four reach the model, and `VISION_DAILY_LIMIT` refuses a demo start once the day's checks are used.
  - `DEMO_DAILY_LIMIT` (40) and `DEMO_MONTHLY_LIMIT` (200, any 30 days): demo claims every account together, abandoned starts included, since each start costs Blob writes. A demo round of four costs about 24 writes, so 200 demo claims (50 rounds) are about 1,200: with 30 real claims, any 30 days stays inside the Hobby plan's 2,000. At a cap the sample picker says today's (or this month's) sample runs are used up and when they reopen.
  - A refused start is never a lost claim: nothing was saved, and the recall screen or sample picker says which limit was hit, when it reopens in the viewer's own time, and what to do meanwhile (the company console for a judge, the company's recall notice for an owner) in place of the start button.
- **Blob budget:** the Hobby plan allows 10,000 Simple Operations (a `get()` that misses the cache) and 2,000 Advanced Operations (`put`) a month, and suspends the store for 30 days past either. Claims are always read past the cache, so every read counts. To stay inside it: the console renders from `index.json` alone (each row carries what the grid, stats and report show) and opens a claim file only for the drawer and for unsettled payouts; recalls are cached per server instance for 60 s (`src/lib/store/cache.ts`), except where money or an edit depends on them; the camera step polls a claim-only status route every 5 s while the tab is visible and stops 2 minutes after the session ends. `src/app/blob-budget.test.ts` pins every After figure below, counting each store call's own reads as the Blob store makes them (`src/lib/__fixtures__/counting.ts`). Simple Operations per action, before and after (after: a warm instance; a cold one adds up to 2 recall reads):

  | Action | Before | After |
  | --- | --- | --- |
  | Console or CPSC report view, 47 claims / 200 claims | 50 / 203 | 1 (3 cold), any number of claims; +1 when the recall shown is the company's own (read fresh); +1 per unsettled payout or stuck check, once a minute |
  | Evidence drawer with one photo | 4 | 3 |
  | Camera step poll | 2 every 3 s, up to 400 a session | 1 every 5 s while visible, up to 144 |
  | Checking step poll | 2 every 1.5 s, about 22 a check | 1 every 2 s, about 8 |
  | Claim page, recall page | 3, 4 | 1 (+1 per result photo on its first view; +1 for a refused repost, to find the earlier claim), 0 (the demo recall, cold too: it is kept in memory; an unknown slug: 1 at most every 10 s per instance) |
  | Sample picker | 3 + up to 12 | 1 |
  | Start a demo claim | 5 (+1, +1 per sent sample, for the repost) | 3 (+1 for the repost) |
  | Photos upload and check | 15 | 13 (+1 photo read); a demo claim 10 for the genuine sample (its photo from the deployment, its recall from memory, one save fewer), 8 for the wrong code, 4 for one the account checks block |
  | A whole demo run: picker to result | about 60 | about 30 |
  | Claims grid live poll (`GET /api/console/claims`) | (none) | 1 (3 cold) every 8 s, only while the queue is live (a claim filed in the last 12.5 min still pending, a payout settling in its first half hour, or a demo claim from the last 10 min), the tab is visible, and for 10 min per view: at most 75 polls; 0 for an idle queue, an abandoned claim or a payout parked at UNCLAIMED/ONHOLD. A failed poll retries after 16 s and 32 s, then stops |
  | Grid thumbnail (`?w=96`/`256`) | (none) | 1 per photo and width, ever (immutable, cached by key and width) |
  | Evidence panel open at a row's version (`?v=`) | 3 | 1 for a new claim (its recall from the 60 s cache), 0 on a second pass; a held claim a person can pay reads index.json too, every time (what approve's checks would stop now); approve and reject still read fresh |
  | Paid receipt live status | (none) | 1 a poll: every 5 s for 30 s, then every 15 s, at most 12 polls in 2 min, only for a payout sent in the last 10 min that hasn't settled, never while hidden; PayPal asked at most once a minute |

  A round of the four samples costs 24 Advanced Operations: 9 for the genuine claim (its settled payout included), 7 for the wrong code and 4 for each one the account checks block, with no sample photo ever uploaded. From the picker to the result it costs 64 Simple Operations with one checking poll per claim, about 80 with the checking step's usual 8 polls. At the caps a day costs at most 240 demo writes (`DEMO_DAILY_LIMIT`: 40 claims, 10 rounds) and about 100 for real claims (`CLAIM_DAILY_LIMIT`: 10, at about 10 each), and any 30 days at most about 1,500 of the plan's 2,000: 1,200 for 200 demo claims (`DEMO_MONTHLY_LIMIT`: 50 rounds) and about 300 for 30 real ones (`CLAIM_MONTHLY_LIMIT`). Reads stay inside too: 50 rounds are about 4,000 Simple Operations, and 2,000 other page views (half of them console views) about 4,000 more, of the plan's 10,000.
- **Demo data:** the Kikea recall (`/r/kikea-x-vesolje`) and its seven claims (`src/lib/demo/claims.ts`) are built in memory at request time (`src/lib/demo/dataset.ts`), never seeded: a new deploy against any store, an empty `data/` included, shows them with no write, and a page view writes nothing. Claims an earlier seed stored (marked `seeded`) are never listed or opened. A `/try` demo run is listed in the console only to the browser whose demo round made it. The demo claims are marked `seeded`, use fake PayPal accounts, and only RM-0442 was paid. Decided sample claims keep the eval photos' codes (K7Q, R8D), which Remedy no longer issues (no Q, no 8): the code is written in each photo, so changing it would change the decision.
- **Screenshots:** with the dev server running, `npm run shots -- / /console --as company` writes full-page PNGs at 1440 and 375 px, dark and light, into `.shots/`.
