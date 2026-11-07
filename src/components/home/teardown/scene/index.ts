// The Opened Exhibit's three.js scene. This module (and three.js with it) is only ever loaded by a dynamic import
// from OpenedExhibit.tsx when the section nears the viewport, so none of it is in any page's first-load JS.
//
// Studio and review method adapted from the teardown skill (whaleyxbt/claude-motion, MIT): one input poses every part,
// a soft floor shadow, one accent on the active part, roughness >= 0.45 on big surfaces, quality tiers, warmed shaders.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EXHIBIT } from "../claim";
import type { ExhibitState, Shot } from "../model";
import { buildHalf, pillowMaterials, R, SPAN, YC, RH, RW } from "./pillow";
import { buildPhone, buildPrints, buildTag } from "./parts";
import { yieldToMain } from "./textures";

export interface Colors {
  dark: boolean;
  accent: string;
  paper: string;
  ink: string;
  faint: string;
}

/** The subject rect, as fractions of the canvas (0 to 1, y down): where the framed part must sit. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Tier = 1 | 2;

export interface Frame {
  /** The active part's anchor for the leader line, in CSS px of the canvas, or null. */
  anchor: { x: number; y: number } | null;
}

export interface Exhibit {
  render(s: ExhibitState, rect: Rect): Frame;
  /** Draws each state once and waits for the GPU (a 1px readback, which blocks until every draw is done): ms a frame. */
  bench(states: ExhibitState[], rect: Rect): number;
  setColors(c: Colors): void;
  setTier(t: Tier): void;
  resize(w: number, h: number, dpr: number): void;
  /** Projected screen bounds (CSS px) of every visible part, for the capture tool's collision check. */
  bounds(): { name: string; x0: number; y0: number; x1: number; y1: number }[];
  info(): { calls: number; triangles: number; tier: Tier; renderer: string };
  dispose(): void;
}

const D2R = Math.PI / 180;
const FOV = 26;

function loadTexture(url: string) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

export async function createExhibit(canvas: HTMLCanvasElement, opts: { tier: Tier; colors: Colors; preserve?: boolean }): Promise<Exhibit> {
  const [photo, ...earlier] = await Promise.all([EXHIBIT.photo, ...EXHIBIT.earlier].map(loadTexture));

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: !!opts.preserve,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(FOV, 1.6, 0.01, 20);

  // One warm key from the front left (the room's lamp side), a cool rim, a soft hemisphere fill.
  const key = new THREE.DirectionalLight(0xfff2e2, 2.2);
  key.position.set(-1.3, 2.4, 1.5);
  key.castShadow = true;
  key.shadow.radius = 10;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.012;
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -0.75;
  sc.right = sc.top = 0.75;
  sc.near = 1.2;
  sc.far = 5;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xe9eeff, 0.9);
  rim.position.set(1.6, 1.1, -2.0);
  scene.add(rim);
  const fill = new THREE.HemisphereLight(0xfff8ee, 0x2a2622, 0.35);
  scene.add(fill);

  const floorMat = new THREE.ShadowMaterial({ opacity: 0.5, color: 0x0c0b09 });
  floorMat.polygonOffset = true;
  floorMat.polygonOffsetFactor = -1;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- The evidence.
  // Built in slices with the main thread given back between them (the scene arms mid-scroll, during chapter 02).
  const mats = await pillowMaterials(THREE);
  await yieldToMain();
  const left = buildHalf(THREE, -1, 3, mats);
  await yieldToMain();
  const right = buildHalf(THREE, 1, 4, mats);
  await yieldToMain();
  scene.add(left.group, right.group);

  const tag = buildTag(THREE);
  // Lying on the floor to the front right of the right half's cut, its hole end toward the pillow, as in the photo.
  tag.pivot.position.set(0.155, 0.0016, 0.322);
  tag.pivot.rotation.set(0, 0.42, 0);
  tag.mesh.rotation.x = -Math.PI / 2;
  right.group.add(tag.pivot, tag.twine);
  // The twine is tied round the tube 0.3 rad from the cut (a loop hugging the fabric), then drapes down its outer
  // side and across the floor to the tag.
  const TH = 0.3;
  const ringAt = (ph: number, grow = 1.045) => {
    const w = RW * Math.cos(ph) * grow;
    let h = RH * Math.sin(ph) * grow;
    if (h < 0) h *= 0.8;
    return new THREE.Vector3((R + w) * Math.sin(TH), Math.max(0.0012, YC + h), (R + w) * Math.cos(TH));
  };
  const loopPts = Array.from({ length: 49 }, (_, i) => ringAt((i / 48) * Math.PI * 2));
  const loop = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loopPts, true), 96, 0.0011, 6, true), tag.twine.material);
  loop.castShadow = true;
  right.group.add(loop);
  const drapeLocal = [ringAt(0.85, 1.04), ringAt(0.2, 1.08), ringAt(-0.75, 1.12)];
  const drape = drapeLocal.map((v) => v.clone());

  await yieldToMain();
  const phone = buildPhone(THREE, photo);
  scene.add(phone.group, phone.lines, phone.sheet);
  const prints = buildPrints(THREE, photo, earlier, "#f1ebdd");
  scene.add(prints.group);

  // Back-end pivots: each half swings open about the far end of its arc, as the cut ends spread (photo: about 0.11 m).
  const pivotOf = (dir: number) => new THREE.Vector3(dir * R * Math.sin(SPAN) * 0.92, 0, R * Math.cos(SPAN) * 0.92);
  const PL = pivotOf(-1);
  const PR = pivotOf(1);
  const tmp = new THREE.Vector3();
  function swing(g: THREE.Group, pivot: THREE.Vector3, angle: number, dx: number, lift: number) {
    g.rotation.set(0, angle, 0);
    tmp.copy(pivot).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    g.position.set(pivot.x - tmp.x + dx, lift, pivot.z - tmp.z);
  }

  let colors = opts.colors;
  let tier: Tier = opts.tier;
  function applyColors(c: Colors) {
    colors = c;
    // Amber only on the active part's rim (the cut, check 5). The camera's frustum and scan plane are drawn in the
    // neutral --faint, so a check's one amber is its callout, not a wireframe box.
    mats.rim.color.set(c.accent);
    for (const m of [phone.lineMat, phone.sheetMat]) m.color.set(c.faint);
    if (c.dark) {
      key.intensity = 2.3;
      fill.intensity = 0.32;
      scene.environmentIntensity = 0.55;
      floorMat.opacity = 0.55;
      mats.stuff.color.set("#d8d1c3");
      mats.stuff.emissive.set("#1f1c17");
      mats.cloth.sheenColor.set("#6f7ca2");
    } else {
      // On the pale floor the near-white stuffing needs its own shading to hold its shape: less fill, a darker grade.
      key.intensity = 2.2;
      fill.intensity = 0.45;
      scene.environmentIntensity = 0.7;
      floorMat.opacity = 0.3;
      mats.stuff.color.set("#d6cdbd");
      mats.stuff.emissive.set("#0d0b08");
      mats.cloth.sheenColor.set("#7e8aae");
    }
    for (const f of mats.fuzz) f.color.copy(mats.stuff.color);
    prints.drawGrid(c.accent, c.faint, c.paper);
  }

  function applyTier(t: Tier) {
    tier = t;
    const size = t === 2 ? 1024 : 512;
    if (key.shadow.mapSize.x !== size) {
      key.shadow.mapSize.set(size, size);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    mats.fuzz[1].visible = t === 2;
  }
  applyTier(tier);
  applyColors(colors);

  let W = 1;
  let H = 1;
  function frame(shot: Shot, rect: Rect) {
    const az = shot.az * D2R;
    const el = shot.el * D2R;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const aspect = W / H;
    const tanV = Math.tan((FOV / 2) * D2R);
    const tanH = tanV * aspect;
    const rw = Math.max(0.05, rect.x1 - rect.x0);
    const rh = Math.max(0.05, rect.y1 - rect.y0);
    const d = Math.max(shot.rx / (tanH * rw), shot.ry / (tanV * rh));
    const at = new THREE.Vector3(...shot.at);
    camera.position.copy(at).addScaledVector(dir, d);
    camera.up.set(0, 1, 0);
    camera.lookAt(at);
    camera.aspect = aspect;
    const cx = (rect.x0 + rect.x1) / 2;
    const cy = (rect.y0 + rect.y1) / 2;
    camera.setViewOffset(W, H, (0.5 - cx) * W, (0.5 - cy) * H, W, H);
    camera.updateProjectionMatrix();
  }

  const P = new THREE.Vector3();
  const project = (v: THREE.Vector3) => {
    P.copy(v).project(camera);
    return { x: (P.x * 0.5 + 0.5) * W, y: (-P.y * 0.5 + 0.5) * H };
  };

  function render(s: ExhibitState, rect: Rect): Frame {
    // Halves: cut and spread as in the photo, pushed further for check 5, apart and lifted in the explode.
    const hinge = s.cut * 0.21 + s.torn * 0.08 + s.explode * 0.12;
    const dx = s.torn * 0.012 + s.explode * 0.07;
    swing(left.group, PL, -hinge, -dx, s.explode * 0.03);
    swing(right.group, PR, hinge, dx, s.explode * 0.03);
    left.pose(s.cut, s.torn + s.explode * 0.6);
    right.pose(s.cut, s.torn + s.explode * 0.6);
    mats.rim.opacity = s.torn * 0.95;

    // The tag lifts toward the camera for check 4 and rises in the explode.
    tag.pivot.position.y = 0.0016 + s.code * 0.045 + s.explode * 0.05;
    tag.mesh.rotation.x = -Math.PI / 2 + s.code * 0.6 + s.explode * 0.25;
    tag.shadow.opacity = (colors.dark ? 0.55 : 0.32) * Math.max(0, 1 - (s.code + s.explode) * 3);
    tag.draw(s.chars, s.charNow, {
      paper: colors.paper,
      ink: colors.ink,
      accent: colors.accent,
    });
    right.group.updateMatrixWorld(true);
    tag.poseTwine(drapeLocal.map((v, i) => right.group.localToWorld(drape[i].copy(v))));

    phone.pose(s.live, s.scan);
    prints.pose(s.fp, s.hash);

    frame(s.shot, rect);
    renderer.render(scene, camera);

    let anchor: Frame["anchor"] = null;
    // The phone and the tag: the leader ends 8px outside the part's right side (toward the callout), level with the
    // lens or the code, so it never crosses the phone or strikes through M4T.
    const beside = (o: THREE.Object3D, at: { x: number; y: number }) => {
      const b = screenBox(o);
      return b ? { x: b.x1 + 8, y: Math.min(b.y1 - 4, Math.max(b.y0 + 4, at.y)) } : at;
    };
    if (s.active === 0) anchor = beside(phone.group, project(phone.lens(P.clone())));
    else if (s.active === 1) anchor = project(prints.corner(new THREE.Vector3()));
    else if (s.active === 3) anchor = beside(tag.mesh, project(tag.codePoint(new THREE.Vector3())));
    else if (s.active === 4) anchor = project(right.rimTop(new THREE.Vector3()));
    return { anchor };
  }

  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  /** An object's projected bounds on the canvas, CSS px. */
  function screenBox(o: THREE.Object3D) {
    box.setFromObject(o);
    if (box.isEmpty()) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const q = project(corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x);
      y1 = Math.max(y1, q.y);
    }
    return { x0, y0, x1, y1 };
  }
  function bounds() {
    const out: {
      name: string;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }[] = [];
    const parts: [string, THREE.Object3D][] = [
      ["left half", left.group],
      ["right half", right.group],
      ["tag", tag.pivot],
      ["phone", phone.group],
      ["prints", prints.group],
    ];
    for (const [name, o] of parts) {
      if (!o.visible) continue;
      const b = screenBox(o);
      if (b) out.push({ name, ...b });
    }
    return out;
  }

  // Warm every shader before the first visible frame, so scrolling in never stalls on a compile.
  await yieldToMain();
  await renderer.compileAsync(scene, camera);

  const px = new Uint8Array(4);
  return {
    render,
    bench(states, rect) {
      const gl = renderer.getContext();
      const t0 = performance.now();
      for (const st of states) render(st, rect);
      // gl.finish() does not block in Chrome's command buffer, so it timed only the JS that queued the draws. Reading
      // a pixel back does block until the GPU has finished them.
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return (performance.now() - t0) / states.length;
    },
    setColors: applyColors,
    setTier: applyTier,
    resize(w, h, dpr) {
      W = Math.max(1, w);
      H = Math.max(1, h);
      renderer.setPixelRatio(Math.min(dpr, tier === 2 ? 1.5 : 1));
      renderer.setSize(W, H, false);
    },
    bounds,
    info() {
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        tier,
        renderer: String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
      };
    },
    dispose() {
      renderer.dispose();
      envRT.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
    },
  };
}
