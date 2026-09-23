import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { loadHDR, analyse } from './env.js';
import { Ground } from './ground.js';
import { Post } from './post.js';
import { LOCATIONS, bearingFromU, MAX_FOCAL } from './locations.js';
import { PAINTS, FINISHES, makePaint, resolvePaint, plateTexture } from './paint.js';
import { buildUI } from './ui.js';

const q = new URLSearchParams(location.search);
const stageEl = document.getElementById('stage');
export const VW = () => stageEl.clientWidth || window.innerWidth, VH = () => stageEl.clientHeight || window.innerHeight;
const BASE = import.meta.env.BASE_URL;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(VW(), VH());
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.shadowMap.autoUpdate = false; // re-rendered only when the car or sun moves
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, VW() / VH(), 0.1, 2000);
camera.filmGauge = 36;

export const state = {
  focal: Math.min(+(q.get('f') ?? 50), MAX_FOCAL), fstop: +(q.get('n') ?? 2.8), ev: +(q.get('ev') ?? 0), grain: +(q.get('grain') ?? 0.3), speed: +(q.get('kmh') ?? 0), previewSamples: +(q.get('ps') ?? 6),
  shutter: 60, vignette: 0.3, focus: 8, focusMode: 'car', dof: q.get('dof') !== '0', loc: q.get('loc') ?? LOCATIONS[0].id,
  bloom: 1, contrast: 1, saturation: 1, temp: 0, tint: 0, look: 'none', aspect: 'free', grid: 'off', dragMode: 'off', dollyZoom: false,
};
camera.setFocalLength(state.focal);
// camera sits where the panorama was shot; the scene axis (base) is where the car goes
export const rig = { camH: +(q.get('h') ?? 1.1), pan: 0, tilt: 0, roll: 0, sceneAngle: 0, base: 0, aimY: 0.6 };
// the car: position in metres along the scene axis, heading relative to the camera (0 = nose to camera)
export const carS = { lat: 0, near: 14, rot: 30, steer: 0, paint: q.get('paint') ?? 'rosso', finish: 'paint', color: null, lights: 'on', brake: false };
const pmrem = new THREE.PMREMGenerator(renderer);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true; const SM_PREVIEW = q.get('sm') ? +q.get('sm') : 2048, SM_EXPORT = q.get('sm') ? +q.get('sm') : 4096;
sun.shadow.mapSize.setScalar(SM_PREVIEW);
sun.shadow.radius = 10; sun.shadow.blurSamples = 20; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(0, 1, 0);
const ground = new Ground(renderer, scene);
const post = new Post(renderer);      // full-res still: DoF, bloom, wheel blur
const postLo = new Post(renderer);    // live preview while things move: CSS-pixel res, no DoF/bloom
let dirty = true, lastChange = 0, hiDone = false, lastSig = '';
export function markDirty() { dirty = true; }
function setShadowSize(n) { if (sun.shadow.mapSize.x === n) return; sun.shadow.mapSize.setScalar(n); sun.shadow.map?.dispose(); sun.shadow.map = null; }
const carHolder = new THREE.Group(); scene.add(carHolder);
const backdropMeta = fetch(`${BASE}assets/backdrop/backdrops.json`).then(r => r.json()).catch(() => ({}));
let sky = null, car = null, carRadius = 3, paintSlots = [];

export async function setLocation(id, { keepCar = false } = {}) {
  const L = LOCATIONS.find(l => l.id === id) || LOCATIONS[0];
  state.loc = L.id;
  const hdr = await loadHDR(`${BASE}assets/hdri/${L.id}_2k.hdr`);
  if (state.loc !== L.id) return;
  const info = analyse(hdr);
  const envRT = pmrem.fromEquirectangular(info.envTex); info.envTex.dispose();
  const oldEnv = scene.environment; scene.environment = envRT.texture; oldEnv?.dispose?.();
  if (sky) { scene.remove(sky); sky.geometry.dispose(); sky.material.map?.dispose(); }
  sky = new GroundedSkybox(hdr, L.height, 400, 256);
  sky.material.depthWrite = true; sky.renderOrder = -1; sky.position.y = L.height;
  scene.add(sky); renderer.shadowMap.needsUpdate = true; markDirty();
  sun.visible = info.hasSun;
  sun.color.setRGB(info.sunColor.x, info.sunColor.y, info.sunColor.z, THREE.LinearSRGBColorSpace);
  sun.intensity = info.sunIntensity; sunDir.copy(info.sunDir);
  ground.sunShare = info.sunShare;
  rig.base0 = bearingFromU(L.u); if (!keepCar) { rig.sceneAngle = 0; rig.pan = 0; rig.tilt = 0; rig.roll = 0; carS.lat = 0; frame(); }
  window.__env = { id: L.id, hasSun: info.hasSun, sunShare: +info.sunShare.toFixed(3), sunDir: info.sunDir.toArray().map(v => +v.toFixed(3)), sunI: +info.sunIntensity.toFixed(1), skyE: +info.skyLum.toFixed(1), groundL: +info.groundL.toFixed(3),
    impliedAlbedo: +(Math.PI * info.groundL / (info.sunIntensity * Math.max(info.sunDir.y, 0) + info.skyLum)).toFixed(3) };
  console.log('env', JSON.stringify(window.__env));
  window.__hi = false;
  // sharp backdrop: 8k LDR photo (4k on small GPUs / phones), HDR still lights the car
  const big = renderer.capabilities.maxTextureSize >= 8192 && !matchMedia('(max-width: 820px)').matches;
  if (!q.has('lo')) Promise.all([backdropMeta, new THREE.TextureLoader().loadAsync(`${BASE}assets/backdrop/${L.id}_${big ? '8k' : '4k'}.jpg`)]).then(([meta, tex]) => {
    if (!(sky && state.loc === L.id)) { tex.dispose(); return; }
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.generateMipmaps = true;
    const old = sky.material.map; sky.material.map = tex; sky.material.color.setScalar(meta[L.id]?.white ?? 1); sky.material.needsUpdate = true; old.dispose(); window.__hi = true; markDirty();
  });
}

export function setPaint(id) { if (id) carS.paint = id; applyPaint(); }
export function applyPaint() {
  const p = resolvePaint(carS.paint, carS.finish, carS.color);
  for (const s of paintSlots) { s.mesh.material.dispose?.(); s.mesh.material = makePaint(p, s.original); }
  markDirty();
}
let lightMats = { head: [], tail: [] };
export function applyLights() {
  const head = { off: 0, on: 1.6, high: 7 }[carS.lights] ?? 1, tail = carS.brake ? 6 : (carS.lights === 'off' ? 0 : 1);
  for (const m of lightMats.head) m.emissiveIntensity = head;
  for (const m of lightMats.tail) m.emissiveIntensity = tail;
  markDirty();
}

async function loadCar() {
  const gltf = await new GLTFLoader().loadAsync(`${BASE}assets/cars/CarConcept.glb`);
  car = gltf.scene; car.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(car, true);
  // sit on the tyres (not on whatever hangs lowest), with a hair of tyre squash
  const tyres = new THREE.Box3();
  car.traverse(o => { if (/^Wheel(Front|Rear)[LR]$/.test(o.name)) tyres.union(new THREE.Box3().setFromObject(o, true)); });
  console.log('minY body', box.min.y.toFixed(3), 'tyres', tyres.min.y.toFixed(3));
  car.position.y -= (tyres.isEmpty() ? box.min.y : tyres.min.y) + 0.006;
  const size = box.getSize(new THREE.Vector3()); carRadius = size.length() / 2;
  const plate = plateTexture(); plate.flipY = false;
  car.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const n = o.material.name || '';
    if (/^Paint 1/.test(n)) paintSlots.push({ mesh: o, original: o.material });
    if (n === 'License') { o.material = o.material.clone(); o.material.map = plate; o.material.needsUpdate = true; }
    // rubber: the source file has glossy sidewalls (0.4) that mirror warm skies as tan
    if (n === 'Tireside') { o.material = o.material.clone(); o.material.roughness = 0.82; o.material.envMapIntensity = 0.75; }
    if (n === 'Tiretread') { o.material = o.material.clone(); o.material.roughness = 0.9; o.material.envMapIntensity = 0.7; }
    if (n === 'Headlight') { o.material = o.material.clone(); lightMats.head.push(o.material); }
    if (n === 'Brakelight') { o.material = o.material.clone(); lightMats.tail.push(o.material); }
    if (/^Paint 2/.test(n)) { o.material = o.material.clone(); o.material.normalMap = null; o.material.clearcoat = 0.6; o.material.clearcoatRoughness = 0.08; o.material.roughness = 0.45; }
  });
  carHolder.add(car);
  if (q.has('dbg')) car.traverse(o => { if (/^Wheel(Front|Rear)[LR]$/.test(o.name)) { const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.25, 24), new THREE.MeshBasicMaterial({ color: 0x00ff00 })); d.rotation.x = -Math.PI / 2; d.position.set(c.x, 0.003 - car.position.y, c.z); car.add(d); } });
  if (q.has('nosun')) sun.intensity = 0;
  applyPaint(); applyLights();
  buildWheels();
  ground.bake(car);
}

// Spinning wheel parts (rim, tyre, disc) get a pivot at the hub so they can
// rotate about the axle; calipers stay put.
let wheels = [], steers = [], noseSign = 1;
function buildWheels() {
  wheels = []; steers = []; car.updateMatrixWorld(true);
  const invCar = new THREE.Matrix4().copy(car.matrixWorld).invert(); let fz = 0, rz = 0;
  const axleW = new THREE.Vector3(1, 0, 0).transformDirection(car.matrixWorld);
  car.traverse(o => {
    if (!/^Wheel(Front|Rear)[LR]$/.test(o.name)) return;
    const spin = o.children.filter(c => !/BrakePad/.test(c.name));
    const bb = new THREE.Box3(); spin.forEach(c => bb.union(new THREE.Box3().setFromObject(c, true)));
    const cW = bb.getCenter(new THREE.Vector3()), radius = (bb.max.y - bb.min.y) / 2;
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const pivot = new THREE.Group(); pivot.position.copy(cW).applyMatrix4(inv); o.add(pivot); pivot.updateMatrixWorld(true);
    spin.forEach(c => pivot.attach(c));
    const axis = axleW.clone().transformDirection(inv).normalize();
    wheels.push({ pivot, axis, radius, base: pivot.quaternion.clone() });
    const cCar = cW.clone().applyMatrix4(invCar); if (/Front/.test(o.name)) fz += cCar.z; else rz += cCar.z;
    if (/Front/.test(o.name)) {
      // steering: turn the whole front corner (tyre, rim, caliper) about a vertical axis through the hub
      const P = o.parent; P.updateMatrixWorld(true); const invP = new THREE.Matrix4().copy(P.matrixWorld).invert();
      const st = new THREE.Group(); st.position.copy(cW).applyMatrix4(invP); P.add(st); st.updateMatrixWorld(true); st.attach(o);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(car.matrixWorld).transformDirection(invP).normalize();
      steers.push({ g: st, up, base: st.quaternion.clone() });
    }
  });
  noseSign = fz > rz ? 1 : -1;
}
function applySteer() { for (const s of steers) s.g.quaternion.copy(s.base).multiply(_q.setFromAxisAngle(s.up, THREE.MathUtils.degToRad(carS.steer))); }
const _q = new THREE.Quaternion();
function spinWheels(t) {
  // t in [-0.5, 0.5] of the shutter; angle = v / r * shutter * t (rolling forward)
  const v = state.speed / 3.6, sh = 1 / state.shutter;
  for (const w of wheels) { _q.setFromAxisAngle(w.axis, v / w.radius * sh * t); w.pivot.quaternion.copy(w.base).multiply(_q); }
}
const subframe = t => spinWheels(t);

function frame() {
  const vfov = 2 * Math.atan(camera.getFilmHeight() / 2 / camera.getFocalLength());
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * VW() / VH());
  carS.near = +(q.get('dist') ?? (carRadius * (VW() < VH() ? 1.15 : 0.95) / Math.tan(Math.min(vfov, hfov) / 2)));
  if (q.has('yaw')) carS.rot = +q.get('yaw');
}

export function setFocal(mm, { dolly = state.dollyZoom } = {}) {
  const k = mm / state.focal; state.focal = mm; camera.setFocalLength(mm);
  if (dolly) carS.near = THREE.MathUtils.clamp(carS.near * k, 3, 120); // dolly zoom: car keeps its size, background compresses
}
export const carPos = new THREE.Vector3();
function computeCar() {
  const b = rig.base0 + THREE.MathUtils.degToRad(rig.sceneAngle); rig.base = b;
  const fx = -Math.sin(b), fz = -Math.cos(b), rx = Math.cos(b), rz = -Math.sin(b);
  carPos.set(fx * carS.near + rx * carS.lat, 0, fz * carS.near + rz * carS.lat);
}
export function carDistance() { computeCar(); return Math.hypot(carPos.x, rig.camH - rig.aimY, carPos.z); }
export function frameCar() { // aim the camera straight at the car
  computeCar(); const toCar = Math.atan2(-carPos.x, -carPos.z); let d = THREE.MathUtils.radToDeg(toCar - rig.base); d = ((d + 540) % 360) - 180; rig.pan = +d.toFixed(1); rig.tilt = 0;
}
function applyRig() {
  const L = LOCATIONS.find(l => l.id === state.loc); rig.camH = THREE.MathUtils.clamp(rig.camH, 0.25, L.height);
  computeCar(); const cx = carPos.x, cz = carPos.z;
  const toCam = Math.atan2(noseSign * -cx, noseSign * -cz);
  carHolder.position.set(cx, 0, cz); carHolder.rotation.y = toCam + THREE.MathUtils.degToRad(carS.rot);
  applySteer();
  camera.position.set(0, rig.camH, 0);
  const autoPitch = Math.atan2(rig.aimY - rig.camH, Math.hypot(cx, cz));
  camera.rotation.set(autoPitch + THREE.MathUtils.degToRad(rig.tilt), rig.base + THREE.MathUtils.degToRad(rig.pan), THREE.MathUtils.degToRad(rig.roll), 'YXZ');
  if (state.focusMode === 'car') state.focus = carDistance();
  ground.setCarTransform(carHolder);
  sun.target.position.set(cx, 0, cz); sun.position.set(cx, 0, cz).addScaledVector(sunDir, 20);
  const s = sun.shadow.camera; if (s.right !== 7) { Object.assign(s, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 50 }); s.updateProjectionMatrix(); }
}
const ASPECTS = { free: 0, '3:2': 3 / 2, '16:9': 16 / 9, '1:1': 1, '4:5': 4 / 5, '21:9': 21 / 9, '2:3': 2 / 3, '9:16': 9 / 16 };
export function cropRect(W = VW(), H = VH()) {
  const a = ASPECTS[state.aspect]; if (!a) return { x: 0, y: 0, w: W, h: H };
  let w = W, h = W / a; if (h > H) { h = H; w = H * a; }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

function resize() {
  renderer.setSize(VW(), VH());
  camera.aspect = VW() / VH(); camera.updateProjectionMatrix();
  const pr = renderer.getPixelRatio();
  post.setSize(Math.floor(VW() * pr), Math.floor(VH() * pr));
  const lo = Math.min(1, 1600 / Math.max(VW(), VH()));
  postLo.setSize(Math.floor(VW() * lo), Math.floor(VH() * lo));
  markDirty();
}
addEventListener('resize', resize); new ResizeObserver(() => resize()).observe(stageEl);

export async function exportPhoto(longEdge = 3840) {
  const cr = cropRect(), aspect = cr.w / cr.h;
  const w = aspect >= 1 ? longEdge : Math.round(longEdge * aspect), h = aspect >= 1 ? Math.round(longEdge / aspect) : longEdge;
  const out = new THREE.WebGLRenderTarget(w, h);
  const [pw, ph] = [post.w, post.h];
  if (state.aspect !== 'free') camera.setViewOffset(VW(), VH(), cr.x, cr.y, cr.w, cr.h);
  post.setSize(w, h); setShadowSize(SM_EXPORT); applyRig(); renderer.shadowMap.needsUpdate = true;
  post.render(scene, camera, { ...state, sensorScale: cr.h / VH(), quality: 'export', animateGrain: false, subframe: state.speed > 0 ? subframe : null }, out);
  camera.clearViewOffset();
  const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(out, 0, 0, w, h, px);
  out.dispose(); post.setSize(pw, ph); setShadowSize(SM_PREVIEW); renderer.shadowMap.needsUpdate = true; markDirty(); hiDone = false;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(img, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
  return { blob, w, h };
}

// canvas input: nothing moves by accident. Tap = focus there. Pinch / ctrl-scroll = zoom.
// Dragging only does something when the user picks a drag mode (rotate or move) in the CAR tab.
// Keys: Q/E turn 15deg (shift 1deg), arrows nudge the car, [ ] zoom.
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const el = renderer.domElement; const pointers = new Map(); let drag = null;
el.addEventListener('contextmenu', e => e.preventDefault());
el.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, moved: false, rot: carS.rot, lat: carS.lat, near: carS.near, focal: state.focal,
    pinch: pointers.size === 2 ? [...pointers.values()].reduce((a, p, i, arr) => i ? Math.hypot(p.x - arr[0].x, p.y - arr[0].y) : 0, 0) : 0 };
});
el.addEventListener('pointermove', e => {
  if (!drag) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 5) drag.moved = true; if (!drag.moved) return;
  if (pointers.size === 2 && drag.pinch) { const [a, b] = [...pointers.values()]; setFocal(THREE.MathUtils.clamp(drag.focal * Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch, 18, MAX_FOCAL)); ui?.sync(); return; }
  if (state.dragMode === 'rotate') { carS.rot = ((drag.rot + dx * 0.4) % 360 + 360) % 360; ui?.sync(); }
  else if (state.dragMode === 'move') {
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2) * drag.near / VH();
    carS.lat = THREE.MathUtils.clamp(drag.lat + dx * k, -25, 25); carS.near = THREE.MathUtils.clamp(drag.near - dy * k * 3, 3, 120); ui?.sync();
  }
});
const endDrag = e => {
  pointers.delete(e.pointerId);
  if (drag && !drag.moved && e.type === 'pointerup') { ndc.set(e.clientX / VW() * 2 - 1, -(e.clientY / VH()) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([carHolder, ground.catcher, sky].filter(Boolean), true);
    if (hits.length) { state.focusMode = 'manual'; state.focus = +hits[0].distance.toFixed(2); ui?.focusPing(e.clientX, e.clientY); ui?.sync(); } }
  if (!pointers.size) drag = null;
};
el.addEventListener('pointerup', endDrag); el.addEventListener('pointercancel', endDrag);
el.addEventListener('wheel', e => {
  e.preventDefault(); if (!e.ctrlKey) return; // plain scroll never changes anything; trackpad pinch = zoom
  setFocal(THREE.MathUtils.clamp(state.focal * Math.exp(-e.deltaY * 0.01), 18, MAX_FOCAL)); ui?.sync();
}, { passive: false });
addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, select') || document.body.classList.contains('in-menu')) return;
  const k = e.key.toLowerCase(), r = e.shiftKey ? 1 : 15, m = e.shiftKey ? 0.02 : 0.1;
  if (k === 'q') carS.rot = ((Math.round(carS.rot / r) * r + r) % 360 + 360) % 360;
  else if (k === 'e') carS.rot = ((Math.round(carS.rot / r) * r - r) % 360 + 360) % 360;
  else if (k === 'arrowleft') carS.lat -= m; else if (k === 'arrowright') carS.lat += m;
  else if (k === 'arrowup') carS.near += m * 2.5; else if (k === 'arrowdown') carS.near = Math.max(3, carS.near - m * 2.5);
  else if (k === '[') setFocal(Math.max(18, state.focal / 1.06)); else if (k === ']') setFocal(Math.min(MAX_FOCAL, state.focal * 1.06));
  else return;
  e.preventDefault(); ui?.sync();
});

let ui = null;
await Promise.all([setLocation(state.loc), loadCar()]);
resize(); frame();
ui = buildUI({ state, rig, carS, setLocation, setPaint, applyPaint, applyLights, setFocal, exportPhoto, frameCar, carDistance, cropRect, markDirty, LOCATIONS, PAINTS, FINISHES });
// Render on demand, GT7-style: a light preview while anything moves, then one
// full-quality still once it settles. Nothing is drawn while the scene is idle.
function signature() { return JSON.stringify([rig, carS, state]) + VW() + 'x' + VH(); }
let lastCarSig = '';
function loop(now) {
  requestAnimationFrame(loop);
  const sig = signature(); if (sig !== lastSig) { lastSig = sig; dirty = true; }
  if (dirty) {
    dirty = false; lastChange = now; hiDone = false; applyRig();
    const carSig = [carS.lat, carS.near, carS.rot, carS.steer, rig.sceneAngle, state.loc].join('|'); if (carSig !== lastCarSig) { if (lastCarSig.split('|')[3] !== String(carS.steer)) rebake(); lastCarSig = carSig; renderer.shadowMap.needsUpdate = true; }
    const t0 = performance.now(); postLo.render(scene, camera, { ...state, dof: false, bloomOff: true, animateGrain: false, subframe: null });
    if (PERF) { renderer.getContext().finish(); PERF.lo.push(performance.now() - t0); }
  } else if (!hiDone && !(drag && drag.moved) && now - lastChange > 450) {
    hiDone = true; applyRig();
    const t0 = performance.now(); post.render(scene, camera, { ...state, animateGrain: false, subframe: state.speed > 0 ? subframe : null });
    if (PERF) { renderer.getContext().finish(); PERF.hi.push(performance.now() - t0); }
  }
}
let bakeT = 0; function rebake() { clearTimeout(bakeT); bakeT = setTimeout(() => { applySteer(); ground.bake(car); markDirty(); }, 150); }
const PERF = q.has('perf') ? (window.__perf = { lo: [], hi: [] }) : null;
requestAnimationFrame(loop);
document.body.classList.add('ready');
window.halide = { markDirty, state, rig, carS, exportPhoto, setLocation, setPaint, setFocal, frameCar, car, carHolder, THREE, camera, sun, scene };
setTimeout(() => { window.__ready = true; }, 500);
