// The parts each check opens: the owner's paper tag (check 4), the phone's live camera (check 1) and the photo with
// its fingerprint against earlier claims' photos (check 2).
import type * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EXHIBIT } from "../claim";
import { rng } from "./noise";
import { marker, markerWidth, paperCanvas } from "./textures";

type Three = typeof T;

// ---- The tag: 0.135 x 0.072 m (0.23 of the U's width, as in the photo), top corners cut at the hole end, a punched
// hole with a reinforcement ring, "X-VESOLJE / M4T" in marker. Tied to the right half with twine.
export const TAG_W = 0.135;
export const TAG_H = 0.072;

export interface Tag {
  pivot: T.Group;
  mesh: T.Group;
  /** The contact shadow's strength: full when the tag lies on the floor, none once it lifts. */
  shadow: T.MeshBasicMaterial;
  /** Redraws the lettering with the first `chars` of the code marked, `now` the one being read. */
  draw(chars: number, now: number, colors: { paper: string; ink: string; accent: string }): void;
  /** The hole, in world space. */
  hole(out: T.Vector3): T.Vector3;
  /** A point on the code, in world space, for the leader line. */
  codePoint(out: T.Vector3): T.Vector3;
  twine: T.Mesh;
  /** Lays the twine from its knot on the pillow, down the given world points, to the hole. */
  poseTwine(path: T.Vector3[]): void;
}

export function buildTag(THREE: Three): Tag {
  const w = TAG_W;
  const h = TAG_H;
  const cut = h * 0.24;
  const hr = h * 0.07;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + cut, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2 + cut, h / 2);
  s.lineTo(-w / 2, h / 2 - cut);
  s.lineTo(-w / 2, -h / 2 + cut);
  s.closePath();
  const hx = -w / 2 + h * 0.21;
  const hole = new THREE.Path();
  hole.absarc(hx, 0, hr, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.0005,
    bevelEnabled: false,
    curveSegments: 28,
  });
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  // A slight paper curl along the length, so it never reads as a flat card.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) + 0.0035 * ((x / (w / 2)) ** 2 - 1) * 0.6);
  }
  geo.computeVertexNormals();
  const PX = 1024;
  const PY = Math.round((PX * h) / w);
  const cvs = document.createElement("canvas");
  cvs.width = PX;
  cvs.height = PY;
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.85,
    side: THREE.DoubleSide,
    envMapIntensity: 0.6,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: "#b9ad97",
    roughness: 0.9,
  });
  // Faces in the cream paper, the cut edge a shade darker.
  const card = new THREE.Mesh(geo, [mat, edgeMat]);
  card.castShadow = true;
  card.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(hr * 1.5, hr * 0.42, 10, 40), new THREE.MeshStandardMaterial({ color: "#c7ab7e", roughness: 0.75 }));
  ring.scale.z = 0.15;
  ring.position.set(hx, 0, 0.0007);
  // A soft contact shadow under the card, and a darker cut edge, so the cream tag holds its shape on a pale floor too.
  const blot = document.createElement("canvas");
  blot.width = 256;
  blot.height = 160;
  const bg = blot.getContext("2d");
  if (bg) {
    for (let i = 0; i < 10; i++) {
      bg.fillStyle = `rgba(0,0,0,${0.05})`;
      const k = i * 5;
      bg.beginPath();
      bg.roundRect(28 + k, 28 + k, 200 - 2 * k, 104 - 2 * k, 18);
      bg.fill();
    }
  }
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    depthWrite: false,
    alphaMap: new THREE.CanvasTexture(blot),
    opacity: 0.5,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, h * 1.4), shadowMat);
  shadow.position.z = -0.0012;
  shadow.renderOrder = -1;
  const mesh = new THREE.Group();
  mesh.add(shadow, card, ring);
  // The pivot sits at the hole, so lifting the tag swings it on its twine.
  mesh.position.set(-hx, 0, 0);
  const pivot = new THREE.Group();
  pivot.add(mesh);

  let drawn = "";
  function draw(chars: number, now: number, c: { paper: string; ink: string; accent: string }) {
    const key = `${chars}:${now}:${c.paper}:${c.accent}`;
    if (key === drawn) return;
    drawn = key;
    const g = cvs.getContext("2d");
    if (!g) return;
    const paper = paperCanvas(PX, PY, 11, c.paper);
    g.drawImage(paper.c, 0, 0);
    const holeEnd = PX * 0.17;
    const textW = PX - holeEnd - PX * 0.06;
    const cap1 = PY * 0.2;
    const x1 = holeEnd + (textW - markerWidth(EXHIBIT.label, cap1)) / 2;
    marker(g, EXHIBIT.label, x1, PY * 0.42, cap1, 5, c.ink);
    const cap2 = PY * 0.27;
    const x2 = holeEnd + (textW - markerWidth(EXHIBIT.code, cap2)) / 2;
    // Highlight under each character read so far, the one being read now in full amber.
    const boxes: [number, number][] = [];
    const probe = document.createElement("canvas").getContext("2d");
    if (probe) boxes.push(...marker(probe, EXHIBIT.code, x2, PY * 0.8, cap2, 9, c.ink));
    boxes.forEach(([bx, bw], i) => {
      if (i >= chars) return;
      g.globalAlpha = i === now ? 0.95 : 0.5;
      g.fillStyle = c.accent;
      g.fillRect(bx - cap2 * 0.08, PY * 0.83, bw + cap2 * 0.16, cap2 * 0.12);
      g.globalAlpha = 1;
    });
    marker(g, EXHIBIT.code, x2, PY * 0.8, cap2, 9, c.ink);
    tex.needsUpdate = true;
  }

  // Twine: a twisted cord, from its knot on the pillow down through the hole.
  const tw = document.createElement("canvas");
  tw.width = 64;
  tw.height = 16;
  const tg = tw.getContext("2d");
  if (tg) {
    tg.fillStyle = "#b39567";
    tg.fillRect(0, 0, 64, 16);
    const r = rng(3);
    for (let i = -16; i < 80; i += 6) {
      tg.strokeStyle = `rgba(80,60,35,${0.35 + r() * 0.2})`;
      tg.lineWidth = 2;
      tg.beginPath();
      tg.moveTo(i, 0);
      tg.lineTo(i + 10, 16);
      tg.stroke();
    }
  }
  const twTex = new THREE.CanvasTexture(tw);
  twTex.colorSpace = THREE.SRGBColorSpace;
  twTex.wrapS = twTex.wrapT = THREE.RepeatWrapping;
  twTex.repeat.set(60, 1);
  const twine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map: twTex, roughness: 0.9 }));
  twine.castShadow = true;
  const H = new THREE.Vector3();
  const A = new THREE.Vector3();
  function poseTwine(pathWorld: T.Vector3[]) {
    const parent = twine.parent;
    if (!parent) return;
    pivot.updateMatrixWorld(true);
    const holeW = mesh.localToWorld(H.set(hx, 0, 0));
    const holeL = parent.worldToLocal(holeW.clone());
    const lead = pathWorld.map((p) => parent.worldToLocal(A.copy(p)).clone());
    // Through the hole and back over the tag's edge: the loop a tag is tied with.
    const n = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    const toLocal = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const nl = n.clone().transformDirection(toLocal);
    const along = new THREE.Vector3(-1, 0, 0).transformDirection(mesh.matrixWorld).transformDirection(toLocal);
    const last = lead[lead.length - 1];
    const pts = [
      ...lead,
      last.clone().lerp(holeL, 0.6).addScaledVector(nl, 0.004),
      holeL.clone().addScaledVector(nl, 0.0025),
      holeL.clone(),
      holeL.clone().addScaledVector(nl, -0.003).addScaledVector(along, 0.006),
    ];
    twine.geometry.dispose();
    twine.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.3), 64, 0.0011, 6);
  }

  return {
    pivot,
    mesh,
    shadow: shadowMat,
    draw,
    twine,
    poseTwine,
    hole: (out) => mesh.localToWorld(out.set(hx, 0, 0)),
    codePoint: (out) => mesh.localToWorld(out.set(w * 0.12, -h * 0.28, 0)),
  };
}

// ---- Check 1: the phone's live camera. Seen from behind the phone: its screen shows the viewfinder, its camera's
// frustum runs out to a frame round the evidence, and a scan plane travels down it.
export interface Phone {
  group: T.Group;
  lines: T.LineSegments;
  sheet: T.Mesh;
  lineMat: T.LineBasicMaterial;
  sheetMat: T.MeshBasicMaterial;
  pose(open: number, scan: number): void;
  lens(out: T.Vector3): T.Vector3;
}

/** How far down the view, as a share of the lens-to-evidence distance, the frustum's frame floats. */
const FRUSTUM_FAR = 0.45;

export function buildPhone(THREE: Three, photo: T.Texture): Phone {
  const group = new THREE.Group();
  const bw = 0.072;
  const bh = 0.15;
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(bw, bh, 0.008, 4, 0.009),
    new THREE.MeshPhysicalMaterial({
      color: "#1b1b1d",
      roughness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      metalness: 0.3,
    }),
  );
  body.castShadow = true;
  group.add(body);
  // The screen faces the viewer behind the phone (-z); the lens looks at the evidence (+z).
  const sw = bw - 0.006;
  const sh = bh - 0.008;
  const cvs = document.createElement("canvas");
  cvs.width = 440;
  cvs.height = Math.round((440 * sh) / sw);
  const screenTex = new THREE.CanvasTexture(cvs);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const drawScreen = () => {
    const g = cvs.getContext("2d");
    const img = photo.image as HTMLImageElement | undefined;
    if (!g || !img?.width) return;
    g.fillStyle = "#000";
    g.fillRect(0, 0, cvs.width, cvs.height);
    // The viewfinder: the photo, cover-fitted, as the claim page's camera shows it.
    const k = Math.max(cvs.width / img.width, cvs.height / img.height);
    const dw = img.width * k;
    const dh = img.height * k;
    g.drawImage(img, (cvs.width - dw) / 2, (cvs.height - dh) / 2, dw, dh);
    g.fillStyle = "rgba(255,255,255,.92)";
    g.beginPath();
    g.arc(cvs.width / 2, cvs.height - 70, 30, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.5)";
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cvs.width / 2, cvs.height - 70, 38, 0, Math.PI * 2);
    g.stroke();
    screenTex.needsUpdate = true;
  };
  drawScreen();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.z = -0.0042;
  screen.rotation.y = Math.PI;
  group.add(screen);
  const lensM = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, 0.002, 24),
    new THREE.MeshPhysicalMaterial({
      color: "#0b0b0c",
      roughness: 0.2,
      clearcoat: 1,
    }),
  );
  lensM.rotation.x = Math.PI / 2;
  lensM.position.set(-bw / 2 + 0.014, bh / 2 - 0.016, 0.0048);
  group.add(lensM);
  // Held above the front of the evidence, looking down at it, as the owner would.
  group.position.set(0.02, 0.5, 0.6);
  group.lookAt(0.0, 0.02, 0.02);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0xf1b23c,
    transparent: true,
    opacity: 0,
  });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
  const sheetMat = new THREE.MeshBasicMaterial({
    color: 0xf1b23c,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sheet = new THREE.Mesh(new THREE.BufferGeometry(), sheetMat);
  sheet.renderOrder = 5;
  lines.renderOrder = 5;

  const L = new THREE.Vector3();
  const lensLocal = lensM.position.clone().add(new THREE.Vector3(0, 0, 0.001));
  const lens = (out: T.Vector3) => {
    group.updateMatrixWorld(true);
    return group.localToWorld(out.copy(lensLocal));
  };
  // The camera's view as a frustum gizmo: from the lens to a 3:4 portrait frame, 48 degrees tall, so seen from the
  // lens the frame just holds the cut pillow (as the RM-0442 photo does). The frame floats a little over half way
  // down, clear of the evidence: at the evidence's own distance it cut through the stuffing and read as a seam.
  group.updateMatrixWorld(true);
  const o = lens(new THREE.Vector3());
  const ax = new THREE.Vector3(1, 0, 0).transformDirection(group.matrixWorld);
  const ay = new THREE.Vector3(0, 1, 0).transformDirection(group.matrixWorld);
  const az = new THREE.Vector3(0, 0, 1).transformDirection(group.matrixWorld);
  const far = o.distanceTo(new THREE.Vector3(0, 0.04, 0.02)) * FRUSTUM_FAR;
  const tv = Math.tan((48 / 2) * (Math.PI / 180));
  const th = tv * 0.75;
  const frameAt = (dist: number) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sy]) =>
      o
        .clone()
        .addScaledVector(az, dist)
        .addScaledVector(ax, sx * th * dist)
        .addScaledVector(ay, sy * tv * dist),
    );
  const corners = frameAt(far);

  function pose(open: number, scan: number) {
    group.visible = open > 0.01;
    group.scale.setScalar(Math.max(0.001, 0.85 + 0.15 * open));
    lens(L);
    const pts: number[] = [];
    // The four edges draw out from the lens as the part opens, then the far frame closes.
    for (const c of corners) {
      const e = L.clone().lerp(c, open);
      pts.push(L.x, L.y, L.z, e.x, e.y, e.z);
    }
    if (open > 0.98)
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    // The scan: the frame's cross-section travels from the lens down to the frame.
    const s = Math.max(0, Math.min(1, scan));
    const on = open > 0.5 && s > 0 && s < 1;
    const q = frameAt(far * (0.12 + 0.88 * s));
    if (on)
      for (let i = 0; i < 4; i++) {
        const a = q[i];
        const b = q[(i + 1) % 4];
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    lines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    sheet.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [q[0], q[1], q[2], q[0], q[2], q[3]].flatMap((v) => [v.x, v.y, v.z]),
        3,
      ),
    );
    sheet.visible = on;
    sheetMat.opacity = 0.1 * Math.sin(Math.PI * s);
    lineMat.opacity = 0.8 * open;
    lines.visible = open > 0.01;
  }
  return { group, lines, sheet, lineMat, sheetMat, pose, lens };
}

// ---- Check 2: the photo, printed, with its real 64-bit fingerprint (dHash) drawn over it as an 8 x 8 grid, held in
// front of earlier claims' photos and their fingerprints.
export const PRINT_W = 0.15;
export const PRINT_H = 0.225;

function bits(hex: string) {
  const out: number[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const nib = parseInt(hex[y * 2 + (x >> 2)], 16);
      out.push((nib >> (3 - (x & 3))) & 1);
    }
  return out;
}

export interface Prints {
  group: T.Group;
  grid: T.Mesh;
  gridMat: T.MeshBasicMaterial;
  ghosts: T.Mesh[];
  pose(open: number, hash: number): void;
  drawGrid(accent: string, faint: string, paper: string): void;
  corner(out: T.Vector3): T.Vector3;
}

export function buildPrints(THREE: Three, photo: T.Texture, earlier: T.Texture[], paper: string): Prints {
  const group = new THREE.Group();
  const border = new THREE.MeshStandardMaterial({
    color: paper,
    roughness: 0.6,
  });
  const card = (tex: T.Texture) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(PRINT_W, PRINT_H, 0.0012), [
      border,
      border,
      border,
      border,
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }),
      border,
    ]);
    m.castShadow = true;
    return m;
  };
  const main = card(photo);
  group.add(main);
  // The fingerprint floats a little in front of the print.
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = 512;
  const gridTex = new THREE.CanvasTexture(cvs);
  gridTex.colorSpace = THREE.SRGBColorSpace;
  const gridMat = new THREE.MeshBasicMaterial({
    map: gridTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0,
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(PRINT_W * 0.86, PRINT_W * 0.86), gridMat);
  grid.position.set(0, 0, 0.012);
  grid.renderOrder = 6;
  group.add(grid);
  const ghosts = earlier.map((t, i) => {
    const g = card(t);
    g.position.set(-0.045 * (i + 1), 0.006 * (i + 1), -0.05 * (i + 1));
    g.rotation.z = [0.04, -0.03, 0.05][i];
    group.add(g);
    return g;
  });
  // The earlier prints' own fingerprints, small and neutral.
  const ghostGrids = earlier.map((_, i) => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(PRINT_W * 0.86, PRINT_W * 0.86),
      new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    m.position.set(0, 0, 0.004);
    ghosts[i].add(m);
    return { c, t, m };
  });
  // Out to the left of the evidence, facing the check's camera, which keeps the pillow out of the frame.
  group.position.set(-0.86, 0.0, 0.06);
  group.rotation.y = 0.5;

  // The fingerprint's 64 bits in paper on ink, with one amber outline round the grid being checked: the earlier
  // photos' grids are faint. (Amber stays one focal element, never 25 lit cells.)
  function drawGrid(accent: string, faint: string, paper: string) {
    const paint = (c: HTMLCanvasElement, hex: string, on: string, off: string, back: string, outline?: string) => {
      const g = c.getContext("2d");
      if (!g) return;
      const n = c.width;
      g.clearRect(0, 0, n, n);
      g.fillStyle = back;
      g.beginPath();
      g.roundRect(0, 0, n, n, n * 0.04);
      g.fill();
      bits(hex).forEach((b, i) => {
        const cell = n / 8;
        g.fillStyle = b ? on : off;
        g.beginPath();
        g.roundRect((i % 8) * cell + cell * 0.18, Math.floor(i / 8) * cell + cell * 0.18, cell * 0.64, cell * 0.64, cell * 0.12);
        g.fill();
      });
      if (outline) {
        const w = Math.max(2, n * 0.012);
        g.strokeStyle = outline;
        g.lineWidth = w;
        g.beginPath();
        g.roundRect(w / 2, w / 2, n - w, n - w, n * 0.04);
        g.stroke();
      }
    };
    paint(cvs, EXHIBIT.hash, paper, "rgba(255,255,255,.14)", "rgba(12,11,10,.72)", accent);
    gridTex.needsUpdate = true;
    ghostGrids.forEach((gg, i) => {
      paint(gg.c, EXHIBIT.earlierHashes[i], faint, "rgba(255,255,255,.08)", "rgba(12,11,10,.5)");
      gg.t.needsUpdate = true;
    });
  }

  function pose(open: number, hash: number) {
    group.visible = open > 0.01;
    group.position.y = 0.035 + open * 0.2;
    group.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * open));
    gridMat.opacity = hash * open;
    grid.position.z = 0.004 + 0.014 * hash;
    ghosts.forEach((g, i) => {
      g.position.x = -0.05 * (i + 1) * open;
      g.position.z = -0.055 * (i + 1) * open;
      const m = g.material as T.Material[];
      m.forEach((x) => {
        x.transparent = true;
        x.opacity = open;
      });
    });
    ghostGrids.forEach((gg) => ((gg.m.material as T.MeshBasicMaterial).opacity = hash * open * 0.85));
  }

  return {
    group,
    grid,
    gridMat,
    ghosts,
    pose,
    drawGrid,
    corner: (out) => main.localToWorld(out.set(PRINT_W / 2, PRINT_H * 0.3, 0)),
  };
}
