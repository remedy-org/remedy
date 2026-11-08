# Remedy design system: "Evidence Room"

Approved 7 Nov 2026 from three explored directions (variant B), then made physical the same day ("Evidence Room, made physical": paper objects, stamps, a lit light table). Wave 3 (7 Nov) rebuilt the palette and type as **Lamplight**, the judged winner of three researched directions: a warm graphite room, cream paper and one amber, with Schibsted Grotesk for every word and JetBrains Mono for evidence. The research and judging live in the wave 3 scratchpad (`RESEARCH.md`, `DIRECTION.md`). On 8 Nov the amber was tuned to **brass** and the buttons, nav links and hero laptop were rebuilt ("Lamplight, tuned", the judged winner of three options rendered on the site; a violet accent was tried and left out, because it fought the cream paper and the brass money cues). It will be refined as we build; changes land here first, then in code. `docs/PRODUCT.md` owns what exists; this file owns how it looks and moves.

## Brief

**The feeling:** an evidence room that runs on trust. Forensic precision, calm, serious enough for a child-safety recall, and premium enough to sell to a company.

| Surface | Archetype | Density | Motion budget |
|---|---|---|---|
| Homepage | Marketing, product-first hero, confidence through restraint | Roomy | Exactly four moves: focus-in, one scrubbed sequence, ink, drop (see Motion), on inertial wheel scrolling |
| Claim flow | Guided verification (Stripe Identity patterns) | Roomy, one action per screen | State changes, plus one arrival moment (the receipt) |
| Seller console | Data, calm density (AG Grid) | Tight | Near zero: panel 160ms, cell flash, row insert |

**One brand hue:** brass, the amber of a manila tag and a brass grommet (calmer than marigold, so it sits with the cream paper as one warm system), and only for "the thing to do now" or "the thing happening now": one amber focal element per viewport (the 22px nav mark and the focus ring never count). Everything else is warm graphite, and the cream paper.

## What we borrow, and from where

These patterns come from measured reference sites (Stripe, Linear, Mercury, Persona, Ramp, Clerk, Stripe Identity, AG Grid demos):

- **Two-tone headline (Stripe):** the claim in full text colour, the explanation in muted.
- **Restraint (Stripe, Ramp):** two weights for most text, few sizes.
- **Real product in the hero (Clerk):** the working claim screen, not an illustration.
- **Evidence next to the verdict (Stripe Identity):** photo beside a monospace verdict and the payout line.
- **Hairlines and ring shadows instead of drop shadows (Linear, Clerk).**
- **Navigation (Linear, Mercury):** "Sign in" as quiet text, one filled primary button.
- **Grid (AG Grid's own demo):** status tabs, dot pills, two-line cells.

**Never:** more than one pinned sequence per page; a pinned beat shorter than about 70vh of scroll (the owner found the old 320vh pin "very fast"; the cap is gone, the pacing in `custody/pace.ts` rules, and the Opened Exhibit's stretch, chapters 03 to 05, follows `src/components/home/teardown/README.md`); a pinned frame that is ever empty; a pin without a skip link; a fade-in from black, gradient or acid brand colours, illustration carousels, walls of logos and video tiles, emoji, lorem ipsum, or PayPal's logo (we name PayPal in plain text only).

## Type

One voice. Both families are OFL and load with `next/font/google` in `src/app/layout.tsx`:

- **Schibsted Grotesk** for every word: display, headings, body, UI. One variable file, preloaded (it carries the h1, the LCP element). Weights: 400 body and leads; 500 display, headings, UI labels, buttons and pills; 600 only for the wordmark and the console ledger's figures.
- **JetBrains Mono** for evidence: claim IDs (RM-0442), codes (M4T, "Code K7Q"), recall numbers, masked payer IDs, timestamps, the grid's AMOUNT column, micro labels, stamps and the tag. 400 for data, 500 for IDs, the tag code and stamps. Not preloaded; it swaps in. Every ID and code is `white-space: nowrap`.
- **No serif, anywhere.** Instrument Sans, IBM Plex Mono and Instrument Serif are gone, and so is `--font-serif`.

Six steps: 56 / 40 / 22 / 17 / 14 / 12 (plus 28, the 40 step's phone floor and the app's screen titles). No screen renders more than six sizes.

| Token | Size / line height / tracking | Use (and only this) |
|---|---|---|
| `display` | clamp(40px, 3.9vw, 56px) / 1.03 / -0.03em, 500 | The homepage h1 (two-tone, no italic, nothing on the site is bigger), and the one number per screen where the number is the point: the paid receipt's $29.99 (`Money size="numeral"`, the custody odometer), Proof's 0. 40px on phones, not 36: at 36 the hero lead's block outweighs the h1 as the phone's LCP |
| `title-lg` | clamp(28px, 2.8vw, 40px) / 1.06 / -0.028em, 500 | Section headings, two-tone (`--text`, then `--muted`); the Problem stats; the footer tag's "Run a claim yourself." |
| `head-sm` | 22 / 1.3 / -0.01em, 500 | Small heads, gate and check names, the hero facts |
| `lead` | 22 / 1.45, 400, `--text-2` | The hero lead only (34ch); section intros are body |
| `body` | 17 / 1.55, 400, `--text-2` | Running text, at most 68ch; section intros at most 60ch |
| `ui` | 14 / 1.45 | Controls, grid cells, receipt rows, captions, the model's quoted evidence (sans, `--muted`, line height 1.55) |
| `micro` | 12 / 1.4, +0.04em, uppercase in mono | Eyebrows, exhibit labels, stamps. Pills use it in sans 500 with no case change and no tracking |
| `amount` | 56 / 1.0 / -0.03em, 500; 40 below 640px | Claim-flow refund and receipt amount |
| `title`, `h2` | 28 / 1.1 / -0.02em, 500 | Claim-flow and console screen titles |
| `h1` | 40 / 1.06 / -0.028em | App page titles |

**Figures:** never put `tabular-nums` on Schibsted text: its `tnum` also makes the point and comma tabular ("$29 .99", "19 , 596"). Tabular figures live only on mono (`code, kbd, samp, pre, .font-mono` get `tabular-nums slashed-zero` in base). Digits that must line up go in mono (`Money size="grid"`, timers); everything else keeps Schibsted's proportional figures.

**Money** (`<Money value={29.99} size="numeral|amount|inline|grid" />`): the whole part, then the cents de-emphasised, as Mercury does.
- `numeral` (display) and `amount`: cents at 55%, raised to the cap height (`vertical-align: .62em`), tight to the whole.
- `inline` (the surrounding text's font) and `grid` (14px mono, tabular): cents at 73%, raised 0.2em.
- Screen readers and copy-paste get the plain "$29.99"; the split parts are hidden from assistive tech.

## Colour

Colours are OKLCH tokens in `src/app/globals.css`, exposed to Tailwind through `@theme inline`. **Dark is the default**; light is the designed alternative. A saved choice (the theme toggle, on every page including the homepage) wins; with none saved, a visitor whose system prefers light gets light (the pre-paint script in `layout.tsx`). Token names are stable, so every page follows.

**Guards:** dark neutrals sit at chroma 0.004, hue 75 (above 0.005 the room turns brown and the amber, which shares the hue, stops popping); dark surfaces step by exactly +0.035 L; light neutrals stay at chroma 0.008 or less. A token that differs by theme lives only in the two theme blocks, never in the shared `:root, [data-theme]` block (which comes later and would override them).

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg` | `oklch(0.155 0.004 75)` #0d0c0a | `oklch(0.985 0.003 85)` #fbfaf8 | Page |
| `--surface` | `0.19 0.004 75` | `1 0 0` (white) | Cards, console window body, rule table, photo card, the light table; in light, the quiet button |
| `--surface-2` | `0.225 0.004 75` | `0.962 0.004 85` | Console chrome bar, grid header, evidence panel, the nav link's hover chip; in dark, the quiet button |
| `--surface-3` | `0.26 0.004 75` | `0.935 0.005 85` | Active tab chip, meter track, quiet-button hover (dark). Pills never sit on it |
| `--section-lift` | `0.175 0.004 75` | `0.968 0.004 85` | Top colour of each section's fade into the page |
| `--line` | warm white at 8% | ink at 11% | Hairlines inside components |
| `--line-2` | warm white at 15% | ink at 18% | Outlines of non-input controls: quiet buttons, chips, the SAMPLE DATA badge |
| `--line-strong` | `0.53 0.006 80` (opaque) | `0.62 0.008 70` | Input and search borders only (3:1) |
| `--text` / `--text-2` / `--muted` / `--faint` | `0.96` / `0.86` / `0.74` / `0.68` | `0.21` / `0.33` / `0.45` / `0.51` | Headings; body and leads; second tone, captions, nav; meta and eyebrows |
| `--accent` | `0.81 0.125 80` #ebb75b | `0.79 0.13 77` #e9af50 | Brass fill; in light a step deeper and richer, since 0.81 read pale (mustard) on the near-white page (rules below) |
| `--accent-hover` | `0.84 0.13 80` (lighter) | `0.75 0.135 75` (deeper: a lighter fill vanishes into the white page) | Primary button, hover |
| `--accent-press` | `0.76 0.125 78` | `0.72 0.13 74` | Primary button, pressed |
| `--accent-edge` | `0.64 0.11 74` | `0.62 0.11 74` | The primary's 1px rim (3:1 on the page in light, where brass alone is 1.75:1) and the mark's rim in light |
| `--accent-ink` | `0.22 0.03 65` | same | Text on brass (9.5:1) |
| `--accent-text` | `0.86 0.11 82` | `0.50 0.11 68` | The active state's label only |
| `--pay` / `--hold` / `--stop` | `0.79 0.13 150` / `0.78 0.08 240` / `0.72 0.16 28` | `0.45 0.13 150` / `0.44 0.11 250` / `0.48 0.18 28` | Paid (the one cool note: money arriving stands out); held for a person (the only blue); rejected or blocked |
| `--pool` | brass light at 13% | warm light at 22% | The light table (see Depth) |
| `--bevel` / `--halo` | 0.5px white top edge at 8% / cream halo at 5% | Clerk's two 2.4% soft layers / none | Machined detail on dark cards and controls |
| `--band` / `--band-sheet` | `--paper` / `--paper-2` | `0.935 0.01 85` / `0.975 0.007 85` (paper-2 read khaki beside the white page) | The Problem band and a notice lying on it |

**Paper and ink** keep their colour in both themes, like the real objects: `--paper` `oklch(0.94 0.014 85)`, `--paper-2` `0.90 0.016 85`, `--ink` `0.23 0.010 65`, `--ink-muted` `0.42 0.012 65`, `--pay-ink` `0.42 0.13 150`, `--hold-ink` `0.44 0.11 250`, `--stop-ink` `0.47 0.17 28`, `--paper-line` ink at 18%, `--highlight` amber at 55%. `--photo-scrim` (bg at 78%) and `--photo-scrim-text` back the "AI-made test photo" label on every sample photo.

**Where amber may appear:** the one primary action on a screen ("Try a claim with sample photos" in the hero and on the footer tag; the nav's "Try a claim" is a quiet button); the active state of a sequence (the chapter or check running now, the console's open row, the marked code region on the live photo); the highlighter on paper; `--accent-text` for the active state's label; the light-table pool. **Never** on eyebrows, exhibit labels or letters, links, headings, icons, inactive chart bars, section backgrounds or gradients, and never twice on one screen.

**Rules:**
- Each state colour has a soft background at 14% and its text colour. State is never shown by colour alone: it always has a word and an icon or dot shape.
- Every text pair is at least 4.5:1 in both themes, on every surface, the section fade, the open row and the pool's brightest point; input borders 3:1; every ink 4.5:1 on paper, paper-2 and the band, stamps included at 85%; every state colour 4.5:1 on its pill on the page, a card, the grid header and the open row.
- `npx tsx scripts/contrast.ts` checks all of these from `globals.css` (OKLCH to sRGB to WCAG, translucent layers composited) and fails on any miss. When a pair fails, lower that colour's lightness in 0.02 steps until it passes.
- Amber never sits on paper as text (1.5:1); stamps sit on `--paper` only.

## Space, radius, depth

- **Spacing:** a 4px base. Use 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 (homepage section padding: 128 desktop, 72 mobile).
- **One grid for the whole site:** the page frame is `.page` (content `--container-content: clamp(82rem, 75vw, 90rem)`: 1312px up to a 1750px viewport, growing to 1440px at 1920 so a wide screen shows no obvious margin, inside fluid gutters `--gutter: clamp(24px, 4.45vw, 64px)`, so 1440px in all at 1440), and `.grid-12` is the 12-column grid inside it (`--col-gap: clamp(16px, 1.67vw, 24px)`). Full-bleed backgrounds and media may run edge to edge; text never does. Text starts on two grid lines: column 1 (eyebrows, headings, primary text) and column 8 (section intros, the second stat, the CTA). The hero copy takes columns 1 to 6 and the laptop runs from column 7 toward the right edge, held to 46rem so its claim photo never out-paints the h1 (the LCP element); the pinned custody rail takes columns 1 to 3 and its screen 4 to 12.
- **No visible boundary:** no rails, ticks, margin numerals, column-edge rules or hairlines between sections. Structure comes from alignment, tone and space. Each section after another `--bg` section opens with a fade from `--section-lift` into `--bg` over 288px; the paper band is its own boundary: a large sheet lying on the room (`.band` in `home.module.css`), inset 8 to 16px from the screen's edges with 16px corners and `--paper-shadow`, so the page never jumps from graphite to a full-bleed cream band. The sheet is a layer behind the content, which keeps the page frame's grid.
- **Widths:** reading columns 68ch; claim flow 480px for the main card.
- **Radius:** 6px inputs and chips; buttons grow with their height, 8px at 36 and 44px (`rounded-button`) and 10px at 48px (`rounded-button-lg`), as is the nav link's chip; 10px cards and drawers; 16px device frames; 999px status pills only, so an action never has a verdict's shape.
- **Depth:**
  - Dark UI (cards, the console window, rule table, photo card, evidence panel) uses `shadow-card`: the 1px `--line` ring, the 0.5px `--bevel` top edge and the cream `--halo`. Controls use `shadow-ring` (ring and bevel). In light the bevel becomes two soft layers and the halo is off.
  - Buttons (`.btn-primary`, `.btn-quiet` in `globals.css`; their stacks differ by theme, so they are tokens): the primary is brass lit from above, a 1px white top edge (30%, 40% in light), a darker foot in dark only (on white it read skeuomorphic), the 1px `--accent-edge` rim and a 1-2px contact shadow. The quiet button is a raised key: `--surface-2` with an inset `--line-2` ring and a white top edge in dark; in light a white key on the page, an ink ring at 26%, a white top edge and a 1px drop. Both carry a transparent 1px border, which forced colours (Contrast Themes) paints, so a button keeps its shape there; the primary's is `ButtonText`. Tertiary is a text link whose arrow moves 3px on hover and on keyboard focus.
  - Paper uses `--paper-shadow` (ring, inner top highlight, contact shadow, long drop), or `--paper-drop` plus `--paper-top` when masked (a punched tag, a perforated receipt). Paper appears once per viewport, as the focal point.
  - Floating layers use `shadow-float`. Nothing else casts a shadow.
- **The hero laptop** (`Laptop.tsx`, `device.module.css`): built in CSS 3D, every length in em of the stage (1em = 1/80 of its width). The lid is 64 x 43em, so the screen is 1.53:1 as on a real laptop, opened 10° past upright; the deck is the lid's width and 41em deep, the keyboard 19.8em and the trackpad 13.4em of it. A long lens and a shallow turn (perspective 420em from 50% 38%, `--rx` -10°, `--ry` 6°) keep the deck's front edge within 1.1x of the lid's width, so the keyboard never looks longer than the screen, and its front corner inside the page frame from 1024 to 1440px. A soft contact shadow (`.deck::before`) sets it on the table in both themes. The receipt overlaps the deck's front-left corner, never the trackpad. In dark the deck sits about 0.2 L above the page (0.36 at the hinge to 0.31 at the front) and a cool 1px rim light (`--rim`) runs along its front edge, the lip and the hinge, so the lower half reads as metal, not a smudge; the trackpad is a lighter inset. In light the deck is silver, lighter at the back (0.9 to 0.84), with mid-grey keys (`--key` 0.56, so the keyboard is texture, not the strongest contrast on the right) and a white rim on the front lip. The lip (the deck's thickness) runs between the rounded front corners and rounds off toward the table, so deck and edge read as one piece. The table's grid is 9% and 4.5% ink in dark, and its pool is a little stronger than the page-wide one (`--hero-pool`, brass at 19%). No callout floats beside the laptop: annotations stay on the screen (the marked code), so the object stays real and the copy column's gutter stays clean.
- **The light table (the signature):** one warm pool of light (`--table-glow`, a closest-side radial of `--pool`) under the paper object that leads the screen. It sits under all content, never moves, never overflows its section, and there is at most one per section and per viewport: on the hero's table, painted in the table's own perspective under the laptop and the receipt (the table's centimetre grid, 2.4em lines with a stronger line every 5cm, ends in a soft ellipse just past the laptop and the receipt; in light only the 5cm lines show, at 7% ink, because a 1cm mesh at that contrast reads as noise), and under the paid receipt in the Chain of Custody, where it comes on with the PAID · SANDBOX stamp. None in the console, none behind a heading, no cones or beams.
- **Grain** (homepage and claim flow, not the console): `.grain` on the layout root adds a fixed 160px `feTurbulence` noise tile at 3.5%, with no blend mode so scrolling never repaints the viewport.

## Motion

- **Scrolling:** the homepage wheel is inertial (Lenis, `SmoothScroll.tsx`, lerp 0.1), off under reduced motion; keyboard, anchors, the skip link, touch and find-in-page stay native, and inner scrollers keep their wheel.
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
  2. **Scrub:** the one pinned Chain of Custody sequence. Its moves are written against its own timeline p; `custody/pace.ts` maps the scroll onto p so each beat gets its own share (16vh at rest, 64 for the dolly, 80 each for chapters 01 and 02, the Opened Exhibit's 520vh for chapters 03 to 05 at 70 to 85vh a beat, 60 for the console: 820vh of scroll in all, plus the stage). The phone version gives chapters 01 and 02 72vh each. Chapters 03 to 05 render inside `ExhibitSlot.tsx` as one layer (`custody/timeline.ts`, unit-tested): its page goes opaque on its first frame and its content fades in (a cut, never the rail showing through), it carries the pin's skip link in its own foot, its eyebrow names the chapter (03 / 06 · Live photo, 04 / 06 · Five checks, 05 / 06 · Paid) and its checks number under 04 (04.1 to 04.5); it leaves by dissolving onto the console, chapter 06, which is already in place under it, so no frame is ever empty. The rail is the sequence's one counter: the claim screens' bar keeps its step meter but shows no number. Each check's callout holds through the hand-off until the next cuts in (over 5% of its beat), and the stills dissolve over 3% of a beat, so no scroll stop lands on a blank column or on stills half-drawn over each other. The phone's sequence has no console beat and counts to 05.
  3. **Ink:** things drawn by a pen. The highlighter (`background-size` 0 to 100%, 700ms), leader lines and strings (`pathLength` 0 to 1, 600ms `--ease-out-quart`), stamps (`.stamp-land`: scale 1.4 to 1 and fade in, 200ms `--ease-back`; the tilt never moves).
  4. **Drop:** paper objects settling, with `SPRING.drop` and a 2° rotation settle.
- **The hero moment:** the device sits in a slight 3D tilt on the light table (CSS perspective; up to 4° extra tilt following the pointer on desktop). Once it's in view, the five checks (in the order of "What stops a fake") tick in one after another, 450ms apart, then the payout chip lands with the time. Below a 640px stage the screen shows the camera alone and the checks tick in a full-size card under the laptop. It plays once, and replays on a "Replay" control.
- **Resting state:** always the final one. No JS, reduced motion, or a screenshot all show the full page; CSS entrances run only under `prefers-reduced-motion: no-preference`.
- `prefers-reduced-motion`: no tilt, no pin, no blur, no flash, no spring; final states render immediately.

## Components

**Buttons** (`<Button variant size>`): rectangular, never pills (pills are verdicts).
- Sizes: `sm` 36px (radius 8, 14px padding, a 44px hit area), `md` 44px (radius 8, 18px), `lg` 48px (radius 10, 24px, -0.005em tracking).
- Primary: brass fill, `--accent-ink` text. Hover steps the fill (`--accent-hover`: lighter in dark, deeper in light) and, in dark only, a sheen comes up from the top edge (`--btn-sheen`, white at 22%, a radial from the top centre, behind the label), 240ms in and 160ms out on `--ease-out-quart`. Light has no sheen: it cancelled out the deeper fill, so hover showed nothing. Press deepens to `--accent-press`, sinks (an inset shadow in place of the drop) and scales to 98% (96% at 36px), in 75ms.
- Secondary, the quiet button: the raised key above. Hover lifts it: `--surface-3` and a brighter ring in dark; in light a `--surface-2` tint, a darker ring (ink at 44%) and a longer drop. Press (`--btn-quiet-bg-press`) scales and sinks below rest, so it shows on touch, where there is no hover: `--surface` with an inset shade in dark, `--surface-3` in light.
- Tertiary: 6px of side padding cancelled by a negative margin, so the focus ring has room around the words; focus also underlines it and moves the arrow, as hover does.
- Tertiary: a text link with an arrow.
- Colour, background, shadow, scale and opacity ease over 160ms `--ease-snap`; under reduced motion they snap.
- Focus is a 2px ring 3px off the button in `--focus`: brass in dark, ink (`--text`) in light, where brass is under 2:1 on the page, a card and a brass button; ink clears 3:1 on all of them (`scripts/contrast.ts` checks the ring on every surface and around the primary button, and every label on rest, hover, hover plus sheen and press). On paper it is `--ink`. Disabled drops to 40% opacity with no hover.
- Touch targets are at least 44px. `/dev/ui` (dev only) shows every variant, size and state.

**Nav link** (`.nav-link`, in `globals.css`): muted 14px text that lifts onto a 32px `--surface-2` chip (radius 8, 10px side padding) in `--text` on hover and keyboard focus, 120ms in and 200ms out; in light the chip also gets an inset `--line-2` hairline (`--nav-chip-ring`), since `--surface-2` alone is 1.06:1 on the page; `::after` keeps the hit area 44px tall. In a row: 4px apart, the row pulled 10px left so the first label, not its chip, sits on the grid line. An exhibit letter in a link is `<NavCode>`: on pointer enter it runs through 4 random characters of the claim-code alphabet, 40ms apart, and lands back on its letter (160ms), in `--text`, never amber. It is decorative (`aria-hidden`, so the link's name never changes), lands at once on press, and stays still for keyboard focus and under reduced motion.

**Inputs:** a 1px line border, the focus ring as above, the label above the field, help text below in `--muted`, and errors in `--stop` with a fix.

**Status pill:** 22px tall, 12px Schibsted 500: a dot, then a word ("Paid", "Held", "Rejected", "Blocked"), in the state's soft background and text colour. In progress is neutral (`--surface-2`, `--text-2`, a hollow `--faint` dot): it repeats down a list, so it is never amber.

**Exhibit label:** mono, micro size, `--faint` text with a `--line-2` hairline leader to what it annotates. On paper it uses `--ink-muted`.

**Paper** (`<Paper variant="tag|sheet|receipt|notice">`): `--paper` and `--ink`, radius 6, ring plus `--paper-shadow`. A tag has its top corners cut; a notice is `--paper-2` with the flat shadow, for a document lying on the paper band. Options: `hole` (a 10px punched hole with a reinforcement ring, 14px from the top edge), `perforated` (a torn top edge), `tilt` (-1.5° to 2°). The hole and the perforation are real cut-outs: the surface behind shows through.

**Stamp** (`<Stamp tone="pay|hold|stop|neutral">PAID</Stamp>`): 2px border, radius 6, 14px JetBrains Mono 500, +0.14em tracking, the tone's ink at 85%, rotated -8°. Decorative (`aria-hidden`): the status is always also in text. Never bigger than 14px type, never textured, one colour. `land` plays the landing once on mount.

**The mark:** a claim check, one tag torn in two (`RemedyMark` in `ui/Wordmark.tsx`): the tag stays on the destroyed product as the proof, the brass stub is the refund the owner keeps. The stub is `--accent` in both themes, the button's own brass, so a page shows one amber: on the dark room it sits beside a `--paper` tag; in light the tag is `--ink-muted` and the stub carries the button's 1px `--accent-edge` rim, which clears 3:1 on the page where brass alone does not. The favicon (`icon.svg`), `apple-icon.png` and the link card (`opengraph-image.tsx`) draw it on the dark tile in the dark brass, #ebb75b.

**Theme toggle:** a 36px framed icon button (a `--line-2` hairline border at rest, so on a phone it reads as a button and forced colours keeps it; `--surface-2` on hover, `--surface-3` and 96% on press) with a 44px hit area and an `aria-label`; the glyph is a half-lit disc that turns over with the theme. It stores "dark" or "light", so a choice outlasts the system preference. The homepage nav has one too, and so does the company sign-in, beside its "← Back to Remedy".

**Skip links** (`SkipLink`): the first Tab stop on every page is "Skip to content" (to `#main`), and on the claims queue a second, "Skip to claims", lands on the open claim's row or the first. Hidden until focused, then a `--surface-2` chip lying over the wordmark with the focus ring.

**Evidence panel** (the console's; one component, `EvidencePanel` in `EvidenceDrawer.tsx`):
1. the photos, numbered Photo 1, 2, 3 as the camera's slots are, uncropped, which open in the photo viewer (every photo side by side at full size, the claim id and what held it on top, ← → between photos, Esc back, approve and reject in reach); on a held claim "Tag must read K7P" in mono sits beside them and in the viewer's header; a blocked repost shows its photo beside the earlier claim's, whose id opens that row;
2. each check with its outcome icon, the model's quoted evidence in mono, and the pre-checks;
3. the rule's decision in one sentence;
4. actions (Approve needs a second press to pay: Pay, or A again; A and R open the same confirm; reject offers one-click reasons). The box on top always names the current blocker (PayPal not taking the payout, a conflict the checks found on approve, a reviewer's quoted reason). After a decision the footer says it was saved and offers the next held claim.

It docks 440px wide beside the grid from 1280px, opens as a sheet over the grid from 1024px, and fills the screen on phones. Esc closes it and returns focus to the row; moving through the grid's rows with ↑ and ↓ moves it with them.

**AG Grid:**
- Theming API (`themeQuartz.withParams`) mapped to the tokens above: the window body `--surface`, the header `--surface-2` in 12px mono, the open row `--surface` + `--accent-soft` with a 2px amber edge. The keyboard's row gets the same tint and edge across the row (never a ring on one cell); a card row gets the amber ring.
- Header 36px, rows 52px (two-line cells), font `ui` and mono for IDs and amounts.
- Evidence cells: photo thumbnails, the decision pill with its reason, an evidence barcode (one bar per check: pre-checks, then the model's), payout status, and a timeline chip.
- No zebra stripes; hairline row borders.
- Below 720px of grid width each claim is one card row (72px). The homepage's read-only still keeps its columns down to 592px.

## Screens

**Homepage**, as shipped (`src/app/(marketing)/page.tsx`), dark by default and following the theme toggle:
1. Nav on the page frame: wordmark, How it works, then the exhibits by letter (A Problem, B Checks, C Proof, D For companies) as nav links with their `NavCode` letter, the theme toggle, "Company sign in" as a nav link, and **Try a claim** as the quiet button. No rule under it, on a solid `--bg` (a translucent blur turned grey-brown over the paper band).
2. Hero, which is also "How it works": the 56px two-tone headline ("Proof it's destroyed." then "Paid in a minute." in `--muted`, one voice), the lead, **Try a claim with sample photos** (the screen's one amber, the owner path the copy speaks to) and "For companies: run a recall →" as the labelled, quieter text link to the company sign-in, the sandbox-account note, and a row of three checkable facts (15 s photo to payout on RM-0442, 5 checks, 36 claims tested). The laptop with the live claim screen sits on the light table from column 7, the refund receipt in front of it on the pool, and no floating callouts. On its screen the marked code region is drawn in `--text` at 70%, not amber: the CTA beside it is the viewport's one amber. Then the Chain of Custody: one real claim in five chapters (Log in with PayPal, One-time code, Live photo, Five checks, Paid), then the console as chapter 06 (Kikea Store sees it). The claim screens sit top-aligned under their app bar, as a page loads; in them the claim page's own "Log in with PayPal" is drawn as a wireframe (dashed hairline, faint), never as a button. It is the one pinned sequence on laptops of at least 1024×700 with motion allowed, a sticky phone on smaller screens (the product above the fold, the facts after it), and static figures without JS or under reduced motion. The Paid chapter is a perforated receipt: $29.99 at display size rolling up, the PAID · SANDBOX stamp, and the pool coming on with it.
3. Exhibit A, the problem, on the paper band: the two stats on the heading's grid lines, the CPSC notice and request for information as documents, numbered sources.
4. Exhibit B, what stops a fake: the five gates in columns 1 to 6, each marked No AI or Model reads, the four sample lanes in 7 to 12, and "Try the four samples yourself".
5. Exhibit C, proof: 0 web photos paid at display size, three supporting figures on column 8, the eval table from `docs/EVAL.md`.
6. Exhibit D, for companies: the real read-only claims grid (`ClaimsGridPreview`) on the 40 seeded sample claims, loaded one viewport ahead; the static `ConsoleReplica` stands in until it loads and without JS, and the grid takes its place only once it has drawn and while the frame is out of view, so it never blanks or changes in front of a reader. It is a product shot: inert (no clicks, no tab stops) and marked Preview in its chrome. Both are labelled SAMPLE DATA, with "Sample / not sent" payouts and AI-made photo labels, and a caption under the frame says why its ledger reads $0.00 paid while RM-0442 above was paid in sandbox. In the Chain of Custody's console beat, sample rows carry a SAMPLE badge and their amounts say "Not sent". Then Log in with PayPal as a quiet button: companies always get the labelled secondary, owners the amber.
7. Footer: the "Run a claim yourself." tag hanging on its string across columns 2 to 11 (amber "Try a claim with sample photos", then "For companies: run a recall →" in ink), then the sitemap, sources and disclaimer.

**Claim flow:** one step per screen on the graphite background, following Stripe Identity; focus moves to each step's heading:
- **Consent screen:** the 56px refund (40px on phones) and the hazard banner above the fold, the company and Remedy side by side, the numbered steps, then one full-width primary button. The demo (`/try`) swaps the steps for the four sample claims (thumbnail and expected outcome; in the judges' rail from 1200px), puts the judges' sandbox login right above the button (framed first, in neutral text, as a test account in PayPal's sandbox and not a real PayPal login; its Copy buttons are text-style, never raised keys that compete with the action; first in Tab order), and adds a judges' rail (280px at 1440; below 1200px a "For judges" quiet button, `sm`, in the header, where the wordmark shows only its mark below 360px). The header's SANDBOX DEMO is a status, so it has a status's shape: a `--surface-2` pill with a hollow dot and no border, never a button's.
- **Code step:** the paper tag with the one-time code, a timer pill, and the phone QR leading on laptops. Demo claims skip it: their sample's photo step names the code.
- **Step meter:** centred on the step's own column, so its edges always sit on the content's: 640px for the camera and the samples, 960px for the checks, 480px for a result and the code card (880px from 1024px). On the recall screen it spans the brief and the card.
- **Camera step:** a full-width viewfinder with the shutter on the first phone screen, the Space key as shutter on laptops. The guide chips ("Must show") sit in the instruction bar under the frame, never over the tag, and help opens over the feed, so the frame never moves while aiming.
- **Checking:** Photo 1, shown whole (never cropped: it's what is being checked), with every photo sent numbered under it, beside a five-stage timeline that fills with the model's quotes.
- **Result:** paper. Paid is a perforated receipt with the 56px amount, a PAID stamp and the live PayPal status ("Paid N s after your photo", then "Received"; the receipt asks every 5 s for 30 s, then every 15 s, for 2 minutes at most, never while the tab is hidden, and stops on a settled status, rather than the spec's 4 s for 3 minutes, to stay inside the Blob budget); in a sandbox build the stamp reads PAID · SANDBOX and the line says sandbox money, sample or not; held and refused are a sheet with the evidence, the stamp and, when refused, the one failing check in red. A refused repost puts this claim's photo beside the earlier claim's matching one, each with its photo number and its own claim id; another account's claim shows neither its photo nor its id. Photos are numbered everywhere (Photo 1, 2, 3, as the camera's slots are): letters belong to the judges' samples, A to D. A claim's times are UTC and say so ("7 Nov 2026, 14:32 UTC"), on the receipt as in the console, so both name a moment the same way; only a limit's reset is in the viewer's own time. Counts of checks are always the homepage's five ("5 of 5 checks passed", "1 of 5 failed: the code · 4 passed"), with the model's answers listed under checks 4 and 5 (`src/lib/fiveChecks.ts`), here and in the console's barcode.

**Console:** from 1024px the queue fills the viewport: the recall's ledger (remedied of sold with a meter, paid out, held, refused), status tabs (All, Paid, Held, Rejected, Blocked, In progress) with search, the claims grid, and the evidence panel docked on the right. It polls for new claims every 8s only while the queue can still change (a claim filed in the last 12.5 minutes still pending, a payout settling in its first half hour, or a demo claim from the last 10 minutes), only while the tab is visible and for 10 minutes per view, flashing the cells that change; a new claim shows within about 8 to 12 s. An abandoned claim or a payout parked at UNCLAIMED never keeps it polling. With a row open, the evidence panel docks from under the ledger to the foot of the window, beside the tabs, search, grid and footer (which stay in reach), and leads with what decided the claim. New claims never push the rows being worked: while the pointer or keyboard is in the grid, or a claim is open, they wait behind a "1 new claim · Show" bar. The tab, search and open claim live in the URL (`?tab=held&q=…&claim=RM-1460`). Phones get card rows and no horizontal scroll.

**Insights** (AG Studio): Tab goes from panel to panel, each one stop named for its exhibit ("Decisions, Exhibit B") with the focus ring on its card and an "Enter to explore" key chip; Enter goes into its controls, ↑ ↓ (and Home, End) move between a list's items, and Esc comes back ("↑ ↓ move · Esc back to panels"). KPI tiles have nothing to operate, so they are read, not visited, and Studio's editor overlays stay out of the accessibility tree. A pick (a funnel drop, a decision, a refusal reason, a day) filters the whole page, so a quiet bar above the canvas always says what the page shows ("Showing Rejected by a person on review · 7 of 199 claims", Clear filter) and the tiles' captions describe the picked claims; with nothing picked it says how to pick. Timings are medians, the same number as the Claims ledger, in its "0:03" / "1h 06m" form, and the tile says how many payouts waited for a person; Exhibit E charts that same median by day ("4 Nov", a seconds axis). A panel's downloads ("Export CSV", "Save image") sit inside its card on the title's line, named in words. No card cuts off a row.

## States

Every data view ships all five: empty, loading (skeletons shaped like the content), error (what went wrong and what to do), partial, and success. The money path never silently fails: if PayPal or the model is down, the claim is held and the owner is told so.

## The gate

A screen is done only when it passes the anti-slop gate in the `design` skill:
- grayscale and squint tests;
- spacing on the 4px scale;
- at most 6 sizes and 3 weights;
- real copy;
- all five states;
- works at 375px;
- AA contrast;
- a real dark palette (warm graphite at chroma 0.004, not navy);
- one amber focal element per viewport;
- and it looks like the references, not a template.
