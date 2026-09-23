import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { loadHDR, analyse } from './env.js';
import { Ground } from './ground.js';
import { Post } from './post.js';
import { LOCATIONS } from './locations.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 2000);
camera.filmGauge = 36;

const state = {
  focal: +(q.get('f') ?? 85), fstop: +(q.get('n') ?? 2.8), ev: +(q.get('ev') ?? 0), grain: +(q.get('grain') ?? 0.35),
  vignette: 0.3, focus: 8, dof: q.get('dof') !== '0', loc: q.get('loc') ?? LOCATIONS[0].id,
};
camera.setFocalLength(state.focal);

const pmrem = new THREE.PMREMGenerator(renderer);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 6; sun.shadow.blurSamples = 16;
sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const ground = new Ground(renderer, scene);
const post = new Post(renderer);

let sky = null, car = null, carRadius = 3;

async function setLocation(id) {
  const L = LOCATIONS.find(l => l.id === id) || LOCATIONS[0];
  const hdr = await loadHDR(`/assets/hdri/${L.id}_2k.hdr`);
  const info = analyse(hdr);
  const envRT = pmrem.fromEquirectangular(info.envTex);
  scene.environment?.dispose?.(); scene.environment = envRT.texture;
  info.envTex.dispose();
  if (sky) { scene.remove(sky); sky.geometry.dispose(); }
  sky = new GroundedSkybox(hdr, L.height, 400, 256);
  sky.material.depthWrite = true; sky.renderOrder = -1;
  sky.position.y = L.height;
  scene.add(sky);
  sun.visible = info.hasSun;
  sun.color.setRGB(info.sunColor.x, info.sunColor.y, info.sunColor.z, THREE.LinearSRGBColorSpace);
  sun.intensity = info.sunIntensity;
  sunDirCache.copy(info.sunDir);
  const s = sun.shadow.camera; Object.assign(s, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 50 }); s.updateProjectionMatrix();
  ground.sunShare = info.sunShare;
  window.__env = { ...info, envTex: undefined, sunDir: info.sunDir.toArray().map(v => +v.toFixed(3)) };
  console.log('env', L.id, JSON.stringify(window.__env));
  // upgrade the backdrop to 4k in the background
  loadHDR(`/assets/hdri/${L.id}_4k.hdr`).then(hi => { if (sky && state.loc === L.id) { sky.material.map = hi; sky.material.needsUpdate = true; hdr.dispose(); window.__hi = true; } });
}

async function loadCar() {
  const gltf = await new GLTFLoader().loadAsync('/assets/cars/CarConcept.glb');
  car = gltf.scene;
  const box = new THREE.Box3().setFromObject(car);
  car.position.y -= box.min.y;
  const size = box.getSize(new THREE.Vector3()); carRadius = size.length() / 2;
  car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  carHolder.add(car);
  ground.bake(car);
  console.log('car size', size.toArray().map(v => v.toFixed(2)).join(' '));
}

// Scapes model: the camera stands where the panorama was shot (so the backdrop
// is seen from its true viewpoint and never distorts); you place and turn the car.
const rig = { camH: +(q.get('h') ?? 1.2), carDist: 0, carYaw: +(q.get('yaw') ?? 35) * Math.PI / 180, carBearing: +(q.get('bearing') ?? 0) * Math.PI / 180, aimY: 0.62 };
const carHolder = new THREE.Group(); scene.add(carHolder);
function frameDefault() {
  const vfov = 2 * Math.atan(camera.getFilmHeight() / 2 / camera.getFocalLength());
  rig.carDist = +(q.get('dist') ?? (carRadius * 1.15 / Math.tan(vfov / 2)));
  state.focus = rig.carDist;
}
function applyRig() {
  const L = LOCATIONS.find(l => l.id === state.loc); rig.camH = Math.min(rig.camH, L.height);
  const cx = Math.sin(rig.carBearing) * -rig.carDist, cz = Math.cos(rig.carBearing) * -rig.carDist;
  carHolder.position.set(cx, 0, cz); carHolder.rotation.y = rig.carYaw;
  camera.position.set(0, rig.camH, 0);
  camera.lookAt(cx, rig.aimY, cz);
  ground.catcher.position.x = 0; // catcher is large and fixed at origin
  ground.setCarTransform(carHolder);
  sun.target.position.set(cx, 0, cz); sun.position.set(cx, 0, cz).addScaledVector(sunDirCache, 20);
}
const sunDirCache = new THREE.Vector3(0, 1, 0);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.near = 0.1; camera.far = 2000; camera.updateProjectionMatrix();
  const pr = renderer.getPixelRatio();
  post.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
}
addEventListener('resize', resize);

await Promise.all([setLocation(state.loc), loadCar()]);
resize(); frameDefault();

function loop() {
  applyRig();
  post.render(scene, camera, { ...state, animateGrain: true });
  requestAnimationFrame(loop);
}
// input: drag = move car on the ground, shift/right-drag = turn car,
// wheel/pinch = focal length, tap = set focus point
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
let drag = null;
const el = renderer.domElement;
el.addEventListener('contextmenu', e => e.preventDefault());
el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false, turn: e.shiftKey || e.button === 2, yaw: rig.carYaw }; el.setPointerCapture(e.pointerId); });
el.addEventListener('pointermove', e => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) drag.moved = true; if (!drag.moved) return;
  if (drag.turn) { rig.carYaw = drag.yaw + dx * 0.01; return; }
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(plane, hit)) { const d = Math.hypot(hit.x, hit.z); if (d > 3 && d < 120) { rig.carDist = d; rig.carBearing = Math.atan2(-hit.x, -hit.z); state.focus = d; } }
});
el.addEventListener('pointerup', e => {
  if (drag && !drag.moved) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([carHolder, ground.catcher], true); if (hits.length) state.focus = hits[0].distance; }
  drag = null;
});
el.addEventListener('wheel', e => { e.preventDefault(); state.focal = THREE.MathUtils.clamp(state.focal * Math.exp(-e.deltaY * 0.001), 18, 400); camera.setFocalLength(state.focal); }, { passive: false });
window.halide = { state, rig, camera };
loop();
setTimeout(() => { window.__ready = true; }, 500);
