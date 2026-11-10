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
import { TAG_H, TAG_W, buildPhone, buildPrints, buildTag } from "./parts";
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
  /** Check 1's photo on the phone's screen: its four corners in CSS px of the canvas (top left, top right, bottom right,
   * bottom left) and the scan's strength (0 to 1), for the stage's scan line (scan.ts); null while the phone is down. */
  photo: { quad: [number, number][]; strength: number } | null;
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
  info(): {
    calls: number; triangles: number; tier: Tier; renderer: string;
    phoneView: { renders: number; size: number[]; lensError: number; axisDot: number; samples: { name: string; x: number; y: number; z: number }[] } | null;
  };
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
  const floor: THREE.Mesh<THREE.PlaneGeometry, THREE.Material> = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), floorMat);
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
  const phoneTarget = new THREE.WebGLRenderTarget(384, 512, {
    type: renderer.extensions.has("EXT_color_buffer_float") ? THREE.HalfFloatType : THREE.UnsignedByteType,
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  // A portrait wide rear lens keeps the whole cut product and its nearby tag inside the existing viewfinder.
  const phoneCamera = new THREE.PerspectiveCamera(96, 3 / 4, 0.005, 10);
  // The existing ground plane becomes an opaque neutral surface only in the camera image.
  const phoneFloor = new THREE.MeshStandardMaterial({ color: "#817c75", roughness: 1, envMapIntensity: 0.35 });
  const phone = buildPhone(THREE, phoneTarget.texture);
  scene.add(phone.group);
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
  let tagPaper = colors.paper;
  let tier: Tier = opts.tier;
  let phoneDirty = true;
  let phoneState: ExhibitState | null = null;
  let phoneRenders = 0;
  const phoneForward = new THREE.Vector3();
  const phoneAim = new THREE.Vector3();
  const phoneRotation = new THREE.Quaternion();
  const savedClear = new THREE.Color();
  const phonePoint = new THREE.Vector3();
  const phoneProjection = new THREE.Matrix4();
  const phoneLocalProjection = new THREE.Matrix4();
  function applyColors(c: Colors) {
    colors = c;
    phoneDirty = true;
    // Amber only on the active part's rim (the cut, check 5): a check's one amber is its callout.
    mats.rim.color.set(c.accent);
    if (c.dark) {
      key.intensity = 2.3;
      fill.intensity = 0.32;
      scene.environmentIntensity = 0.55;
      floorMat.opacity = 0.55;
      mats.stuff.color.set("#d8d1c3");
      mats.stuff.emissive.set("#1f1c17");
      mats.cloth.sheenColor.set("#b5adae");
    } else {
      // On the pale floor the near-white stuffing needs its own shading to hold its shape: less fill, a darker grade.
      key.intensity = 2.2;
      fill.intensity = 0.45;
      scene.environmentIntensity = 0.7;
      floorMat.opacity = 0.3;
      mats.stuff.color.set("#d6cdbd");
      mats.stuff.emissive.set("#0d0b08");
      mats.cloth.sheenColor.set("#b7afb0");
    }
    for (const f of mats.fuzz) f.color.copy(mats.stuff.color);
    // The cream tag on the light theme's cream floor: a darker edge, a stronger contact shadow (in render) and paper a
    // shade down, so its outline and M4T hold in the whole-pillow shots.
    tag.edge.color.set(c.dark ? "#b9ad97" : "#8f7f65");
    tagPaper = c.dark ? c.paper : `#${new THREE.Color(c.paper).offsetHSL(0, 0, -0.12).getHexString()}`;
    prints.drawGrid(c.accent, c.faint, c.paper);
  }

  function applyTier(t: Tier) {
    tier = t;
    phoneTarget.setSize(t === 2 ? 384 : 192, t === 2 ? 512 : 256);
    phoneDirty = true;
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

  function renderPhoneView(s: ExhibitState) {
    if (!phone.group.visible) return;
    if (!phoneDirty && phoneState && s.live === phoneState.live && s.cut === phoneState.cut && s.torn === phoneState.torn && s.explode === phoneState.explode && s.code === phoneState.code && s.chars === phoneState.chars && s.charNow === phoneState.charNow) return;
    // A rear camera looks down the phone's +z axis, with its own +y as up. Its position is the actual lens, not
    // the main exhibit camera or an unrelated photograph. The rear preview therefore is not selfie-mirrored.
    phone.lens(phoneCamera.position);
    phone.group.getWorldQuaternion(phoneRotation);
    phoneForward.set(0, 0, 1).applyQuaternion(phoneRotation);
    phoneCamera.up.set(0, 1, 0).applyQuaternion(phoneRotation);
    phoneCamera.lookAt(phoneAim.copy(phoneCamera.position).add(phoneForward));
    phoneCamera.updateMatrixWorld(true);
    // Frame the same view with a sensor crop, rather than rotating the lens or replacing the product with a still.
    // Equal normalized width/height keeps the fixed 3:4 aspect; the source rays and perspective stay unchanged.
    phoneCamera.clearViewOffset();
    phoneProjection.multiplyMatrices(phoneCamera.projectionMatrix, phoneCamera.matrixWorldInverse);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const include = (point: THREE.Vector3) => {
      x0 = Math.min(x0, point.x); y0 = Math.min(y0, point.y);
      x1 = Math.max(x1, point.x); y1 = Math.max(y1, point.y);
    };
    for (const half of [left, right]) {
      half.group.updateMatrixWorld(true);
      const skin = half.group.children[0] as THREE.Mesh<THREE.BufferGeometry>;
      const positions = skin.geometry.getAttribute("position");
      phoneLocalProjection.multiplyMatrices(phoneProjection, skin.matrixWorld);
      // Use the actual curved surface. Projecting a world AABB includes empty corners and shrinks the evidence.
      for (let i = 0; i < positions.count; i++) include(phonePoint.fromBufferAttribute(positions, i).applyMatrix4(phoneLocalProjection));
    }
    for (let i = 0; i < 4; i++) include(tag.mesh.localToWorld(phonePoint.set(((i & 1) - 0.5) * TAG_W, ((i >> 1) - 0.5) * TAG_H, 0)).project(phoneCamera));
    const span = Math.max(x1 - x0, y1 - y0) * 1.16;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    phoneCamera.setViewOffset(768, 1024, ((cx - span / 2 + 1) / 2) * 768, ((1 - cy - span / 2) / 2) * 1024, (span / 2) * 768, (span / 2) * 1024);
    const target = renderer.getRenderTarget();
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(savedClear);
    const phoneVisible = phone.group.visible;
    const printsVisible = prints.group.visible;
    const floorMaterial = floor.material;
    try {
      // Exclude the camera itself and the later photo prints; all product/tag/light objects are the same instances.
      phone.group.visible = false;
      prints.group.visible = false;
      floor.material = phoneFloor;
      renderer.setClearColor(colors.dark ? "#000000" : colors.paper, 1);
      renderer.setRenderTarget(phoneTarget);
      // Three r186 leaves offscreen targets linear and untone-mapped. The phone view's material tone-maps once.
      renderer.render(scene, phoneCamera);
      phoneRenders++;
    } finally {
      renderer.setRenderTarget(target);
      renderer.setClearColor(savedClear, alpha);
      phone.group.visible = phoneVisible;
      prints.group.visible = printsVisible;
      floor.material = floorMaterial;
    }
    phoneState = { ...s };
    phoneDirty = false;
  }

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
    tag.shadow.opacity = (colors.dark ? 0.55 : 0.7) * Math.max(0, 1 - (s.code + s.explode) * 3);
    tag.draw(s.chars, s.charNow, {
      paper: tagPaper,
      ink: colors.ink,
      accent: colors.accent,
    });
    right.group.updateMatrixWorld(true);
    tag.poseTwine(drapeLocal.map((v, i) => right.group.localToWorld(drape[i].copy(v))));

    phone.pose(s.live);
    prints.pose(s.fp, s.hash);
    renderPhoneView(s);

    frame(s.shot, rect);
    renderer.render(scene, camera);

    let anchor: Frame["anchor"] = null;
    // The phone and the tag: the leader ends 8px outside the part's right side (toward the callout), level with the
    // lens or the code, so it never crosses the phone or strikes through M4T. Both are boxed by their own face's four
    // corners: the box round a tilted group (the phone's thickness, the tag's wider contact shadow) ends well to the
    // right of the part itself.
    const beside = (b: ReturnType<typeof quadBox>, at: { x: number; y: number }) => ({ x: b.x1 + 8, y: Math.min(b.y1 - 4, Math.max(b.y0 + 4, at.y)) });
    if (s.active === 0) anchor = beside(quadBox(phone.face()), project(phone.lens(P.clone())));
    else if (s.active === 1) anchor = project(prints.corner(new THREE.Vector3()));
    else if (s.active === 3) anchor = beside(cardBox(), project(tag.codePoint(new THREE.Vector3())));
    else if (s.active === 4) anchor = project(right.rimTop(new THREE.Vector3()));
    const ph = phone.photo();
    const photo = ph && {
      quad: ph.corners.map((v): [number, number] => {
        const q = project(v);
        return [q.x, q.y];
      }),
      strength: ph.strength,
    };
    return { anchor, photo };
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
  /** Projected bounds on the canvas, CSS px, of a few world points (a part's face corners). */
  function quadBox(pts: THREE.Vector3[]) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const v of pts) {
      const q = project(v);
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x);
      y1 = Math.max(y1, q.y);
    }
    return { x0, y0, x1, y1 };
  }
  /** The tag card's projected bounds, from its four corners. */
  function cardBox() {
    tag.mesh.updateMatrixWorld(true);
    return quadBox([0, 1, 2, 3].map((i) => tag.mesh.localToWorld(new THREE.Vector3(((i & 1) - 0.5) * TAG_W, ((i >> 1) - 0.5) * TAG_H, 0))));
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
  // Also warm the linear capture variants before the phone first appears. No extra animation loop is introduced.
  phone.group.visible = false;
  prints.group.visible = false;
  const warmFloorMaterial = floor.material;
  floor.material = phoneFloor;
  renderer.setRenderTarget(phoneTarget);
  try {
    await renderer.compileAsync(scene, phoneCamera);
  } finally {
    renderer.setRenderTarget(null);
    floor.material = warmFloorMaterial;
    phone.group.visible = true;
    prints.group.visible = true;
  }

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
        phoneView: opts.preserve && phoneState && phone.group.visible ? {
          renders: phoneRenders,
          size: [phoneTarget.width, phoneTarget.height],
          lensError: phoneCamera.position.distanceTo(phone.lens(new THREE.Vector3())),
          axisDot: phoneCamera.getWorldDirection(new THREE.Vector3()).dot(phone.group.getWorldDirection(new THREE.Vector3())),
          samples: ([
            ["left cut", left.rimTop(new THREE.Vector3())],
            ["right cut", right.rimTop(new THREE.Vector3())],
            ["tag code", tag.codePoint(new THREE.Vector3())],
            ...[0, 1, 2, 3].map((i): [string, THREE.Vector3] => [
              `tag corner ${i + 1}`,
              tag.mesh.localToWorld(new THREE.Vector3(((i & 1) - 0.5) * TAG_W, ((i >> 1) - 0.5) * TAG_H, 0)),
            ]),
          ] as [string, THREE.Vector3][]).map(([name, point]) => {
            const v = point.project(phoneCamera);
            return { name, x: v.x, y: v.y, z: v.z };
          }),
        } : null,
      };
    },
    dispose() {
      phone.dispose();
      phoneTarget.dispose();
      phoneFloor.dispose();
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
