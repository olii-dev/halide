// Camera simulation. Scene renders to linear HDR; then a physically-sized
// thin-lens depth of field (circle of confusion from focal length, f-stop,
// focus distance and a 36x24 sensor), then exposure, filmic tone map,
// vignette and luminance-aware film grain.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// film looks: saturation factor, black lift (fade), mono amount + tint, colour multiplier
export const LOOKS = {
  none:   { name: 'None',     sat: 1,    lift: 0,    mono: 0, tint: [1, 1, 1],          mul: [1, 1, 1] },
  vivid:  { name: 'Vivid',    sat: 1.25, lift: 0,    mono: 0, tint: [1, 1, 1],          mul: [1, 1, 1] },
  warm:   { name: 'Warm',     sat: 1.05, lift: 0.02, mono: 0, tint: [1, 1, 1],          mul: [1.05, 1.0, 0.9] },
  cool:   { name: 'Cool',     sat: 0.95, lift: 0.02, mono: 0, tint: [1, 1, 1],          mul: [0.93, 1.0, 1.06] },
  faded:  { name: 'Faded',    sat: 0.8,  lift: 0.09, mono: 0, tint: [1, 1, 1],          mul: [1.0, 0.99, 0.97] },
  cine:   { name: 'Cinema',   sat: 0.9,  lift: 0.04, mono: 0, tint: [1, 1, 1],          mul: [1.02, 1.0, 0.95] },
  bw:     { name: 'B&W',      sat: 1,    lift: 0,    mono: 1, tint: [1, 1, 1],          mul: [1, 1, 1] },
  sepia:  { name: 'Sepia',    sat: 1,    lift: 0.05, mono: 1, tint: [1.08, 0.97, 0.82], mul: [1, 1, 1] },
};

const vs = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const dofFS = `
precision highp float;
uniform sampler2D tColor, tDepth; uniform vec2 res; uniform float near, far, focus, focal, fstop, sensorH, maxCoC, radScale;
varying vec2 vUv;
const float GOLDEN = 2.39996323;
float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return (near*far) / ((far-near)*d - far) * -1.0; }
float coc(float z){ float f = focal*0.001; float A = f / fstop;
  float c = A * f * (z - focus) / (z * max(focus - f, 1e-4));
  return clamp(abs(c) / (sensorH*0.001) * res.y, 0.0, maxCoC); }
void main(){
  float cz = viewZ(vUv); float cs = coc(cz);
  vec3 col = texture2D(tColor, vUv).rgb; float tot = 1.0;
  if (maxCoC < 0.5) { gl_FragColor = vec4(col,1.); return; }
  float radius = radScale; float ang = 0.0; vec2 px = 1.0 / res;
  for (int i = 0; i < 2048; i++) {
    if (radius >= maxCoC) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * px * radius;
    vec3 sc = texture2D(tColor, tc).rgb; float sz = viewZ(tc); float ss = coc(sz);
    if (sz > cz) ss = clamp(ss, 0.0, cs * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, ss);
    col += mix(col / tot, sc, m); tot += 1.0;
    radius += radScale / radius; ang += GOLDEN;
  }
  gl_FragColor = vec4(col / tot, 1.);
}`;

const downFS = `uniform sampler2D tMap; uniform vec2 px; varying vec2 vUv;
void main(){ vec3 a = texture2D(tMap, vUv + px*vec2(-1.,-1.)).rgb + texture2D(tMap, vUv + px*vec2(1.,-1.)).rgb + texture2D(tMap, vUv + px*vec2(-1.,1.)).rgb + texture2D(tMap, vUv + px*vec2(1.,1.)).rgb;
  vec3 c = a * 0.25; c = min(c, vec3(64.)); gl_FragColor = vec4(c, 1.); }`;
const upFS = `uniform sampler2D tMap, tPrev; uniform vec2 px; varying vec2 vUv;
void main(){ vec3 s = texture2D(tMap, vUv).rgb * 4.;
  s += (texture2D(tMap, vUv + px*vec2(-1.,0.)).rgb + texture2D(tMap, vUv + px*vec2(1.,0.)).rgb + texture2D(tMap, vUv + px*vec2(0.,-1.)).rgb + texture2D(tMap, vUv + px*vec2(0.,1.)).rgb) * 2.;
  s += texture2D(tMap, vUv + px*vec2(-1.,-1.)).rgb + texture2D(tMap, vUv + px*vec2(1.,-1.)).rgb + texture2D(tMap, vUv + px*vec2(-1.,1.)).rgb + texture2D(tMap, vUv + px*vec2(1.,1.)).rgb;
  gl_FragColor = vec4(s / 16. + texture2D(tPrev, vUv).rgb, 1.); }`;

// panning shot: the camera tracks the car, so everything that is not a car streaks along the car's path
const panFS = `uniform sampler2D tColor, tMask; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tColor, vUv).rgb; float m = texture2D(tMask, vUv).r;
  if (m > 0.995) { gl_FragColor = vec4(c, 1.); return; }
  vec3 acc = vec3(0.); float w = 0.;
  for (int i = 0; i < 64; i++) { float t = float(i) / 63.0 - 0.5; vec2 uv = clamp(vUv + dir * t, 0.001, 0.999);
    float ww = (1.0 - texture2D(tMask, uv).r) * (1.0 - 1.4 * t * t); acc += texture2D(tColor, uv).rgb * ww; w += ww; }
  vec3 bg = w > 0.01 ? acc / w : c;
  gl_FragColor = vec4(mix(bg, c, m), 1.);
}`;

const finalFS = `
uniform sampler2D tBloom; uniform float bloom;
uniform sampler2D tColor; uniform float exposure, grain, vignette, time, contrast, saturation, lookSat, lookLift, lookMono; uniform vec2 res; uniform vec3 wb, lookMul, monoTint;

varying vec2 vUv;
#include <tonemapping_pars_fragment>

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = mix(texture2D(tColor, vUv).rgb, texture2D(tBloom, vUv).rgb / 6.0, bloom) * exposure * wb;
  vec2 q = vUv - 0.5; q.x *= res.x / res.y;
  c *= mix(1.0, smoothstep(1.25, 0.2, length(q)), vignette);
  c = AgXToneMapping(c);
  vec4 o = sRGBTransferOETF(vec4(c, 1.0));
  // grade (display space): contrast around mid grey, saturation, then the film look
  o.rgb = clamp((o.rgb - 0.5) * contrast + 0.5, 0.0, 1.0);
  float lum = dot(o.rgb, vec3(0.2126, 0.7152, 0.0722));
  o.rgb = mix(vec3(lum), o.rgb, saturation * lookSat);
  o.rgb = mix(o.rgb, vec3(lum) * monoTint, lookMono);
  o.rgb = mix(vec3(lookLift), vec3(1.0 - lookLift * 0.6), o.rgb) * lookMul;
  // grain: gaussian-ish, strongest in midtones, like film
  vec2 g = gl_FragCoord.xy + time * 91.7;
  float n = (hash(g) + hash(g + 17.3) + hash(g + 41.9) - 1.5) * 0.8;
  float l = dot(o.rgb, vec3(0.299, 0.587, 0.114));
  o.rgb += n * grain * 0.09 * (0.35 + 1.3 * l * (1.0 - l));
  gl_FragColor = vec4(clamp(o.rgb, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = null;
    this.dof = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: dofFS, uniforms: {
      tColor: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2() },
      near: { value: 0.1 }, far: { value: 1000 }, focus: { value: 8 }, focal: { value: 85 }, fstop: { value: 2.8 },
      sensorH: { value: 24 }, maxCoC: { value: 24 }, radScale: { value: 1.2 } } });
    this.final = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: finalFS, uniforms: {
      tColor: { value: null }, exposure: { value: 1 }, grain: { value: 0.35 }, vignette: { value: 0.35 },
      time: { value: 0 }, res: { value: new THREE.Vector2() }, toneMappingExposure: { value: 1 }, tBloom: { value: null }, bloom: { value: 0.045 },
      contrast: { value: 1 }, saturation: { value: 1 }, lookSat: { value: 1 }, lookLift: { value: 0 }, lookMono: { value: 0 },
      wb: { value: new THREE.Vector3(1, 1, 1) }, lookMul: { value: new THREE.Vector3(1, 1, 1) }, monoTint: { value: new THREE.Vector3(1, 1, 1) } } });
    this.down = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: downFS, uniforms: { tMap: { value: null }, px: { value: new THREE.Vector2() } } });
    this.up = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: upFS, uniforms: { tMap: { value: null }, tPrev: { value: null }, px: { value: new THREE.Vector2() } } });
    this.black = new THREE.DataTexture(new Uint8Array(4), 1, 1); this.black.needsUpdate = true;
    this.copy = new THREE.ShaderMaterial({ vertexShader: vs, uniforms: { tMap: { value: null }, w: { value: 1 } },
      fragmentShader: `uniform sampler2D tMap; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tMap, vUv).rgb * w, 1.); }`,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true });
    this.pan = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: panFS, uniforms: { tColor: { value: null }, tMask: { value: null }, dir: { value: new THREE.Vector2() } } });
    this.maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.quad = new FullScreenQuad(this.dof);
    this.setSize(1, 1);
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    this.rtScene?.dispose(); this.rtDof?.dispose();
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4,
      depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType) });
    this.rtDof = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.rtPan?.dispose(); this.rtPan = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.rtMask?.dispose(); this.rtMask = new THREE.WebGLRenderTarget(w, h);
    this.rtAccum?.dispose(); this.rtAccum = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.mips?.forEach(m => { m.d.dispose(); m.u.dispose(); }); this.mips = [];
    let mw = w, mh = h; for (let i = 0; i < 6; i++) { mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1);
      this.mips.push({ d: new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType }), u: new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType }), w: mw, h: mh }); }
    this.dof.uniforms.res.value.set(w, h); this.final.uniforms.res.value.set(w, h);
  }
  render(scene, camera, opts, target = null) {
    const r = this.renderer, u = this.dof.uniforms;
    // wheel motion blur: average several sub-frames across the shutter (wheel angles only)
    const K = opts.subframe ? (opts.quality === 'export' ? 24 : (opts.previewSamples ?? 6)) : 1;
    if (K > 1) {
      const pc = new THREE.Color(), pa = r.getClearAlpha(); r.getClearColor(pc);
      r.setRenderTarget(this.rtAccum); r.setClearColor(0x000000, 1); r.clear(); r.setClearColor(pc, pa);
      this.quad.material = this.copy; this.copy.uniforms.w.value = 1 / K;
      for (let i = 0; i < K; i++) {
        opts.subframe((i + 0.5) / K - 0.5);
        r.setRenderTarget(this.rtScene); r.render(scene, camera);
        this.copy.uniforms.tMap.value = this.rtScene.texture; r.setRenderTarget(this.rtAccum);
        const ac = r.autoClear; r.autoClear = false; this.quad.render(r); r.autoClear = ac;
      }
      opts.subframe(0);
      u.tColor.value = this.rtAccum.texture;
    } else {
      r.setRenderTarget(this.rtScene); r.render(scene, camera);
      u.tColor.value = this.rtScene.texture;
    }
    u.tDepth.value = this.rtScene.depthTexture;
    u.near.value = camera.near; u.far.value = camera.far;
    u.focus.value = opts.focus; u.focal.value = camera.getFocalLength(); u.fstop.value = opts.fstop;
    u.sensorH.value = camera.getFilmHeight() * (opts.sensorScale ?? 1);
    // max blur scales with image height so previews and exports match
    u.maxCoC.value = opts.dof ? Math.max(4, this.h * 0.03) : 0;
    u.radScale.value = opts.quality === 'export' ? Math.max(0.4, u.maxCoC.value * u.maxCoC.value / 3600) : Math.max(1.4 * this.h / 900, u.maxCoC.value * u.maxCoC.value / 700);
    this.quad.material = this.dof; r.setRenderTarget(this.rtDof); this.quad.render(r);
    // bloom: 6-level downsample / tent upsample chain on the linear HDR image
    let colorTex = this.rtDof.texture;
    if (opts.pan && (opts.pan.x || opts.pan.y)) {
      // car mask: only layer 1 (car meshes), flat white
      const ov = scene.overrideMaterial, mask = camera.layers.mask, pc = new THREE.Color(), pa = r.getClearAlpha(); r.getClearColor(pc);
      scene.overrideMaterial = this.maskMat; camera.layers.set(1); r.setClearColor(0x000000, 1);
      r.setRenderTarget(this.rtMask); r.clear(); r.render(scene, camera);
      scene.overrideMaterial = ov; camera.layers.mask = mask; r.setClearColor(pc, pa);
      this.pan.uniforms.tColor.value = colorTex; this.pan.uniforms.tMask.value = this.rtMask.texture; this.pan.uniforms.dir.value.copy(opts.pan);
      this.quad.material = this.pan; r.setRenderTarget(this.rtPan); this.quad.render(r); colorTex = this.rtPan.texture;
    }
    let src = colorTex, sw = this.w, sh = this.h;
    this.quad.material = this.down;
    const mips = opts.bloomOff ? [] : this.mips;
    for (const m of mips) { this.down.uniforms.tMap.value = src; this.down.uniforms.px.value.set(0.5 / sw, 0.5 / sh); r.setRenderTarget(m.d); this.quad.render(r); src = m.d.texture; sw = m.w; sh = m.h; }
    this.quad.material = this.up; let prev = this.black;
    for (let i = mips.length - 1; i >= 0; i--) { const m = mips[i]; this.up.uniforms.tMap.value = m.d.texture; this.up.uniforms.tPrev.value = prev;
      this.up.uniforms.px.value.set(1 / m.w, 1 / m.h); r.setRenderTarget(m.u); this.quad.render(r); prev = m.u.texture; }
    const f = this.final.uniforms; f.tBloom.value = prev; f.bloom.value = opts.bloomOff ? 0 : 0.045 * (opts.bloom ?? 1);
    f.contrast.value = opts.contrast ?? 1; f.saturation.value = opts.saturation ?? 1;
    const L = LOOKS[opts.look] || LOOKS.none; f.lookSat.value = L.sat; f.lookLift.value = L.lift; f.lookMono.value = L.mono; f.lookMul.value.fromArray(L.mul); f.monoTint.value.fromArray(L.tint);
    const t = opts.temp ?? 0, g = opts.tint ?? 0; f.wb.value.set(1 + 0.13 * t + 0.03 * g, 1 - 0.07 * g, 1 - 0.15 * t + 0.03 * g);
    f.tColor.value = colorTex; f.exposure.value = Math.pow(2, opts.ev); f.grain.value = opts.grain;
    f.vignette.value = opts.vignette; f.time.value = opts.animateGrain ? (performance.now() % 1000) : 0;
    this.quad.material = this.final; r.setRenderTarget(target); this.quad.render(r);
  }
}
