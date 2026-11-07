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
| Photos | Real claims use the live camera only (laptop webcam or phone). Judges get a labelled "Try with sample photos" demo. |
| Company sign-in | Log in with PayPal (business account). A new company's workspace starts with the Kikea demo recall. |
| Screens | Laptop first everywhere, and fully usable on a phone. |
| Repo | Private until the freeze (Tue 10 Nov 23:59 IST), then public with its history. |
| Payout account | This build sends every refund from Remedy's one PayPal sandbox business account (the app's `PAYPAL_CLIENT_ID`). Per-company accounts need PayPal partner onboarding, after the hackathon. Until then the copy names Remedy's account, recalls published from the console start with auto-pay off, and the demo recall's settings are fixed. |
| Demo mode | `/r/<slug>/try` and sample claims exist only for the Kikea demo recall, and only while `PAYPAL_API_BASE` is PayPal's sandbox. Judges log in with a PayPal sandbox personal account. |

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
5. **Checking.** Each check appears as it resolves: live session, photo not seen before, first claim for this account, then the model's answers.
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

Demo claims are grouped in rounds, one per browser and PayPal account (an httpOnly cookie the samples page sets): the duplicate-photo, one-claim-per-account and repost-after-genuine checks compare a demo claim only with its own round's, never with real claims, so many judges on one sandbox login each get the four outcomes, and "Run the samples again" starts a new round. The genuine sample is compared only with the round's other genuine claims, so the other samples, run alongside it, never hold or block it. The per-account and global daily limits still count every demo claim.

## States every data view must handle

Empty, loading, error, partial and success. Examples: a console with no claims yet; a claim whose payout is still pending; PayPal or the model being down (the claim is held, never lost).

## Setup

- **Log in with PayPal return URL:** the app returns to `APP_URL` + `/api/auth/paypal/callback`, e.g. `http://127.0.0.1:3000/api/auth/paypal/callback` locally. Add that Return URL under the app's **Log in with PayPal** settings in the PayPal dashboard (the owner does this; it needs the dashboard login). Browse the app at the `APP_URL` host: `/api/auth/paypal/start` moves `localhost` to `127.0.0.1` itself, so the login cookie and PayPal's return land on the same host.
- **Payout webhook:** in the PayPal dashboard, add a webhook on the app at `APP_URL` + `/api/webhooks/paypal` (e.g. `https://remedy-recalls.vercel.app/api/webhooks/paypal`), subscribed to the `PAYMENT.PAYOUTS-ITEM.*` events, and put its webhook ID in `PAYPAL_WEBHOOK_ID`. Without the ID the route refuses every event, since it can't verify them. Webhooks only make status changes land sooner: the console also asks PayPal again about up to 10 unsettled payouts when it loads (each at most once a minute per server instance), and the owner's claim page saves the status it shows.
- **Sessions:** `SESSION_SECRET` signs the session cookies. Local dev has a built-in default; production refuses to start a session without its own (`openssl rand -base64 32`).
- **Spending limits:** the live demo caps what a burst of traffic can cost. Days are UTC; every variable is optional and defaults to the number shown.
  - `VISION_DAILY_LIMIT` (100): photo checks a day, counted once per model call in `usage/<day>.json`. Past it, a real claim whose photos arrived is held for a person ("Remedy's daily photo-check limit is reached; a person will review this claim"), never rejected; a new demo claim is refused.
  - `DRAFT_DAILY_LIMIT` (20): recall-check drafts a day in the console. Past it, the import says so and the company writes the checks itself.
  - `CLAIM_DAILY_LIMIT` (60) and `CLAIM_MONTHLY_LIMIT` (150, any 30 days): new claims, real and demo together, counted from `index.json` at no extra write. A claim costs about 10 Vercel Blob writes and the Hobby plan allows 2,000 a month.
  - `ACCOUNT_CLAIM_DAILY_LIMIT` (5) and `ACCOUNT_DEMO_DAILY_LIMIT` (60): real claims one PayPal account can start a day (abandoned and expired ones count), and demo claims it can run. The demo limit matches the daily one because judges share one sandbox login.
  - A refused start is never a lost claim: nothing was saved, and the recall screen or sample picker says which limit was hit and when to try again.
- **Blob budget:** the Hobby plan allows 10,000 Simple Operations (a `get()` that misses the cache) and 2,000 Advanced Operations (`put`) a month, and suspends the store for 30 days past either. Claims are always read past the cache, so every read counts. To stay inside it: the console renders from `index.json` alone (each row carries what the grid, stats and report show) and opens a claim file only for the drawer and for unsettled payouts; recalls are cached per server instance for 60 s (`src/lib/store/cache.ts`), except where money or an edit depends on them; the camera step polls a claim-only status route every 5 s while the tab is visible and stops 2 minutes after the session ends. `src/app/blob-budget.test.ts` pins every After figure below, counting each store call's own reads as the Blob store makes them (`src/lib/__fixtures__/counting.ts`). Simple Operations per action, before and after (after: a warm instance; a cold one adds up to 2 recall reads):

  | Action | Before | After |
  | --- | --- | --- |
  | Console or CPSC report view, 47 claims / 200 claims | 50 / 203 | 1 (3 cold), any number of claims; +1 when the recall shown is the company's own (read fresh); +1 per unsettled payout or stuck check, once a minute |
  | Evidence drawer with one photo | 4 | 3 |
  | Camera step poll | 2 every 3 s, up to 400 a session | 1 every 5 s while visible, up to 144 |
  | Checking step poll | 2 every 1.5 s, about 22 a check | 1 every 2 s, about 8 |
  | Claim page, recall page | 3, 4 | 1 (+1 per result photo on its first view), 0 (an unknown slug: 1 at most every 10 s per instance) |
  | Sample picker | 3 + up to 12 | 1 |
  | Start a demo claim | 5 (+1, +1 per sent sample, for the repost) | 3 (+1 for the repost) |
  | Photos upload and check | 15 | 13 (+1 photo read) |
  | A whole demo run: picker to result | about 60 | about 30 |

  A month of 300 demo claims and 2,000 other page views (half of them console views) comes to about 300 × 30 + 2,000 × 2 ≈ 13,000 Simple Operations (before: about 70,000), still over the cap, and 300 × 12 ≈ 3,600 Advanced Operations (10 per claim, 2 more when the result page saves a new PayPal status), also over. `CLAIM_MONTHLY_LIMIT` (150) is what keeps both inside: about 8,500 Simple and 1,800 Advanced.
- **Demo data:** in dev the Kikea recall (`/r/kikea-x-vesolje`) and about 40 sample claims seed themselves on the first read. In production, run `npm run seed` once with `BLOB_READ_WRITE_TOKEN` set; `npm run seed -- --reset` refreshes the sample claims' times. Sample claims are marked `seeded`, use fake PayPal accounts and were never paid. Decided sample claims keep the eval photos' codes (K7Q, R8D), which Remedy no longer issues (no Q, no 8): the code is written in each photo, so changing it would change the decision.
- **Screenshots:** with the dev server running, `npm run shots -- / /console --as company` writes full-page PNGs at 1440 and 375 px, dark and light, into `.shots/`.
