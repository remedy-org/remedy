# Remedy design system: "Evidence Room"

Approved 7 Nov 2026 from three explored directions (variant B), then made physical the same day ("Evidence Room, made physical": paper objects, stamps, a lit light table, one serif for money). It will be refined as we build; changes land here first, then in code. `docs/PRODUCT.md` owns what exists; this file owns how it looks and moves.

## Brief

**The feeling:** an evidence room that runs on trust. Forensic precision, calm, serious enough for a child-safety recall, and premium enough to sell to a company.

| Surface | Archetype | Density | Motion budget |
|---|---|---|---|
| Homepage | Marketing, product-first hero | Roomy | Exactly four moves: focus-in, one scrubbed sequence, ink, drop (see Motion) |
| Claim flow | Guided verification (Stripe Identity patterns) | Roomy, one action per screen | State changes, plus one arrival moment (the receipt) |
| Seller console | Data, calm density (AG Grid) | Tight | Near zero: panel 160ms, cell flash, row insert |

**One brand hue:** evidence-tag amber, used for the primary action and the "exhibit" annotations. Everything else is tinted graphite.

## What we borrow, and from where

These patterns come from measured reference sites (Stripe, Linear, Mercury, Persona, Ramp, Clerk, Stripe Identity, AG Grid demos):

- **Two-tone headline (Stripe):** the claim in full text colour, the explanation in muted.
- **Restraint (Stripe, Ramp):** two weights for most text, few sizes.
- **Real product in the hero (Clerk):** the working claim screen, not an illustration.
- **Evidence next to the verdict (Stripe Identity):** photo beside a monospace verdict and the payout line.
- **Hairlines and ring shadows instead of drop shadows (Linear, Clerk).**
- **Navigation (Linear, Mercury):** "Sign in" as quiet text, one filled primary button.
- **Grid (AG Grid's own demo):** status tabs, dot pills, two-line cells.

**Never:** more than one pinned sequence per page; a pin longer than 320vh; a pinned frame that is ever empty; a pin without a skip link; a fade-in from black, gradient or acid brand colours, illustration carousels, walls of logos and video tiles, emoji, lorem ipsum, or PayPal's logo (we name PayPal in plain text only).

## Type

- **Instrument Sans** for headings and body, loaded with `next/font/google`. It is not the create-next-app default, so it doesn't read as a template.
- **IBM Plex Mono** for evidence: codes (`K7M`), claim IDs, payer IDs, amounts in grids, timestamps and exhibit labels.
- **Instrument Serif, 400 italic only**, for monumental money and the hero's second line, on the homepage only (`font-serif`). It's loaded in the root layout without a preload, so a page that sets no text in it never downloads it.
- **Weights:** 400 for body, 500 for UI labels, 600 for headings. Nothing heavier.

| Token | Size / line height | Use (and only this) |
|---|---|---|
| `numeral` | Serif italic 400, clamp(72px, 11vw, 160px) / 0.9, -0.02em, tabular | Monumental numbers: the custody payout `$29.99`, Problem stats, Proof's `0` |
| `display` | Sans 600, clamp(44px, 7.8vw, 116px) / 0.94, -0.04em; line 2 in serif italic 400, -0.02em, `--muted` | Homepage hero h1 only (112px at 1440) |
| `title-lg` | Sans 600, clamp(36px, 4.4vw, 64px) / 1.0, -0.035em | Homepage statement titles; at most two two-tone uses on the page |
| `head-sm` | Sans 500, 20 / 1.3, -0.01em, two-tone | Homepage small section heads |
| `h1` | 44 / 1.08, -0.02em | App only; not used on the homepage |
| `title` | Sans 600, 32 / 1.1, -0.02em; 26 below 640px | Claim-flow screen titles |
| `amount` | Sans 600, 64 / 1.0, -0.03em, tabular; 52 below 640px | Claim-flow refund and receipt amount |
| `h2` | 28 / 1.15, -0.015em | Screen titles in the console |
| `lead` | 20 / 1.5 | Hero and section intros, at most 60ch wide |
| `body` | 16 / 1.6 | Running text, at most 68ch wide |
| `ui` | 14 / 1.45 | Controls, grid cells, labels |
| `micro` | 12 / 1.4, +0.06em, uppercase in mono | Exhibit labels, eyebrows |

Use tabular numbers everywhere digits line up. The homepage may use seven sizes (160 / 112 / 64 / 20 / 16 / 14 / 12); app screens keep six.

**Money** (`<Money value={29.99} size="numeral|amount|inline|grid" />`): the whole part, then the cents de-emphasised, as Mercury does.
- `numeral` and `amount`: cents at 55%, raised to the cap height (`vertical-align: .62em`).
- `inline` (the surrounding text's font) and `grid` (14px mono): cents at 73%, raised 0.2em.
- Screen readers and copy-paste get the plain "$29.99"; the split parts are hidden from assistive tech.

## Colour

Colours are OKLCH tokens in `src/app/globals.css` and exposed to Tailwind through `@theme inline`. Dark is the brand; the app also has a designed light mode. The homepage is dark only, by choice.

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg` | `oklch(0.165 0.012 255)` | `oklch(0.985 0.003 255)` | Page |
| `--surface` | `oklch(0.205 0.013 255)` | `oklch(1 0 0)` | Cards, panels |
| `--surface-2` | `oklch(0.245 0.014 255)` | `oklch(0.962 0.004 255)` | Insets, grid header |
| `--line` | `oklch(1 0 0 / 0.08)` | `oklch(0.2 0.02 255 / 0.1)` | Hairlines |
| `--text` | `oklch(0.96 0.005 255)` | `oklch(0.2 0.02 255)` | Primary text |
| `--muted` | `oklch(0.72 0.012 255)` | `oklch(0.46 0.02 255)` | Secondary text, second half of headlines |
| `--faint` | `oklch(0.64 0.012 255)` | `oklch(0.54 0.015 255)` | Meta and small print; still 4.5:1 on every surface |
| `--accent` | `oklch(0.80 0.15 75)` | `oklch(0.74 0.15 72)` | Primary button fill, exhibit marks |
| `--accent-ink` | `oklch(0.22 0.03 70)` | `oklch(0.22 0.03 70)` | Text on accent |
| `--accent-text` | `oklch(0.82 0.13 78)` | `oklch(0.52 0.12 62)` | Amber used as text |
| `--pay` | `oklch(0.78 0.16 150)` | `oklch(0.48 0.14 150)` | Paid, check passed |
| `--hold` | `oklch(0.76 0.10 240)` | `oklch(0.50 0.12 250)` | Held for a person |
| `--stop` | `oklch(0.70 0.17 25)` | `oklch(0.51 0.19 27)` | Rejected, blocked |

**Paper and ink** keep their colour in both themes, like the real objects (the tag, the receipt, the notice):

| Token | Value | Role |
|---|---|---|
| `--paper` | `oklch(0.95 0.012 85)` | Tags, sheets, receipts; the Problem band |
| `--paper-2` | `oklch(0.91 0.014 85)` | Chips and rows on paper; notices lying on paper |
| `--paper-line` | `oklch(0.24 0.02 255 / 0.18)` | Hairlines and dashed rows on paper |
| `--ink` | `oklch(0.24 0.02 255)` | Text on paper |
| `--ink-muted` | `oklch(0.42 0.02 255)` | Secondary text and exhibit labels on paper |
| `--pay-ink` | `oklch(0.44 0.14 150)` | Paid, on paper |
| `--hold-ink` | `oklch(0.46 0.12 250)` | Held, on paper |
| `--stop-ink` | `oklch(0.50 0.18 27)` | Refused, on paper |
| `--highlight` | `--accent` at 55% | Highlighter under ink |
| `--table-glow` | an amber radial under the hero device | The lit light table (dark surfaces only) |
| `--rail` | `oklch(1 0 0 / 0.06)` | The homepage's page rails |

**Rules:**
- Each state colour has a soft background at 14% alpha and its text colour. State is never shown by colour alone: it always has a word and an icon.
- Held is blue, not amber, so it never reads as the brand.
- Body text meets 4.5:1 and UI borders 3:1 in both themes. Every ink meets 4.5:1 on `--paper` and `--paper-2`, a stamp's ink at 85% included, and every state colour meets 4.5:1 on its soft pill in both themes.
- `npx tsx scripts/contrast.ts` checks all of these from `globals.css` (OKLCH to sRGB to WCAG) and fails on any miss. Run it after changing a colour; when a pair fails, lower that colour's lightness in 0.02 steps until it passes. (It set the inks at 0.44 / 0.46 / 0.50 and the light state colours at 0.48 / 0.50 / 0.51.)
- Amber never sits on paper as text (1.5:1); on paper, exhibit labels use `--ink-muted`.

## Space, radius, depth

- **Spacing:** a 4px base. Use 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 (homepage section padding: 128 desktop, 72 mobile).
- **Widths:** content max 1200px; reading columns 68ch; claim flow 480px for the main card.
- **Radius:**
  - 6px for buttons, inputs and chips;
  - 10px for cards and drawers;
  - 16px for device frames;
  - 999px for status pills only.
- **Depth:** 1px hairline borders do the structural work. Floating layers (menus, drawer, toasts) get a ring (`0 0 0 1px var(--line)`) plus one soft shadow. Paper objects get a `--paper-line` ring plus `--paper-shadow` (`--paper-shadow-flat` when paper lies on paper). No other shadows.
- **Grain** (homepage and claim flow, not the console): `.grain` on the layout root adds a fixed 160px `feTurbulence` noise tile at 3.5%, with no blend mode so scrolling never repaints the viewport.
- **Rails** (homepage only, 1024px and up): two 1px `--rail` lines at the 1200px content edges with a 6px tick every 96px.
- **Light table:** `--table-glow` under the device and a 1px top bevel highlight (`inset 0 1px 0 oklch(1 0 0 / .06)`) on the table plane.

## Motion

- **Micro-interactions:** 160ms ease-out (`cubic-bezier(0.2, 0.8, 0.2, 1)`), transform and opacity only.
- **Larger transitions:** up to 360ms.
- **Library:** Motion (`motion/react`), only where CSS can't do it.
- **Tokens** (CSS in `globals.css`, mirrored as `EASE`, `DURATION` and `SPRING` in `src/components/ui/motion.ts`):

| Token | Curve | Use |
|---|---|---|
| `--ease-snap` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | UI, 160ms (`--dur-ui`) |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Reveals 700–1000ms (`--dur-reveal` 900ms); panels 160ms |
| `--ease-out-quart` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | Objects moving 500–800ms (`--dur-object` 560ms); lines and strings drawing |
| `--ease-in-out-quart` | `cubic-bezier(0.76, 0, 0.24, 1)` | Flips triggered at a threshold, 600–700ms |
| `--ease-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Stamps landing, 200ms |
| `SPRING.drop` | spring, stiffness 320, damping 26 (Motion only) | Tags and thumbnails settling |

- **The homepage's four moves**, and nothing else animates:
  1. **Focus-in:** headings and leads go from blur 10px, 12px down and transparent to rest over 900ms `--ease-out-expo`, 80ms apart per line. Above the fold it runs in CSS on first paint; below, at 35% in view. Text only, never the 3D laptop.
  2. **Scrub:** the one pinned Chain of Custody sequence.
  3. **Ink:** things drawn by a pen. The highlighter (`background-size` 0 to 100%, 700ms), leader lines and strings (`pathLength` 0 to 1, 600ms `--ease-out-quart`), stamps (`.stamp-land`: scale 1.4 to 1 and fade in, 200ms `--ease-back`; the tilt never moves).
  4. **Drop:** paper objects settling, with `SPRING.drop` and a 2° rotation settle.
- **The hero moment:** the device sits in a slight 3D tilt on the light table (CSS perspective; up to 4° extra tilt following the pointer on desktop). Once it's in view, the five checks (in the order of "What stops a fake") tick in one after another, 450ms apart, then the payout chip lands with the time. Below a 640px stage the screen shows the camera alone and the checks tick in a full-size card under the laptop. It plays once, and replays on a "Replay" control.
- **Resting state:** always the final one. No JS, reduced motion, or a screenshot all show the full page; CSS entrances run only under `prefers-reduced-motion: no-preference`.
- `prefers-reduced-motion`: no tilt, no pin, no blur, no flash, no spring; final states render immediately.

## Components

**Buttons:**
- Primary: amber fill with dark text.
- Secondary: a hairline outline.
- Tertiary: a text link with an arrow.
- Hover lightens the fill 4%; active presses 1px.
- Focus is a 2px amber ring with a 2px offset. Disabled drops to 40% opacity with no hover.
- Touch targets are at least 44px.

**Inputs:** a 1px line border, the focus ring as above, the label above the field, help text below in `--muted`, and errors in `--stop` with a fix.

**Status pill:** a dot, then a word ("Paid", "Held", "Rejected", "Blocked"), in the state's soft background and text colour.

**Exhibit label:** mono, micro size, amber text with a hairline leader line to what it annotates. On paper it uses `--ink-muted`.

**Paper** (`<Paper variant="tag|sheet|receipt|notice">`): `--paper` and `--ink`, radius 6, ring plus `--paper-shadow`. A tag has its top corners cut; a notice is `--paper-2` with the flat shadow, for a document lying on the paper band. Options: `hole` (a 10px punched hole with a reinforcement ring, 14px from the top edge), `perforated` (a torn top edge), `tilt` (-1.5° to 2°). The hole and the perforation are real cut-outs: the surface behind shows through.

**Stamp** (`<Stamp tone="pay|hold|stop|neutral">PAID</Stamp>`): 2px border, radius 6, 14px Plex Mono 600, +0.14em tracking, the tone's ink at 85%, rotated -8°. Decorative (`aria-hidden`): the status is always also in text. Never bigger than 14px type, never textured, one colour. `land` plays the landing once on mount.

**The mark:** an amber evidence tag (top corners cut, a punched hole, the code written on it) on a string loop, hanging at the stamp's -8°. 22px in the homepage nav, 18px in app chrome. The string draws in once on load (600ms `--ease-in-out-quart`), static under reduced motion.

**Theme toggle:** a 36px icon button with a 44px hit area and an `aria-label`; the glyph is a half-lit disc that turns over with the theme.

**Evidence panel** (the console's; one component, `EvidencePanel` in `EvidenceDrawer.tsx`):
1. the photos as Exhibit A, which open full size;
2. each check with its outcome icon, the model's quoted evidence in mono, and the pre-checks;
3. the rule's decision in one sentence;
4. actions (Approve needs a second click to pay; A and R open the same confirm).

It docks 440px wide beside the grid from 1280px, opens as a sheet over the grid from 1024px, and fills the screen on phones. Esc closes it and returns focus to the row; moving through the grid's rows with ↑ and ↓ moves it with them.

**AG Grid:**
- Theming API (`themeQuartz.withParams`) mapped to the tokens above.
- Header 36px, rows 52px (two-line cells), font `ui` and mono for IDs and amounts.
- Evidence cells: photo thumbnails, the decision pill with its reason, an evidence barcode (one bar per check: pre-checks, then the model's), payout status, and a timeline chip.
- No zebra stripes; hairline row borders; the selected row tinted `--accent` at 8%, the open row with a 2px amber edge.
- Below 720px of grid width each claim is one card row (72px). The homepage's read-only still keeps its columns down to 592px.

## Screens

**Homepage**, as shipped (`src/app/(marketing)/page.tsx`); the reduced-motion page is at most 7,600px tall at 1440 (7,552px now):
1. Nav: wordmark, How it works, then the exhibits by letter (A Problem, B Checks, C Proof, D For companies), Sign in, and **Start a recall**.
2. Hero, which is also "How it works": a two-tone headline, the lead, **Start a recall** and "Try a claim with sample photos →" (with a faint line that the demo needs a PayPal sandbox personal account), the device on the light table, and the Chain of Custody: one real claim in five chapters (Log in with PayPal, One-time code, Live photo, Five checks, Paid). It is the one pinned sequence on laptops of at least 1024×700 with motion allowed, a sticky phone on smaller screens, and static figures without JS or under reduced motion. There is no separate "How it works" section.
3. Exhibit A, the problem, on paper: 6–10% of recalled products come back, and real notices still say "email a photo to a @gmail.com inbox".
4. Exhibit B, what stops a fake: the five checks as a gate pipeline, the first three needing no AI, and "Run these four yourself".
5. Exhibit C, proof: the eval table from `docs/EVAL.md`.
6. Exhibit D, for companies: the real read-only claims grid (`ClaimsGridPreview`) on the 40 seeded sample claims, loaded one viewport ahead; the static `ConsoleReplica` stands in, at the same 809px at 1440, until it loads and without JS. Both are labelled SAMPLE DATA, with "Sample / not sent" payouts and AI-made photo labels. Phones get four card rows, one of each outcome. Then Log in with PayPal.
7. Footer.

**Claim flow:** one step per screen on the graphite background, following Stripe Identity; focus moves to each step's heading:
- **Consent screen:** the 64px refund and the hazard banner above the fold, the company and Remedy side by side, the numbered steps, then one full-width primary button. The demo (`/try`) swaps the steps for the four sample claims (thumbnail and expected outcome), adds a sandbox callout above the button, and a judges' rail (280px at 1440; a "For judges" pill on phones).
- **Code step:** the paper tag with the one-time code, a timer pill, and the phone QR leading on laptops.
- **Camera step:** a full-width viewfinder with the shutter on the first phone screen, guide chips and the Space key as shutter on laptops.
- **Checking:** the first photo as Exhibit A beside a five-stage timeline that fills with the model's quotes.
- **Result:** paper. Paid is a perforated receipt with the 64px amount, a PAID stamp and the live PayPal status ("Paid N s after your photo", then "Received"; the receipt asks every 5 s for 30 s, then every 15 s, for 2 minutes at most, never while the tab is hidden, and stops on a settled status, rather than the spec's 4 s for 3 minutes, to stay inside the Blob budget); in a sandbox build the stamp reads PAID · SANDBOX and the line says sandbox money, sample or not; held and refused are a sheet with the evidence, the stamp and, when refused, the one failing check in red.

**Console:** from 1024px the queue fills the viewport: the recall's ledger (remedied of sold with a meter, paid out, held, refused), status tabs (All, Paid, Held, Rejected, Blocked, In progress) with search, the claims grid, and the evidence panel docked on the right. It polls for new claims every 8s only while the queue can still change (a claim filed in the last 12.5 minutes still pending, a payout settling in its first half hour, or a demo claim from the last 10 minutes), only while the tab is visible and for 10 minutes per view, flashing the cells that change; a new claim shows within about 8 to 12 s. An abandoned claim or a payout parked at UNCLAIMED never keeps it polling. With a row open, the evidence panel docks from under the console header to the foot of the window and leads with what decided the claim. Phones get card rows and no horizontal scroll.

## States

Every data view ships all five: empty, loading (skeletons shaped like the content), error (what went wrong and what to do), partial, and success. The money path never silently fails: if PayPal or the model is down, the claim is held and the owner is told so.

## The gate

A screen is done only when it passes the anti-slop gate in the `design` skill:
- grayscale and squint tests;
- spacing on the 4px scale;
- at most 6 sizes and 3 weights (7 sizes on the homepage);
- real copy;
- all five states;
- works at 375px;
- AA contrast;
- a real dark palette;
- and it looks like the references, not a template.
