# Opened Exhibit

Claim RM-0442's evidence in 3D. Each of the five checks opens the physical part it is about, then the fixed rule
pays $29.99. This is wave 3's judged concept 1, built from the prototype in
`scratchpad/wave3/concepts/opened-exhibit/`.

One export: `OpenedExhibit` from `@/components/home/teardown`.

## Where it mounts, and what it replaces

It goes in chapters 03 to 05 (Live photo, Five checks, Paid) of the pinned Chain of Custody,
`src/components/home/custody/`. There it replaces:

- `PhotoChapter`, `ChecksChapter` and `PaidChapter` in `CustodyStage.tsx` and `chapters.tsx`: the device frames those
  chapters show;
- the 160px serif `$29.99`. The receipt in the Paid beat takes its place.

Chapters 01 and 02 keep the real claim screens, and so does the hero's laptop. That way the product on the page stays
real; the exhibit is its evidence, opened.

**Driven by the custody pin (the intended mount).** Map the custody progress for chapters 03 to 05 to 0..1 and pass
it in:

```tsx
const exhibitP = useTransform(p, [STARTS[2], STARTS[5]], [0, 1]);
<OpenedExhibit progress={exhibitP} onSeek={(q) => scrollToCustody(STARTS[2] + q * (STARTS[5] - STARTS[2]))} />
```

- It fills its parent and does not pin itself.
- Give that stretch of the custody pin `TOTAL_VH` (500vh in `model.ts`): 7 beats at 70 to 80vh each, none under
  DESIGN.md's 70vh floor, the camera moving at an even pace through every hold. It ends on the paid pose; the pin cuts to the console from there.

**On its own.** `<OpenedExhibit />` renders its own pinned section, `TOTAL_VH + 100svh` tall (400vh + 100svh on
phones). It includes a "Skip the five checks" link, and the check row's buttons jump to each check.

**Preview.** `/dev/teardown` shows it pinned. `/dev/teardown?capture=1` shows one fixed frame for the capture tool.
Both return 404 in production, like `/dev/ui`. The page's wrapper previews DIRECTION.md's Lamplight palette and the
Schibsted Grotesk and JetBrains Mono fonts. The component itself reads only the site's tokens.

## How it works

| File | Job |
|---|---|
| `claim.ts` | Every fact and quote the exhibit shows, with its source |
| `model.ts` | The one input, `p` → `stateAt(p)`: beats, part openness, camera shot, readouts, ticks, receipt. Pure; tested in `model.test.ts` |
| `scan.ts` | Check 1's scan line: where it is on the clock, and the photo's projective map that lays it on the phone's tilted screen. Pure; tested in `scan.test.ts` |
| `OpenedExhibit.tsx` | Chooses the form, owns the pin, draws one frame per change of `p`, and writes the DOM overlay (readouts, check row, callout and leader, receipt) |
| `scene/` | three.js, behind a dynamic import: `index.ts` (studio, framing, render), `pillow.ts` (the cut C-shaped pillow in slate blue-grey, torn edge, stuffing), `parts.ts` (tag and twine, the phone with the photo on its screen and that photo's corners for the scan line, prints and fingerprints), `textures.ts`, `noise.ts` |
| `public/teardown/*.webp` | 28 pre-rendered stills (7 beats × 2 themes × desktop/phone), 1.2 MB in all. The phone stills of the whole pillow are framed tight, so the object fills about 85% of a 375px screen |

### Forms, chosen after mount

The server always renders the static form.

- **live:** viewports 768px and wider, with motion allowed and WebGL2. The exhibit is pinned, and three.js is imported
  once the stage is within one viewport. The beat's poster shows until the scene has drawn its first frame.
- **poster:** phones under 768px, no WebGL, or a GPU too slow for tier 1. The exhibit is pinned, and the stills cut
  over at each beat with the same DOM callouts.
- **static:** reduced motion and no JS. It is not pinned. It shows the paid still (the halves parted; a theme twin is
  picked in CSS) with the receipt lying on its lower right, and every check with its quote beside them.

### Performance

- three.js never ships in first-load JS. `next build` of `/`:
  - before: 12 scripts, 239.2 KB gz;
  - after: 13 scripts, 240.9 KB gz;
  - the 1.7 KB is Turbopack re-splitting shared motion code, and no exhibit code is in those chunks.
- The lazy chunks are three.js (750 KB raw, 191 KB gz; Turbopack does not tree-shake it) and the scene (22 KB raw,
  8 KB gz).
- A frame is drawn only when `p`, the theme or the size changes. Nothing draws while idle or off-screen, but check 1's
  scan line: while the phone is up, a white 1.5px line with a soft glow trailing above it sweeps down the photo on its
  screen (1.9 s, then a 0.45 s pause), on a clock, so a reader resting on the live check sees it working. It is an SVG
  over the canvas, laid on the photo's four projected corners (the scene returns them with each frame) through their
  projective map, so it stays crisp and clipped to the photo however small and tilted the phone is, and only its few
  attributes are written each frame; the scene is not redrawn. It starts at the photo's top as the phone comes up and
  is drawn in the same frame as the scene, so it never trails the phone while the camera moves. The stills and the
  capture tool's frames leave it out.
- Tier 2 caps the pixel ratio at 1.5, uses a 1024 VSM shadow map, and draws two fibre shells.
- Tier 1 drops to a pixel ratio of 1, 512 shadows and one shell. The drop happens:
  - after a start-up benchmark of over 12 ms a frame. The benchmark ends on a 1px `readPixels`, which blocks until the
    GPU has drawn every frame (`gl.finish()` does not block in Chrome, so it timed only the JS);
  - or when, over 8 drawn frames, the median time from a draw to the browser's next frame is over 28 ms, so a weak
    GPU falls back within one beat (`watch.ts`). The gap between two draws is not a measure: draws follow `p`, and a
    wheel easing to a stop moves it a pixel every 30 to 80 ms, which once sent fast GPUs to the posters.

  Software renderers (SwiftShader, llvmpipe, Microsoft Basic Render) go straight to the posters. The scene is built in
  slices with the main thread given back between them (the fabric textures in 32-row slices, then each half, the
  parts and the shader compile), because it arms mid-scroll, during chapter 02.

  A slow tier 1 falls back to the posters, and the canvas is removed with the scene, so its last frame never sits over
  the current beat's still.
- Each frame has 42 draw calls and about 220k triangles, shadow pass included.
- **Measured** on an Apple M5 Pro through ANGLE Metal, scrolling the pin one step per frame for 240 frames:

  | Viewport | Mean frame | p95 | Start-up benchmark |
  |---|---|---|---|
  | 1440×900 | 17.2 ms | 16.9 ms | 3.4 ms a frame (5.5 ms with the CPU throttled 4x), timed to a pixel readback |
  | 1920×1080 | 16.9 ms | 17.4 ms | |

  That is display-locked 60 fps. Scrolling from chapter 02 into the exhibit while the scene builds (production build,
  1440×900, 240 steps): mean 17.0 ms, p95 18.6 ms; with the CPU throttled 4x the longest gap is 121 ms (it was 233 ms
  before the build was sliced).
- SwiftShader, a CPU renderer that is a floor below any integrated GPU, is detected by its renderer string and gets the
  posters without loading three.js (frames then hold 16.6 ms mean).
- Integrated-GPU numbers (Iris Xe, M1) are not measured.

### Honesty

- No label on the exhibit (owner rule: no internal labels on the site). The photo is generated (docs/EVAL.md), and
  the sandbox payout is stated once, in /terms.
- The two quotes are the model's stored words on that photo. `claim.ts` gives the run file and the field each one
  comes from.
- The fingerprints are the real dHash values of the demo photos, computed with `src/lib/fingerprint.ts`.
- The clock follows the claim's one timeline, the console's, to the tenth: the three pre-checks are done by 0:00.3 (a
  tenth each as they tick), the model reads until it answers at 0:11.3 and the rule approves it then, the payout is
  sent at 0:15.0 as the receipt feeds out ("Sent to PayPal 15 s after the photo"), and PayPal confirms it at 0:55.0:
  only then does the payout read Paid, the receipt print its PayPal confirmed line and the PAID stamp land
  (`custody/claim.test.ts` holds the times to the dataset's events).

### Pacing

- Each beat's shot is a camera key at 22% of the beat, pushed in 6% by 88% (`ARRIVE` and `DEPART` in `model.ts`). The
  moves onto and off the tag macro change the framing most, so they get more scroll: the camera leaves acct and code at
  80% and arrives on code and the cut at 36%. Between keys the camera eases on DESIGN.md's
  state-to-state curve, `cubic-bezier(0.65, 0, 0.35, 1)` (`inOutCubic` in `model.ts`), so its peak speed is 1.5x the
  average. A move between distant subjects also pulls back mid-way (`PULL` 0.5 m of half-width per metre the aim travels,
  at most `PULL_MAX` 0.45 m past the wider shot; `PULL_ZOOM` adds more for a big change of zoom) and aims at the
  middle of both subjects, so a stop mid-move shows both whole.
- A part opens as the camera arrives and closes over the last 12% of its beat; its leader draws on over the tenth of
  the beat before the camera arrives and fades (never retracts) over 6% as the camera leaves. The callout is up or
  down, eased in time by CSS, never scrubbed. The paid beat's halves part and stay parted to the end.
- In the custody pin the exhibit comes and goes as one opaque layer, cut in time (`custody/gate.ts`) like the claim
  screens: the outgoing layer leaves in 180ms and the incoming one rises in over 360ms, 140ms later. Out onto the
  console its receipt (`data-receipt`, exported as `Receipt`) stays: `custody/arrival.ts` folds it into RM-0442's row
  and glides it into the console.
- The live canvas replaces the beat's still in one frame once warm, so the stage never shows the ground alone.

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
