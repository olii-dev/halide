import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { loadHDR, analyse } from './env.js';
import { Ground } from './ground.js';
import { Post } from './post.js';
import { LOCATIONS, bearingFromU, MAX_FOCAL } from './locations.js';
import { PAINTS, makePaint, plateTexture } from './paint.js';
import { buildUI } from './ui.js';

const q = new URLSearchParams(location.search);
const BASE = import.meta.env.BASE_URL;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.shadowMap.autoUpdate = false; // re-rendered only when the car or sun moves
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 2000);
camera.filmGauge = 36;

export const state = {
  focal: Math.min(+(q.get('f') ?? 50), MAX_FOCAL), fstop: +(q.get('n') ?? 2.8), ev: +(q.get('ev') ?? 0), grain: +(q.get('grain') ?? 0.3), speed: +(q.get('kmh') ?? 0), previewSamples: +(q.get('ps') ?? 6),
  vignette: 0.3, focus: 8, dof: q.get('dof') !== '0', loc: q.get('loc') ?? LOCATIONS[0].id, paint: q.get('paint') ?? 'rosso',
};
camera.setFocalLength(state.focal);
const rig = { camH: +(q.get('h') ?? 1.1), carDist: 14, carYaw: 0, carBearing: 0, aimY: 0.6 };

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
  if (!keepCar) { rig.carBearing = bearingFromU(L.u); rig.carYaw = rig.carBearing + THREE.MathUtils.degToRad(25); frame(); }
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

export function setPaint(id) {
  const p = PAINTS.find(x => x.id === id) || PAINTS[0]; state.paint = p.id;
  for (const s of paintSlots) { s.mesh.material = makePaint(p, s.original); }
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
    if (/^Paint 2/.test(n)) { o.material = o.material.clone(); o.material.normalMap = null; o.material.clearcoat = 0.6; o.material.clearcoatRoughness = 0.08; o.material.roughness = 0.45; }
  });
  carHolder.add(car);
  if (q.has('dbg')) car.traverse(o => { if (/^Wheel(Front|Rear)[LR]$/.test(o.name)) { const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.25, 24), new THREE.MeshBasicMaterial({ color: 0x00ff00 })); d.rotation.x = -Math.PI / 2; d.position.set(c.x, 0.003 - car.position.y, c.z); car.add(d); } });
  if (q.has('nosun')) sun.intensity = 0;
  setPaint(state.paint);
  ground.bake(car);
  buildWheels();
}

// Spinning wheel parts (rim, tyre, disc) get a pivot at the hub so they can
// rotate about the axle; calipers stay put.
let wheels = [];
function buildWheels() {
  wheels = []; car.updateMatrixWorld(true);
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
  });
}
const _q = new THREE.Quaternion();
function spinWheels(t) {
  // t in [-0.5, 0.5] of the shutter; angle = v / r * shutter * t (rolling forward)
  const v = state.speed / 3.6, sh = 1 / 60;
  for (const w of wheels) { _q.setFromAxisAngle(w.axis, v / w.radius * sh * t); w.pivot.quaternion.copy(w.base).multiply(_q); }
}
const subframe = t => spinWheels(t);

function frame() {
  const vfov = 2 * Math.atan(camera.getFilmHeight() / 2 / camera.getFocalLength());
  rig.carDist = +(q.get('dist') ?? (carRadius * 0.95 / Math.tan(vfov / 2)));
  if (q.has('bearing')) rig.carBearing = +q.get('bearing') * Math.PI / 180;
  if (q.has('yaw')) rig.carYaw = rig.carBearing + +q.get('yaw') * Math.PI / 180;
  state.focus = rig.carDist;
}

export function setFocal(mm, { dolly = true } = {}) {
  // zoom like a photographer: keep the car the same size, change compression
  const k = mm / state.focal; state.focal = mm; camera.setFocalLength(mm);
  if (dolly) { rig.carDist = THREE.MathUtils.clamp(rig.carDist * k, 4, 150); state.focus = rig.carDist; }
}

function applyRig() {
  const L = LOCATIONS.find(l => l.id === state.loc); rig.camH = THREE.MathUtils.clamp(rig.camH, 0.25, L.height);
  const cx = -Math.sin(rig.carBearing) * rig.carDist, cz = -Math.cos(rig.carBearing) * rig.carDist;
  carHolder.position.set(cx, 0, cz); carHolder.rotation.y = rig.carYaw;
  camera.position.set(0, rig.camH, 0);
  camera.lookAt(cx, rig.aimY, cz);
  ground.setCarTransform(carHolder);
  sun.target.position.set(cx, 0, cz); sun.position.set(cx, 0, cz).addScaledVector(sunDir, 20);
  const s = sun.shadow.camera; if (s.right !== 7) { Object.assign(s, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 50 }); s.updateProjectionMatrix(); }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const pr = renderer.getPixelRatio();
  post.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
  const lo = Math.min(1, 1600 / Math.max(innerWidth, innerHeight));
  postLo.setSize(Math.floor(innerWidth * lo), Math.floor(innerHeight * lo));
  markDirty();
}
addEventListener('resize', resize);

export async function exportPhoto(longEdge = 3840) {
  const aspect = innerWidth / innerHeight;
  const w = aspect >= 1 ? longEdge : Math.round(longEdge * aspect), h = aspect >= 1 ? Math.round(longEdge / aspect) : longEdge;
  const out = new THREE.WebGLRenderTarget(w, h);
  const [pw, ph] = [post.w, post.h];
  post.setSize(w, h); setShadowSize(SM_EXPORT); applyRig(); renderer.shadowMap.needsUpdate = true;
  post.render(scene, camera, { ...state, quality: 'export', animateGrain: false, subframe: state.speed > 0 ? subframe : null }, out);
  const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(out, 0, 0, w, h, px);
  out.dispose(); post.setSize(pw, ph); setShadowSize(SM_PREVIEW); renderer.shadowMap.needsUpdate = true; markDirty(); hiDone = false;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(img, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
  return { blob, w, h };
}

// input (GT7-ish, works on a Mac trackpad without right-click):
//   drag the car = move it (it stays under your finger), drag anywhere else = turn it,
//   two-finger swipe sideways = turn, pinch / scroll = focal length, tap = focus,
//   Q/E or arrow keys = turn, two-finger touch = turn + pinch zoom
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
const el = renderer.domElement; const pointers = new Map(); let drag = null;
function groundAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; }
function onCar(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObject(carHolder, true).length > 0; }
el.addEventListener('contextmenu', e => e.preventDefault());
el.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture(e.pointerId);
  const grab = pointers.size === 1 && !e.shiftKey && e.button !== 2 && onCar(e.clientX, e.clientY);
  const g = grab ? groundAt(e.clientX, e.clientY) : null;
  drag = { x: e.clientX, y: e.clientY, moved: false, turn: !grab, yaw: rig.carYaw, focal: state.focal,
    off: g ? new THREE.Vector3(carHolder.position.x - g.x, 0, carHolder.position.z - g.z) : null,
    pinch: pointers.size === 2 ? [...pointers.values()].reduce((a, p, i, arr) => i ? Math.hypot(p.x - arr[0].x, p.y - arr[0].y) : 0, 0) : 0 };
  el.style.cursor = grab ? 'grabbing' : 'ew-resize';
});
el.addEventListener('pointermove', e => {
  if (!drag) { el.style.cursor = onCar(e.clientX, e.clientY) ? 'grab' : 'default'; return; }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) drag.moved = true; if (!drag.moved) return;
  if (pointers.size === 2 && drag.pinch) { const [a, b] = [...pointers.values()]; setFocal(THREE.MathUtils.clamp(drag.focal * Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch, 18, MAX_FOCAL)); rig.carYaw = drag.yaw + dx * 0.006; ui?.sync(); return; }
  if (drag.turn) { rig.carYaw = drag.yaw + dx * 0.01; return; }
  const g = groundAt(e.clientX, e.clientY); if (!g) return;
  const x = g.x + drag.off.x, z = g.z + drag.off.z, d = THREE.MathUtils.clamp(Math.hypot(x, z), 4, 150);
  const yawRel = rig.carYaw - rig.carBearing; // keep the car's angle to camera as it slides
  rig.carBearing = Math.atan2(-x, -z); rig.carDist = d; rig.carYaw = rig.carBearing + yawRel; state.focus = d;
});
const endDrag = e => {
  pointers.delete(e.pointerId);
  if (drag && !drag.moved && e.type === 'pointerup') { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([carHolder, ground.catcher, sky].filter(Boolean), true);
    if (hits.length) { state.focus = hits[0].distance; ui?.focusPing(e.clientX, e.clientY); } }
  if (!pointers.size) { drag = null; el.style.cursor = 'default'; }
};
el.addEventListener('pointerup', endDrag); el.addEventListener('pointercancel', endDrag);
el.addEventListener('wheel', e => {
  e.preventDefault();
  if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { rig.carYaw -= e.deltaX * 0.006; return; } // trackpad swipe sideways
  const k = e.ctrlKey ? 0.01 : 0.0012; // ctrl+wheel = Mac pinch
  setFocal(THREE.MathUtils.clamp(state.focal * Math.exp(-e.deltaY * k), 18, MAX_FOCAL)); ui?.sync();
}, { passive: false });
addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea')) return;
  const k = e.key.toLowerCase(), step = e.shiftKey ? 0.2 : 0.06;
  if (k === 'q' || k === 'arrowleft') rig.carYaw += step; else if (k === 'e' || k === 'arrowright') rig.carYaw -= step;
});

let ui = null;
await Promise.all([setLocation(state.loc), loadCar()]);
resize(); frame();
ui = buildUI({ state, rig, setLocation, setPaint, setFocal, exportPhoto, LOCATIONS, PAINTS });
// Render on demand, GT7-style: a light preview while anything moves, then one
// full-quality still once it settles. Nothing is drawn while the scene is idle.
function signature() { return [rig.camH, rig.carDist, rig.carYaw, rig.carBearing, state.focal, state.fstop, state.ev, state.grain, state.speed, state.focus, state.dof, state.loc, state.paint, innerWidth, innerHeight].join('|'); }
let lastCarSig = '';
function loop(now) {
  requestAnimationFrame(loop);
  const sig = signature(); if (sig !== lastSig) { lastSig = sig; dirty = true; }
  if (dirty) {
    dirty = false; lastChange = now; hiDone = false; applyRig();
    const carSig = [rig.carDist, rig.carYaw, rig.carBearing, state.loc].join('|'); if (carSig !== lastCarSig) { lastCarSig = carSig; renderer.shadowMap.needsUpdate = true; }
    const t0 = performance.now(); postLo.render(scene, camera, { ...state, dof: false, bloomOff: true, animateGrain: false, subframe: null });
    if (PERF) { renderer.getContext().finish(); PERF.lo.push(performance.now() - t0); }
  } else if (!hiDone && now - lastChange > 220) {
    hiDone = true; applyRig();
    const t0 = performance.now(); post.render(scene, camera, { ...state, animateGrain: false, subframe: state.speed > 0 ? subframe : null });
    if (PERF) { renderer.getContext().finish(); PERF.hi.push(performance.now() - t0); }
  }
}
const PERF = q.has('perf') ? (window.__perf = { lo: [], hi: [] }) : null;
requestAnimationFrame(loop);
document.body.classList.add('ready');
window.halide = { markDirty, state, rig, exportPhoto, setLocation, setPaint, setFocal, car, carHolder, THREE, camera, sun, scene };
setTimeout(() => { window.__ready = true; }, 500);
