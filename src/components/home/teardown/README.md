# Opened Exhibit

Claim RM-0442's evidence in 3D. Each of the five checks opens the physical part it is about, then the fixed rule
pays $29.99 in sandbox money. This is wave 3's judged concept 1, built from the prototype in
`scratchpad/wave3/concepts/opened-exhibit/`.

One export: `OpenedExhibit` from `@/components/home/teardown`.

## Where it mounts, and what it replaces

It goes in chapters 03 to 05 (Live photo, Five checks, Paid) of the pinned Chain of Custody,
`src/components/home/custody/`. There it replaces:

- `PhotoChapter`, `ChecksChapter` and `PaidChapter` in `CustodyStage.tsx` and `chapters.tsx`: the device frames those
  chapters show;
- the 160px serif `$29.99`. The receipt in the Paid beat takes its place.

Chapters 01 and 02 keep the real claim screens, and so does the hero's laptop. That way the product on the page stays
real, and the exhibit is a labelled illustration.

**Driven by the custody pin (the intended mount).** Map the custody progress for chapters 03 to 05 to 0..1 and pass
it in:

```tsx
const exhibitP = useTransform(p, [STARTS[2], STARTS[5]], [0, 1]);
<OpenedExhibit progress={exhibitP} onSeek={(q) => scrollToCustody(STARTS[2] + q * (STARTS[5] - STARTS[2]))} />
```

- It fills its parent and does not pin itself.
- Give that stretch of the custody pin about 500vh. `TOTAL_VH` in `model.ts` is 500: 8 beats at 30 to 95vh each.
  DESIGN.md's pin cap was raised for this.

**On its own.** `<OpenedExhibit />` renders its own pinned section, `TOTAL_VH + 100svh` tall (400vh + 100svh on
phones). It includes a "Skip the exhibit" link, and the check row's buttons jump to each check.

**Preview.** `/dev/teardown` shows it pinned. `/dev/teardown?capture=1` shows one fixed frame for the capture tool.
Both return 404 in production, like `/dev/ui`. The page's wrapper previews DIRECTION.md's Lamplight palette and the
Schibsted Grotesk and JetBrains Mono fonts. The component itself reads only the site's tokens.

## How it works

| File | Job |
|---|---|
| `claim.ts` | Every fact and quote the exhibit shows, with its source |
| `model.ts` | The one input, `p` → `stateAt(p)`: beats, part openness, camera shot, readouts, ticks, receipt. Pure; tested in `model.test.ts` |
| `OpenedExhibit.tsx` | Chooses the form, owns the pin, draws one frame per change of `p`, and writes the DOM overlay (readouts, check row, callout and leader, receipt) |
| `scene/` | three.js, behind a dynamic import: `index.ts` (studio, framing, render), `pillow.ts` (the cut C-shaped pillow, torn edge, stuffing), `parts.ts` (tag and twine, phone and frustum, prints and fingerprints), `textures.ts`, `noise.ts` |
| `public/teardown/*.webp` | 32 pre-rendered stills (8 beats × 2 themes × desktop/phone), 1.4 MB in all, 21 to 75 KB each |

### Forms, chosen after mount

The server always renders the static form.

- **live:** viewports 768px and wider, with motion allowed and WebGL2. The exhibit is pinned, and three.js is imported
  once the stage is within one viewport. The beat's poster shows until the scene has drawn its first frame.
- **poster:** phones under 768px, no WebGL, or a GPU too slow for tier 1. The exhibit is pinned, and the stills cut
  over at each beat with the same DOM callouts.
- **static:** reduced motion and no JS. It is not pinned. It shows the final still (a theme twin is picked in CSS),
  every check with its quote, and the receipt.

### Performance

- three.js never ships in first-load JS. `next build` of `/`:
  - before: 12 scripts, 239.2 KB gz;
  - after: 13 scripts, 240.9 KB gz;
  - the 1.7 KB is Turbopack re-splitting shared motion code, and no exhibit code is in those chunks.
- The lazy chunks are three.js (750 KB raw, 191 KB gz; Turbopack does not tree-shake it) and the scene (22 KB raw,
  8 KB gz).
- A frame is drawn only when `p`, the theme or the size changes. Nothing draws while idle or off-screen.
- Tier 2 caps the pixel ratio at 1.5, uses a 1024 VSM shadow map, and draws two fibre shells.
- Tier 1 drops to a pixel ratio of 1, 512 shadows and one shell. The drop happens:
  - after a start-up benchmark of over 12 ms a frame;
  - or when the median gap between scroll frames is over 28 ms.

  A slow tier 1 falls back to the posters.
- Each frame has 42 draw calls and about 220k triangles, shadow pass included.
- **Measured** on an Apple M5 Pro through ANGLE Metal, scrolling the pin one step per frame for 240 frames:

  | Viewport | Mean frame | p95 | Start-up benchmark |
  |---|---|---|---|
  | 1440×900 | 17.2 ms | 16.9 ms | 2.3 ms a frame |
  | 1920×1080 | 16.9 ms | 17.4 ms | |

  That is display-locked 60 fps.
- With SwiftShader, a CPU renderer that is a floor below any integrated GPU, frames ran about 150 ms. That case is why
  the runtime tier drop exists.
- Integrated-GPU numbers (Iris Xe, M1) are not measured.

### Honesty

- The label "Illustration of claim RM-0442 · its photo is AI-made test data · sandbox money" is on screen in every
  frame and every form.
- The two quotes are the model's stored words on that photo. `claim.ts` gives the run file and the field each one
  comes from.
- The fingerprints are the real dHash values of the demo photos, computed with `src/lib/fingerprint.ts`.
- The clock follows the real 15 s: the pre-checks finish in under a second, the model reads until about 0:14, and the
  payout goes at 0:15.

### Regenerating the stills

Start `next dev`, then run:

```
npx tsx scripts/teardown-capture.ts --base http://127.0.0.1:<port> --posters public/teardown
npx tsx scripts/teardown-capture.ts --base http://127.0.0.1:<port> --at 0,beats --sizes 1440x900,1920x1080 --check
```

`--check` reports every DOM text box with solid scene pixels under it. It must report none.

## Credits

The method (one input, per-part camera, studio look, quality tiers, warmed shaders) comes from the teardown skill,
which is adapted from [whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion) (MIT). three.js 0.186.1
is MIT.
