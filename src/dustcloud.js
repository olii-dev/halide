// dust kicked up by the tyres on loose ground: soft billboard puffs that trail back from each tyre, spread
// sideways and rise, thinning out with distance. Positions come from fixed seeds so a photo re-renders the same.
// Lives in the car's holder, so it moves with the car; length scales with speed, density with the slider.
import * as THREE from 'three';
const N = 420;
const vs = `
attribute vec4 seed; uniform vec3 wheel[4]; uniform vec3 back; uniform float len, amount, rad; uniform float front;
varying vec2 vUv; varying float vA, vH;
void main(){
  int w = int(seed.x * 3.999); vec3 base = wheel[0]; if (w == 1) base = wheel[1]; else if (w == 2) base = wheel[2]; else if (w == 3) base = wheel[3];
  bool isFront = dot(base, back) < 0.0;                 // front tyres throw far less
  float t = pow(seed.y, 1.35);                           // more puffs close to the tyre
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), back)) * sign(dot(base, normalize(cross(vec3(0.0, 1.0, 0.0), back))) + 1e-4);
  float spread = (seed.z - 0.2) * (0.25 + 1.6 * t) * len * 0.22;
  float rise = seed.w * (0.05 + 1.5 * t) * min(len, 10.0) * 0.2;
  vec3 c = base + back * (rad * 1.05 + t * len) + side * (spread + 0.12); c.y = 0.06 + rise + (1.0 - t) * rad * 0.3 * seed.w;
  float size = rad * (1.0 + 6.0 * t) * (0.7 + 0.6 * fract(seed.x * 7.13));
  vA = amount * pow(1.0 - t, 1.6) * (isFront ? front : 1.0) * (0.45 + 0.55 * fract(seed.z * 5.7));
  vH = clamp(rise / max(rad * 2.0, 0.01), 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(c, 1.0); mv.xy += (uv - 0.5) * size;
  vUv = uv; gl_Position = projectionMatrix * mv;
}`;
const fs = `
uniform vec3 col; uniform float light; varying vec2 vUv; varying float vA, vH;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 q = vUv - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard;
  float billow = n2(vUv * 5.0 + vA * 13.0) * 0.6 + n2(vUv * 11.0) * 0.4;
  float a = vA * pow(1.0 - r, 1.8) * (0.55 + 0.7 * billow);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * light * mix(0.7, 1.08, vH) * (0.9 + 0.2 * billow), a);
}`;
export class DustCloud {
  constructor(dustColor) {
    const g = new THREE.InstancedBufferGeometry(); const p = new THREE.PlaneGeometry(1, 1);
    g.index = p.index; g.attributes.position = p.attributes.position; g.attributes.uv = p.attributes.uv; g.instanceCount = N;
    const s = new Float32Array(N * 4); let x = 12345; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N * 4; i++) s[i] = rnd(); g.setAttribute('seed', new THREE.InstancedBufferAttribute(s, 4));
    this.u = { wheel: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }, back: { value: new THREE.Vector3(0, 0, -1) }, len: { value: 0 }, amount: { value: 0 },
      rad: { value: 0.32 }, front: { value: 0.15 }, col: dustColor, light: { value: 1 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: this.u, transparent: true, depthWrite: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.visible = false; this.mesh.castShadow = this.mesh.receiveShadow = false;
  }
  setWheels(c) { // wheel centres in the holder's space; the cloud trails away from the nose
    c.holder.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(c.holder.matrixWorld).invert();
    c.wheels.slice(0, 4).forEach((w, i) => this.u.wheel.value[i].setFromMatrixPosition(w.pivot.matrixWorld).applyMatrix4(inv));
    this.u.rad.value = c.wheels[0]?.radius ?? 0.32; this.u.back.value.set(0, 0, -c.noseSign);
  }
  update(amount, kmh, light = 1) {
    const on = amount > 0 && kmh > 0; this.mesh.visible = on; if (!on) return;
    this.u.amount.value = Math.min(1, amount) * 0.85; this.u.len.value = 1.2 + Math.min(kmh, 250) / 250 * 9; this.u.light.value = light;
  }
}
