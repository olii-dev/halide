import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { loadHDR, analyse } from './env.js';
import { Ground } from './ground.js';
import { Post } from './post.js';
import { LOCATIONS, bearingFromU } from './locations.js';
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
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 2000);
camera.filmGauge = 36;

export const state = {
  focal: +(q.get('f') ?? 50), fstop: +(q.get('n') ?? 2.8), ev: +(q.get('ev') ?? 0), grain: +(q.get('grain') ?? 0.3),
  vignette: 0.3, focus: 8, dof: q.get('dof') !== '0', loc: q.get('loc') ?? LOCATIONS[0].id, paint: q.get('paint') ?? 'rosso',
};
camera.setFocalLength(state.focal);
const rig = { camH: +(q.get('h') ?? 1.1), carDist: 14, carYaw: 0, carBearing: 0, aimY: 0.6 };

const pmrem = new THREE.PMREMGenerator(renderer);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true; sun.shadow.mapSize.setScalar(q.get('sm') ? +q.get('sm') : 4096);
sun.shadow.radius = 10; sun.shadow.blurSamples = 20; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(0, 1, 0);
const ground = new Ground(renderer, scene);
const post = new Post(renderer);
const carHolder = new THREE.Group(); scene.add(carHolder);
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
  scene.add(sky);
  sun.visible = info.hasSun;
  sun.color.setRGB(info.sunColor.x, info.sunColor.y, info.sunColor.z, THREE.LinearSRGBColorSpace);
  sun.intensity = info.sunIntensity; sunDir.copy(info.sunDir);
  ground.sunShare = info.sunShare;
  if (!keepCar) { rig.carBearing = bearingFromU(L.u); rig.carYaw = rig.carBearing + THREE.MathUtils.degToRad(25); frame(); }
  window.__env = { id: L.id, hasSun: info.hasSun, sunShare: +info.sunShare.toFixed(3), sunDir: info.sunDir.toArray().map(v => +v.toFixed(3)) };
  console.log('env', JSON.stringify(window.__env));
  window.__hi = false;
  if (!q.has('lo')) loadHDR(`${BASE}assets/hdri/${L.id}_4k.hdr`).then(hi => {
    if (sky && state.loc === L.id) { const old = sky.material.map; sky.material.map = hi; sky.material.needsUpdate = true; old.dispose(); window.__hi = true; } else hi.dispose();
  });
}

export function setPaint(id) {
  const p = PAINTS.find(x => x.id === id) || PAINTS[0]; state.paint = p.id;
  for (const s of paintSlots) { s.mesh.material = makePaint(p, s.original); }
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
    if (/^Paint 2/.test(n)) { o.material = o.material.clone(); o.material.normalMap = null; o.material.clearcoat = 0.6; o.material.clearcoatRoughness = 0.08; o.material.roughness = 0.45; }
  });
  carHolder.add(car);
  if (q.has('dbg')) car.traverse(o => { if (/^Wheel(Front|Rear)[LR]$/.test(o.name)) { const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.25, 24), new THREE.MeshBasicMaterial({ color: 0x00ff00 })); d.rotation.x = -Math.PI / 2; d.position.set(c.x, 0.003 - car.position.y, c.z); car.add(d); } });
  if (q.has('nosun')) sun.intensity = 0;
  setPaint(state.paint);
  ground.bake(car);
}

function frame() {
  const vfov = 2 * Math.atan(camera.getFilmHeight() / 2 / camera.getFocalLength());
  rig.carDist = +(q.get('dist') ?? (carRadius * 1.3 / Math.tan(vfov / 2)));
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
}
addEventListener('resize', resize);

export async function exportPhoto(longEdge = 3840) {
  const aspect = innerWidth / innerHeight;
  const w = aspect >= 1 ? longEdge : Math.round(longEdge * aspect), h = aspect >= 1 ? Math.round(longEdge / aspect) : longEdge;
  const out = new THREE.WebGLRenderTarget(w, h);
  const [pw, ph] = [post.w, post.h];
  post.setSize(w, h); applyRig();
  post.render(scene, camera, { ...state, quality: 'export', animateGrain: false }, out);
  const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(out, 0, 0, w, h, px);
  out.dispose(); post.setSize(pw, ph);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(img, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
  return { blob, w, h };
}

// input: drag = move car, shift/right-drag or two fingers = turn car,
// wheel/pinch = focal length, tap = focus point
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
const el = renderer.domElement; const pointers = new Map(); let drag = null;
el.addEventListener('contextmenu', e => e.preventDefault());
el.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, moved: false, turn: e.shiftKey || e.button === 2 || pointers.size > 1, yaw: rig.carYaw, focal: state.focal,
    pinch: pointers.size === 2 ? [...pointers.values()].reduce((a, p, i, arr) => i ? Math.hypot(p.x - arr[0].x, p.y - arr[0].y) : 0, 0) : 0 };
});
el.addEventListener('pointermove', e => {
  if (!drag) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 5) drag.moved = true; if (!drag.moved) return;
  if (pointers.size === 2 && drag.pinch) { const [a, b] = [...pointers.values()]; setFocal(THREE.MathUtils.clamp(drag.focal * Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch, 18, 400)); ui?.sync(); return; }
  if (drag.turn) { rig.carYaw = drag.yaw + dx * 0.008; return; }
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(plane, hit)) { const d = Math.hypot(hit.x, hit.z); if (d > 4 && d < 150) { rig.carDist = d; rig.carBearing = Math.atan2(-hit.x, -hit.z); state.focus = d; } }
});
el.addEventListener('pointerup', e => {
  pointers.delete(e.pointerId);
  if (drag && !drag.moved) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([carHolder, ground.catcher, sky].filter(Boolean), true);
    if (hits.length) { state.focus = hits[0].distance; ui?.focusPing(e.clientX, e.clientY); } }
  if (!pointers.size) drag = null;
});
el.addEventListener('wheel', e => { e.preventDefault(); setFocal(THREE.MathUtils.clamp(state.focal * Math.exp(-e.deltaY * 0.0012), 18, 400)); ui?.sync(); }, { passive: false });

let ui = null;
await Promise.all([setLocation(state.loc), loadCar()]);
resize(); frame();
ui = buildUI({ state, rig, setLocation, setPaint, setFocal, exportPhoto, LOCATIONS, PAINTS });
function loop() { applyRig(); post.render(scene, camera, { ...state, animateGrain: true }); requestAnimationFrame(loop); }
loop();
document.body.classList.add('ready');
window.halide = { state, rig, exportPhoto, setLocation, setPaint, setFocal, car, carHolder, THREE, camera };
setTimeout(() => { window.__ready = true; }, 500);
