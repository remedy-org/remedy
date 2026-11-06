# Remedy design system: "Evidence Room"

Approved 7 Nov 2026 from three explored directions (variant B). It will be refined as we build; changes land here first, then in code. `docs/PRODUCT.md` owns what exists; this file owns how it looks and moves.

## Brief

**The feeling:** an evidence room that runs on trust. Forensic precision, calm, serious enough for a child-safety recall, and premium enough to sell to a company.

| Surface | Archetype | Density | Motion budget |
|---|---|---|---|
| Homepage | Marketing, product-first hero | Roomy | One orchestrated hero moment, quiet scroll reveals |
| Claim flow | Guided verification (Stripe Identity patterns) | Roomy, one action per screen | State changes only |
| Seller console | Data, calm density (AG Grid) | Tight | Near zero |

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

**Never:** a pinned full-screen hero that shows an empty screen, a fade-in from black, gradient or acid brand colours, illustration carousels, walls of logos and video tiles, emoji, lorem ipsum, or PayPal's logo (we name PayPal in plain text only).

## Type

- **Instrument Sans** for headings and body, loaded with `next/font/google`. It is not the create-next-app default, so it doesn't read as a template.
- **IBM Plex Mono** for evidence: codes (`K7M`), claim IDs, payer IDs, amounts in grids, timestamps and exhibit labels.
- **Weights:** 400 for body, 500 for UI labels, 600 for headings. Nothing heavier.

| Token | Size / line height | Use |
|---|---|---|
| `display` | clamp(40px, 5.2vw, 72px) / 1.02, letter-spacing -0.025em | Homepage hero only |
| `h1` | 44 / 1.08, -0.02em | Section titles on the homepage |
| `h2` | 28 / 1.15, -0.015em | Screen titles in the app |
| `lead` | 20 / 1.5 | Hero and section intros |
| `body` | 16 / 1.6 | Running text, at most 68ch wide |
| `ui` | 14 / 1.45 | Controls, grid cells, labels |
| `micro` | 12 / 1.4, +0.06em, uppercase in mono | Exhibit labels, eyebrows |

Use tabular numbers everywhere digits line up.

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
| `--pay` | `oklch(0.78 0.16 150)` | `oklch(0.52 0.14 150)` | Paid, check passed |
| `--hold` | `oklch(0.76 0.10 240)` | `oklch(0.52 0.12 250)` | Held for a person |
| `--stop` | `oklch(0.70 0.17 25)` | `oklch(0.55 0.19 27)` | Rejected, blocked |

**Rules:**
- Each state colour has a soft background at 14% alpha and its text colour. State is never shown by colour alone: it always has a word and an icon.
- Held is blue, not amber, so it never reads as the brand.
- Body text meets 4.5:1 and UI borders 3:1 in both themes.

## Space, radius, depth

- **Spacing:** a 4px base. Use 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 (homepage section padding: 128 desktop, 72 mobile).
- **Widths:** content max 1200px; reading columns 68ch; claim flow 480px for the main card.
- **Radius:**
  - 6px for buttons, inputs and chips;
  - 10px for cards and drawers;
  - 16px for device frames;
  - 999px for status pills only.
- **Depth:** 1px hairline borders do the structural work. Floating layers (menus, drawer, toasts) get a ring (`0 0 0 1px var(--line)`) plus one soft shadow. No other shadows.

## Motion

- **Micro-interactions:** 160ms ease-out (`cubic-bezier(0.2, 0.8, 0.2, 1)`), transform and opacity only.
- **Larger transitions:** up to 360ms.
- **Library:** Motion (`motion/react`), only where CSS can't do it.
- **The hero moment:** the device sits in a slight 3D tilt on the light table (CSS perspective; up to 4° extra tilt following the pointer on desktop). Once it's in view, the five checks (in the order of "What stops a fake") tick in one after another, 450ms apart, then the payout chip lands with the time. Below a 640px stage the screen shows the camera alone and the checks tick in a full-size card under the laptop. It plays once, and replays on a "Replay" control.
- **Scroll reveals:** sections fade in and rise 8px when they enter. The resting state is always visible: no JS, reduced motion, or a screenshot all show the full page.
- `prefers-reduced-motion`: no tilt, no sequence; the final state shows immediately.

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

**Exhibit label:** mono, micro size, amber text with a hairline leader line to what it annotates.

**Evidence drawer:**
1. the photo, which opens full size;
2. each check with its outcome icon, the model's quoted evidence in mono, and the pre-checks;
3. the rule's decision in one sentence;
4. actions.

**AG Grid:**
- Theming API (`themeQuartz.withParams`) mapped to the tokens above.
- Header 40px, rows 44px, font `ui` and mono for IDs and amounts.
- No zebra stripes; hairline row borders; the selected row tinted `--accent` at 10%.

## Screens

**Homepage**, in the section order from the approved mockup:
1. Nav: wordmark, How it works, Proof, For companies, Sign in, and **Start a recall**.
2. Hero: a two-tone headline, the lead, **Start a recall** and "Try a claim with sample photos →" (with a faint line that the demo needs a PayPal sandbox personal account), and the device on the light table.
3. The problem: 6–10% of recalled products come back, and real notices still say "email a photo to a @gmail.com inbox".
4. How it works, in four steps.
5. What stops a fake: the five checks in order.
6. Proof: the eval table from `docs/EVAL.md`.
7. For companies: Log in with PayPal.
8. Footer.

**Claim flow:** one card per step on the graphite background, following Stripe Identity:
- **Consent screen:** the company name and Remedy side by side, three bullets (what you'll do, what we see, when you're paid), then one full-width primary button.
- **Camera step:** one instruction line under the frame.
- **Result:** a Checkout-style receipt: the large amount, hairline rows and the payout status.

**Console:** the claims grid fills the page, with a header of four numbers (remedied of sold with a meter, paid out, waiting, refused), status tabs (All, Paid, Held, Rejected), and the evidence drawer on the right.

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
- a real dark palette;
- and it looks like the references, not a template.
