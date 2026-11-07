// Every texture is drawn in code at load: the fabric's brushed cotton, the paper's fibres, the marker lettering on the
// tag, and the soft contact shadows. Nothing is downloaded but the two claim photos.
import type * as T from "three";
import { rng } from "./noise";

type Three = typeof T;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  return { c, g };
}

/**
 * Gives the main thread back between slices of work: the scene is built while the visitor scrolls (it arms during
 * chapter 02), so no slice may be a long task. Idle time when the browser offers it, else the next macrotask.
 */
export function yieldToMain() {
  return new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: 60 });
    else setTimeout(resolve, 0);
  });
}

/** Rows per slice for the n x n loops below: about 4 ms each on a throttled laptop. */
const SLICE = 32;

/** Tileable value noise on an n x n texture: lattice of `cells` per side, wrapped, so the texture repeats seamlessly. */
async function tileNoise(n: number, cells: number, seed: number) {
  const r = rng(seed);
  const lat = Float32Array.from({ length: cells * cells }, () => r());
  const out = new Float32Array(n * n);
  const s = (t: number) => t * t * (3 - 2 * t);
  const at = (i: number, j: number) => lat[((j + cells) % cells) * cells + ((i + cells) % cells)];
  for (let y = 0; y < n; y++) {
    if (y && y % SLICE === 0) await yieldToMain();
    const fy = (y / n) * cells;
    const y0 = Math.floor(fy);
    const ty = s(fy - y0);
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * cells;
      const x0 = Math.floor(fx);
      const tx = s(fx - x0);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      out[y * n + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/**
 * Brushed cotton, plain navy like the photo (no print): colour with faint large mottling, and a normal map of fine,
 * irregular fibre noise with a slight grain along the weft. No regular ribs. Built in slices (see yieldToMain).
 */
export async function fabricTextures(THREE: Three, base: [number, number, number]) {
  const n = 512;
  const mottle = await tileNoise(n, 6, 11);
  const f1 = await tileNoise(n, 96, 12);
  const f2 = await tileNoise(n, 192, 13);
  const grain = await tileNoise(n, 256, 14);
  const height = new Float32Array(n * n);
  const col = canvas(n, n);
  const img = col.g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    if (y && y % (SLICE * 2) === 0) await yieldToMain();
    for (let x = 0; x < n; x++) {
      // Fibre height: two octaves of fine noise, plus a grain stretched along x (the weft), from a shifted lookup.
      const i = y * n + x;
      const g = grain[y * n + ((x * 3) % n)];
      const h = f1[i] * 0.45 + f2[i] * 0.35 + g * 0.2;
      height[i] = h;
      const k = 0.9 + (mottle[i] - 0.5) * 0.12 + (h - 0.5) * 0.14;
      img.data[i * 4] = base[0] * k;
      img.data[i * 4 + 1] = base[1] * k;
      img.data[i * 4 + 2] = base[2] * k;
      img.data[i * 4 + 3] = 255;
    }
  }
  col.g.putImageData(img, 0, 0);
  await yieldToMain();
  const nrm = canvas(n, n);
  const nimg = nrm.g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    if (y && y % (SLICE * 2) === 0) await yieldToMain();
    for (let x = 0; x < n; x++) {
      const dx = height[y * n + ((x + 1) % n)] - height[y * n + ((x - 1 + n) % n)];
      const dy = height[((y + 1) % n) * n + x] - height[((y - 1 + n) % n) * n + x];
      const i = (y * n + x) * 4;
      nimg.data[i] = 128 - dx * 160;
      nimg.data[i + 1] = 128 - dy * 160;
      nimg.data[i + 2] = 255;
      nimg.data[i + 3] = 255;
    }
  }
  nrm.g.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(col.c);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(nrm.c);
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, normalMap };
}

/** Paper with fibres: the cream of the brand's tags (--paper), the same in both themes. */
export function paperCanvas(w: number, h: number, seed: number, paper: string) {
  const { c, g } = canvas(w, h);
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < w * h * 0.003; i++) {
    g.strokeStyle = `rgba(110,92,64,${0.025 + r() * 0.045})`;
    g.lineWidth = 0.6 + r() * 0.8;
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const l = 3 + r() * 9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return { c, g };
}

// Single-stroke capitals for the owner's marker lettering, in a box 1 high (y down), with each glyph's advance.
// Drawn as strokes, not a font, so the tag reads the same on every system.
type Stroke = [number, number][];
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 14): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
const GLYPHS: Record<string, { w: number; s: Stroke[] }> = {
  X: {
    w: 0.66,
    s: [
      [
        [0.02, 0],
        [0.64, 1],
      ],
      [
        [0.62, 0],
        [0.03, 1],
      ],
    ],
  },
  "-": {
    w: 0.4,
    s: [
      [
        [0.04, 0.56],
        [0.36, 0.54],
      ],
    ],
  },
  V: {
    w: 0.68,
    s: [
      [
        [0, 0],
        [0.34, 1],
        [0.68, 0],
      ],
    ],
  },
  E: {
    w: 0.56,
    s: [
      [
        [0.56, 0.01],
        [0.02, 0],
        [0.02, 1],
        [0.56, 0.99],
      ],
      [
        [0.02, 0.5],
        [0.46, 0.49],
      ],
    ],
  },
  S: {
    w: 0.6,
    s: [[...arc(0.3, 0.25, 0.28, 0.24, -0.15, -Math.PI * 1.02), ...arc(0.3, 0.74, 0.29, 0.25, -Math.PI / 2, Math.PI * 0.95)]],
  },
  O: {
    w: 0.72,
    s: [arc(0.36, 0.5, 0.35, 0.5, -Math.PI / 2, Math.PI * 1.52, 28)],
  },
  L: {
    w: 0.52,
    s: [
      [
        [0.03, 0],
        [0.02, 1],
        [0.52, 0.99],
      ],
    ],
  },
  J: {
    w: 0.54,
    s: [[[0.5, 0], [0.5, 0.72], ...arc(0.27, 0.72, 0.23, 0.27, 0, Math.PI * 0.95, 10)]],
  },
  M: {
    w: 0.82,
    s: [
      [
        [0.02, 1],
        [0.04, 0],
        [0.41, 0.62],
        [0.78, 0],
        [0.8, 1],
      ],
    ],
  },
  "4": {
    w: 0.68,
    s: [
      [
        [0.5, 1],
        [0.5, 0],
      ],
      [
        [0.5, 0],
        [0.02, 0.68],
        [0.68, 0.67],
      ],
    ],
  },
  T: {
    w: 0.68,
    s: [
      [
        [0, 0.01],
        [0.68, 0],
      ],
      [
        [0.34, 0],
        [0.35, 1],
      ],
    ],
  },
};

/** Writes a line in marker; returns each character's box [x, width] for the underlines. */
export function marker(g: CanvasRenderingContext2D, text: string, x0: number, base: number, cap: number, seed: number, ink: string) {
  const r = rng(seed);
  const boxes: [number, number][] = [];
  let x = x0;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const ch of text) {
    const gl = GLYPHS[ch];
    if (!gl) {
      x += cap * 0.4;
      continue;
    }
    const tilt = (r() - 0.5) * 0.06;
    const dy = (r() - 0.5) * cap * 0.05;
    const scale = cap * (0.96 + r() * 0.08);
    const pt = ([px, py]: [number, number]): [number, number] => {
      const lx = px * scale;
      const ly = (py - 1) * scale;
      return [
        x + lx * Math.cos(tilt) - ly * Math.sin(tilt) + (r() - 0.5) * cap * 0.012,
        base + dy + lx * Math.sin(tilt) + ly * Math.cos(tilt) + (r() - 0.5) * cap * 0.012,
      ];
    };
    for (const pass of [
      { w: 0.15, a: 0.18 },
      { w: 0.12, a: 0.9 },
    ]) {
      g.strokeStyle = ink;
      g.globalAlpha = pass.a;
      g.lineWidth = cap * pass.w;
      for (const s of gl.s) {
        g.beginPath();
        s.forEach((p, i) => {
          const [px, py] = pt(p);
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        });
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    boxes.push([x, gl.w * scale]);
    x += gl.w * scale + cap * 0.2;
  }
  return boxes;
}

/** Width of a marker line before drawing it, to centre it. */
export function markerWidth(text: string, cap: number) {
  let w = 0;
  for (const ch of text) w += (GLYPHS[ch]?.w ?? 0.2) * cap + cap * 0.2;
  return w - cap * 0.2;
}

/** A soft round blot (alpha only), for contact shadows and the stuffing's fibre halo. */
export function blotTexture(THREE: Three, n = 128) {
  const { c, g } = canvas(n, n);
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, "rgba(0,0,0,1)");
  grd.addColorStop(0.45, "rgba(0,0,0,.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c);
  return t;
}
