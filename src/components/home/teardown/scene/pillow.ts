// The evidence: the Kikea X-VESOLJE nursing pillow, cut in half at the front with stuffing at the cut faces, as in the
// RM-0442 photo (public/demo/k01-1.jpg). The illustrated fabric retains the dark multicolour feather print from
// that photo, so the product, the phone preview and the later evidence prints remain visually consistent.
// Built from code at load; posed every frame from the cut.
import type * as T from "three";
import { fbm3, noise3, rng } from "./noise";
import { blotTexture, fabricTextures } from "./textures";

type Three = typeof T;

// Dimensions in metres, measured off the earlier RM-0442 photo (wave3/ref/JOB.md), which the feather-print pillow matches:
// a C more than a U, 0.56 wide, the tube 0.18 wide (0.31 of the width) and 0.12 high, each half sweeping 2.6 rad so the
// two ends nearly meet at the back.
export const R = 0.19;
export const RW = 0.088;
export const RH = 0.06;
export const SPAN = 2.6;
/** Height of the tube's centre line: it rests flattened on the floor. */
export const YC = RH * 0.8;

/** The photo's near-black brown fabric, before the studio light. */
const FABRIC: [number, number, number] = [42, 31, 36];
const FEATHERS = ["#d9b451", "#b8d4cf", "#e7a0ad", "#a489c0", "#dd7493", "#cfd4b3", "#7ea9c9", "#d9a17b"] as const;

const N = 110; // rings along the half
const M = 60; // vertices round each ring

export interface Half {
  group: T.Group;
  dir: 1 | -1;
  /** Re-pose the torn edge and stuffing for a cut amount, 0 (whole) to 1 (cut open), and the open fraction. */
  pose(cut: number, open: number): void;
  /** A point on the cut rim's top, in world space, for the leader line. */
  rimTop(out: T.Vector3): T.Vector3;
  rim: T.Line;
  stuffing: T.Group;
}

export interface PillowMaterials {
  cloth: T.MeshPhysicalMaterial;
  stuff: T.MeshPhysicalMaterial;
  fuzz: T.MeshStandardMaterial[];
  strands: T.LineBasicMaterial;
  contact: T.MeshBasicMaterial;
  rim: T.LineBasicMaterial;
}

// Fibre halo on the stuffing: two slightly larger shells of each clump whose alpha is cut by 3D noise in object space,
// so the silhouette is soft and fibrous instead of a hard ball.
const NOISE_GLSL = /* glsl */ `
float tdH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tdN(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tdH(i), tdH(i + vec3(1,0,0)), f.x), mix(tdH(i + vec3(0,1,0)), tdH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(tdH(i + vec3(0,0,1)), tdH(i + vec3(1,0,1)), f.x), mix(tdH(i + vec3(0,1,1)), tdH(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;

function fuzzMaterial(THREE: Three, level: number) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    depthWrite: false,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTdObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTdObj = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vTdObj;\n${NOISE_GLSL}`).replace(
      "#include <alphatest_fragment>",
      `#include <alphatest_fragment>
        { vec3 q = vTdObj * vec3(7.0, 7.0, 7.0);
          vec3 f = vTdObj * vec3(34.0, 34.0, 6.0);
          float n = tdN(q) * 0.45 + tdN(f + 7.0) * 0.4 + tdN(f * 2.3 + 3.0) * 0.15;
          diffuseColor.a *= smoothstep(${(0.42 + level * 0.08).toFixed(2)}, 0.8, n) * ${(0.75 - level * 0.25).toFixed(2)}; }`,
    );
  };
  m.customProgramCacheKey = () => `td-fuzz-${level}`;
  return m;
}

export async function pillowMaterials(THREE: Three): Promise<PillowMaterials> {
  // Match the distinguishing print in the evidence photo rather than silently changing the product colour.
  const tex = await fabricTextures(THREE, FABRIC, { tone: FEATHERS, alpha: 0.95 });
  tex.map.repeat.set(1, 1);
  const cloth = new THREE.MeshPhysicalMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.92,
    sheen: 0.35,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color("#b5adae"),
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
  });
  const stuff = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ddd6c9"),
    roughness: 1,
    sheen: 0.8,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color("#ffffff"),
    emissive: new THREE.Color("#2a2620"),
    envMapIntensity: 0.65,
  });
  // Fibre micro-structure on the clumps: the normal is bent by streaky noise in each clump's own space, so the light
  // breaks up across the surface like teased fibre instead of resting smooth like clay.
  stuff.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTdObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTdObj = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vTdObj;\n${NOISE_GLSL}`).replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
        { vec3 f = vTdObj * vec3(30.0, 30.0, 7.0);
          vec3 b = vec3(tdN(f), tdN(f + 11.0), tdN(f + 23.0)) - 0.5;
          normal = normalize(normal + b * 0.9); }`,
    );
  };
  stuff.customProgramCacheKey = () => "td-stuff";
  const fuzz = [fuzzMaterial(THREE, 0), fuzzMaterial(THREE, 1)];
  for (const f of fuzz) f.color.copy(stuff.color);
  const strands = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const contact = new THREE.MeshBasicMaterial({
    map: blotTexture(THREE),
    color: 0x000000,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  contact.alphaMap = contact.map;
  const rim = new THREE.LineBasicMaterial({
    color: 0xebb75b,
    transparent: true,
    opacity: 0,
    depthTest: true,
  });
  return { cloth, stuff, fuzz, strands, contact, rim };
}

/** A lumpy fibre clump: a sphere pushed out by smooth noise, indexed so its normals are smooth (no facets). */
function clumpGeometry(THREE: Three, seed: number, w = 22, h = 15) {
  const g = new THREE.SphereGeometry(1, w, h);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.22 * fbm3(v.x * 2.1 + seed, v.y * 2.1, v.z * 2.1, 3) + 0.08 * noise3(v.x * 6 + seed, v.y * 6, v.z * 6);
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Ring position for arc fraction s and angle ph, before any cut fraying. */
function ringPoint(dir: number, s: number, ph: number, out: T.Vector3) {
  const L = R * SPAN;
  const th = dir * s * SPAN;
  const toEnd = L - s * L;
  const domeLen = RW * 0.95;
  const dome = toEnd < domeLen ? Math.sqrt(Math.max(0, 1 - (1 - toEnd / domeLen) ** 2)) : 1;
  const k = Math.max(dome, 0.015) * (1 + 0.035 * Math.cos(s * Math.PI));
  // A sewn pillow, not a pool noodle: the section is a superellipse (exponent 2.8), flatter on top and on the sides.
  const c = Math.cos(ph);
  const sn = Math.sin(ph);
  const e = 2 / 2.8;
  let w = RW * Math.sign(c) * Math.abs(c) ** e * k;
  let h = RH * Math.sign(sn) * Math.abs(sn) ** e * k;
  if (h < 0) {
    h *= 0.8; // it rests flattened on the floor
    w *= 1 + 0.05 * Math.min(1, -Math.sin(ph) * 1.5);
  }
  const nx = Math.sin(th);
  const nz = Math.cos(th);
  return out.set(R * nx + nx * w, YC + h, R * nz + nz * w);
}

export function buildHalf(THREE: Three, dir: 1 | -1, seed: number, mats: PillowMaterials): Half {
  const group = new THREE.Group();
  const r = rng(seed);
  const pos = new Float32Array((N + 1) * (M + 1) * 3);
  const uv: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const Q = new THREE.Vector3();
  const L = R * SPAN;
  // Surface wrinkles: smooth noise along the normal, a few millimetres, deeper and stretched along the tube near the
  // cut where the fabric bunches.
  for (let i = 0; i <= N; i++) {
    const s = (i / N) ** 1.35; // denser rings near the cut
    const arc = s * L;
    const nearCut = Math.exp(-arc / 0.045);
    for (let j = 0; j <= M; j++) {
      const ph = (j / M) * Math.PI * 2;
      ringPoint(dir, s, ph, P);
      ringPoint(dir, s, ph + 0.001, Q);
      const cx = R * Math.sin(dir * s * SPAN);
      const cz = R * Math.cos(dir * s * SPAN);
      // Outward normal of the cross-section, roughly.
      const ox = P.x - cx;
      const oy = P.y - YC;
      const oz = P.z - cz;
      const ol = Math.hypot(ox, oy, oz) || 1;
      const wr =
        fbm3(P.x * 22, P.y * 22, Math.abs(P.z) * 22, 3) * (0.0028 + 0.0055 * nearCut) + noise3(arc * 70, Math.cos(ph) * 3, Math.sin(ph) * 3) * 0.004 * nearCut;
      const o = (i * (M + 1) + j) * 3;
      pos[o] = P.x + (ox / ol) * wr;
      pos[o + 1] = Math.max(0.0004, P.y + (oy / ol) * wr);
      pos[o + 2] = P.z + (oz / ol) * wr;
      uv.push(arc / 0.08, (j / M) * 6);
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j;
      const b = a + M + 1;
      if (dir > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const skin = new THREE.Mesh(geo, mats.cloth);
  skin.castShadow = true;
  skin.receiveShadow = true;
  group.add(skin);

  // The torn edge: the first rings pull back irregularly along the tube and flare outward. The tear depth is smooth
  // noise round the ring plus a few longer threads, so it never reads as a regular zigzag.
  const ROWS = 4;
  const base = pos.slice(0, (ROWS + 1) * (M + 1) * 3);
  const tear = Array.from({ length: M + 1 }, (_, j) => {
    const ph = (j / M) * Math.PI * 2;
    const smoothTear = 0.5 + 0.5 * noise3(Math.cos(ph) * 2.2 + seed, Math.sin(ph) * 2.2, 0.5);
    const thread = r() < 0.18 ? r() * 0.9 : 0;
    return 0.005 + smoothTear * 0.011 + thread * 0.01;
  });
  tear[M] = tear[0];
  let lastCut = -1;

  // The rim of the cut, in amber when check 5 is the active part.
  const rimPts: T.Vector3[] = [];
  for (let j = 0; j <= M; j++) {
    const o = j * 3;
    rimPts.push(new THREE.Vector3(base[o] - dir * tear[j] * 0.8, base[o + 1], base[o + 2]).multiplyScalar(1));
  }
  const rim = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rimPts), mats.rim);
  rim.renderOrder = 3;
  group.add(rim);

  // Stuffing at the cut face: a dozen soft clumps filling the section and bulging out of it, sagging onto the floor at
  // the front, as in the photo; then two fibre shells and loose strands.
  const stuffing = new THREE.Group();
  stuffing.position.set(0, YC, R);
  group.add(stuffing);
  const clump = clumpGeometry(THREE, seed);
  const tuft = clumpGeometry(THREE, seed + 9, 12, 8);
  type C = {
    x: number;
    y: number;
    z: number;
    s: number;
    sx: number;
    sy: number;
    sz: number;
    rot: number;
  };
  const clumps: C[] = [];
  // A plug inside the tube, so the hollow is never seen.
  clumps.push({
    x: dir * 0.014,
    y: 0,
    z: 0,
    s: 1,
    sx: 0.024,
    sy: RH * 0.66,
    sz: RW * 0.68,
    rot: 0,
  });
  // The mound: a dozen clumps, then smaller tufts over its surface so the silhouette breaks up like fibre, not balls.
  const NC = 12;
  for (let i = 0; i < NC; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.82;
    const y = Math.sin(a) * d * RH * 0.78 - 0.005;
    const z = Math.cos(a) * d * RW * 0.8;
    const mound = 1 - d * d;
    const out = 0.006 + mound * (0.022 + r() * 0.02) + (y < 0 ? 0.008 : 0);
    const s = 0.015 + r() * 0.01 + mound * 0.008;
    clumps.push({
      x: -dir * out,
      y,
      z,
      s,
      sx: s * (0.9 + r() * 0.4),
      sy: s * (0.75 + r() * 0.3),
      sz: s * (0.9 + r() * 0.4),
      rot: r() * 6.28,
    });
  }
  const NT = 30;
  for (let i = 0; i < NT; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.95;
    const y = Math.sin(a) * d * RH * 0.85 - 0.004;
    const z = Math.cos(a) * d * RW * 0.88;
    const mound = 1 - d * d;
    const out = 0.012 + mound * (0.032 + r() * 0.022) + (y < 0 ? 0.01 : 0);
    const s = 0.006 + r() * 0.007;
    clumps.push({
      x: -dir * out,
      y,
      z,
      s,
      sx: s * (1 + r() * 0.8),
      sy: s * (0.7 + r() * 0.4),
      sz: s * (1 + r() * 0.6),
      rot: r() * 6.28,
    });
  }
  // The spill: a few flat tufts that have fallen onto the floor just in front of the cut, as in the photo.
  for (let i = 0; i < 3; i++) {
    const s = 0.012 + r() * 0.008;
    clumps.push({
      x: -dir * (0.01 + r() * 0.05),
      y: -YC + s * 0.45,
      z: RW * (1.05 + r() * 0.4),
      s,
      sx: s * 1.4,
      sy: s * 0.55,
      sz: s * 1.2,
      rot: r() * 6.28,
    });
  }
  // And the spill down the front of the cut face, between the mound and the floor.
  for (let i = 0; i < 4; i++) {
    const s = 0.013 + r() * 0.008;
    const z = RW * (0.45 + r() * 0.5);
    clumps.push({
      x: -dir * (0.03 + r() * 0.04),
      y: -YC * (0.35 + r() * 0.4),
      z,
      s,
      sx: s * 1.2,
      sy: s,
      sz: s * 1.1,
      rot: r() * 6.28,
    });
  }
  const M4 = new THREE.Matrix4();
  const Qt = new THREE.Quaternion();
  const E = new THREE.Euler();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();
  const layers: T.InstancedMesh[] = [];
  [mats.stuff, ...mats.fuzz].forEach((mat, layer) => {
    // The plug inside the tube gets no fibre shell: it would show through the fabric. Small tufts use a lighter mesh.
    const all = layer === 0 ? clumps : clumps.slice(1);
    for (const [geo, list] of [
      [clump, all.filter((c) => c.s >= 0.012)],
      [tuft, all.filter((c) => c.s < 0.012)],
    ] as const) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const grow = [1, 1.09, 1.2][layer];
      list.forEach((c, i) => {
        E.set(c.rot, c.rot * 1.7, c.rot * 0.6);
        Qt.setFromEuler(E);
        M4.compose(V.set(c.x, c.y, c.z), Qt, S.set(c.sx * grow, c.sy * grow, c.sz * grow));
        im.setMatrixAt(i, M4);
      });
      im.castShadow = layer === 0;
      im.receiveShadow = false;
      im.renderOrder = layer;
      layers.push(im);
      stuffing.add(im);
    }
  });

  // Strands: loose fibres off the clumps (off-white) and frayed threads off the torn fabric (the cloth's dark ground), one draw call.
  const sp: number[] = [];
  const sc: number[] = [];
  const white = [0.92, 0.9, 0.86];
  const thread = FABRIC.map((c) => (c / 255) * 0.85);
  const strand = (x: number, y: number, z: number, nx: number, ny: number, nz: number, len: number, c: number[], segs = 3) => {
    let px = x;
    let py = y;
    let pz = z;
    let dx = nx;
    let dy = ny;
    let dz = nz;
    for (let k = 0; k < segs; k++) {
      const l = len / segs;
      dx += (r() - 0.5) * 0.9;
      dy += (r() - 0.5) * 0.9;
      dz += (r() - 0.5) * 0.9;
      const dl = Math.hypot(dx, dy, dz) || 1;
      const qx = px + (dx / dl) * l;
      const qy = py + (dy / dl) * l;
      const qz = pz + (dz / dl) * l;
      sp.push(px, py, pz, qx, qy, qz);
      sc.push(...c, ...c);
      px = qx;
      py = qy;
      pz = qz;
    }
  };
  for (const c of clumps.slice(1)) {
    for (let k = 0; k < (c.s > 0.012 ? 30 : 12); k++) {
      const a = r() * Math.PI * 2;
      const b = Math.acos(2 * r() - 1);
      const nx = Math.sin(b) * Math.cos(a);
      const ny = Math.cos(b);
      const nz = Math.sin(b) * Math.sin(a);
      strand(c.x + nx * c.sx, c.y + ny * c.sy, c.z + nz * c.sz, nx, ny, nz, 0.004 + r() * 0.01, white);
    }
  }
  const strandGeo = new THREE.BufferGeometry();
  strandGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  strandGeo.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
  const fibres = new THREE.LineSegments(strandGeo, mats.strands);
  fibres.renderOrder = 4;
  stuffing.add(fibres);

  // Frayed threads off the torn edge (in the half's frame, so they follow the fabric).
  const tp: number[] = [];
  const tc: number[] = [];
  for (let j = 0; j < M; j += 1) {
    if (r() < 0.45) continue;
    const o = j * 3;
    const x = base[o] - dir * tear[j];
    let px = x;
    let py = base[o + 1];
    let pz = base[o + 2];
    const len = 0.004 + r() * 0.01;
    for (let k = 0; k < 2; k++) {
      const qx = px - dir * (len / 2) * (0.6 + r() * 0.4);
      const qy = py + (r() - 0.6) * len * 0.6;
      const qz = pz + (r() - 0.5) * len * 0.5;
      tp.push(px, py, pz, qx, qy, qz);
      tc.push(...thread, ...thread);
      px = qx;
      py = qy;
      pz = qz;
    }
  }
  const threadGeo = new THREE.BufferGeometry();
  threadGeo.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
  threadGeo.setAttribute("color", new THREE.Float32BufferAttribute(tc, 3));
  const threads = new THREE.LineSegments(threadGeo, mats.strands);
  group.add(threads);

  // Contact shadow: the half's footprint drawn soft on the floor under it, darkest where the fabric touches.
  {
    const n = 256;
    const size = 0.78;
    const cvs = document.createElement("canvas");
    cvs.width = cvs.height = n;
    const g = cvs.getContext("2d");
    if (g) {
      const toPx = (x: number, z: number): [number, number] => [((x - dir * 0.16) / size + 0.5) * n, ((z - 0.0) / size + 0.5) * n];
      g.lineCap = "round";
      g.lineJoin = "round";
      for (let pass = 0; pass < 14; pass++) {
        const w = RW * 2 * (0.55 + pass * 0.09);
        g.strokeStyle = `rgba(0,0,0,${(0.11 - pass * 0.006).toFixed(3)})`;
        g.lineWidth = (w / size) * n;
        g.beginPath();
        for (let i = 0; i <= 60; i++) {
          const s = (i / 60) * 0.96;
          const th = dir * s * SPAN;
          const [x, y] = toPx(R * Math.sin(th), R * Math.cos(th));
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    const t = new THREE.CanvasTexture(cvs);
    const mat = mats.contact.clone();
    mat.map = null;
    mat.alphaMap = t;
    mat.opacity = 1;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(dir * 0.16, 0.0006, 0);
    plane.renderOrder = -1;
    group.add(plane);
  }

  const posAttr = geo.attributes.position as T.BufferAttribute;
  function pose(cut: number, open: number) {
    // The torn edge only exists once it is cut; whole, the two halves meet in one clean ring.
    if (Math.abs(cut - lastCut) > 0.0005) {
      lastCut = cut;
      const arr = posAttr.array as Float32Array;
      for (let row = 0; row <= ROWS; row++) {
        const fall = [1, 0.55, 0.25, 0.1, 0.03][row];
        for (let j = 0; j <= M; j++) {
          const o = (row * (M + 1) + j) * 3;
          const t = tear[j] * cut * fall;
          const flare = 1 + 0.11 * cut * fall;
          const ph = (j / M) * Math.PI * 2;
          // Flare outward from the section centre (local x is along the tube at the cut).
          const cy = YC;
          const cz = R;
          arr[o] = base[o] - dir * t;
          arr[o + 1] = Math.max(0.0004, cy + (base[o + 1] - cy) * flare);
          arr[o + 2] = cz + (base[o + 2] - cz) * flare;
          void ph;
        }
      }
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    }
    stuffing.visible = cut > 0.02;
    threads.visible = cut > 0.3;
    const a = Math.min(1, cut);
    const k = 0.35 + 0.65 * a + 0.12 * open;
    stuffing.scale.set(k * (1 + 0.25 * open), k, k);
    stuffing.position.x = -dir * 0.004 * open;
    mats.strands.opacity = 0.45 * a;
  }

  return {
    group,
    dir,
    pose,
    rim,
    stuffing,
    rimTop(out) {
      return group.localToWorld(out.set(-dir * 0.004, YC + RH * 1.02, R));
    },
  };
}
