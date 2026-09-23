// Camera simulation. Scene renders to linear HDR; then a physically-sized
// thin-lens depth of field (circle of confusion from focal length, f-stop,
// focus distance and a 36x24 sensor), then exposure, filmic tone map,
// vignette and luminance-aware film grain.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

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

const finalFS = `
uniform sampler2D tBloom; uniform float bloom;
uniform sampler2D tColor; uniform float exposure, grain, vignette, time; uniform vec2 res;

varying vec2 vUv;
#include <tonemapping_pars_fragment>

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = mix(texture2D(tColor, vUv).rgb, texture2D(tBloom, vUv).rgb / 6.0, bloom) * exposure;
  vec2 q = vUv - 0.5; q.x *= res.x / res.y;
  c *= mix(1.0, smoothstep(1.25, 0.2, length(q)), vignette);
  c = AgXToneMapping(c);
  vec4 o = sRGBTransferOETF(vec4(c, 1.0));
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
      time: { value: 0 }, res: { value: new THREE.Vector2() }, toneMappingExposure: { value: 1 }, tBloom: { value: null }, bloom: { value: 0.045 } } });
    this.down = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: downFS, uniforms: { tMap: { value: null }, px: { value: new THREE.Vector2() } } });
    this.up = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: upFS, uniforms: { tMap: { value: null }, tPrev: { value: null }, px: { value: new THREE.Vector2() } } });
    this.black = new THREE.DataTexture(new Uint8Array(4), 1, 1); this.black.needsUpdate = true;
    this.quad = new FullScreenQuad(this.dof);
    this.setSize(1, 1);
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    this.rtScene?.dispose(); this.rtDof?.dispose();
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4,
      depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType) });
    this.rtDof = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.mips?.forEach(m => { m.d.dispose(); m.u.dispose(); }); this.mips = [];
    let mw = w, mh = h; for (let i = 0; i < 6; i++) { mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1);
      this.mips.push({ d: new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType }), u: new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType }), w: mw, h: mh }); }
    this.dof.uniforms.res.value.set(w, h); this.final.uniforms.res.value.set(w, h);
  }
  render(scene, camera, opts, target = null) {
    const r = this.renderer, u = this.dof.uniforms;
    r.setRenderTarget(this.rtScene); r.render(scene, camera);
    u.tColor.value = this.rtScene.texture; u.tDepth.value = this.rtScene.depthTexture;
    u.near.value = camera.near; u.far.value = camera.far;
    u.focus.value = opts.focus; u.focal.value = camera.getFocalLength(); u.fstop.value = opts.fstop;
    u.sensorH.value = camera.getFilmHeight();
    // max blur scales with image height so previews and exports match
    u.maxCoC.value = opts.dof ? Math.max(4, this.h * 0.03) : 0;
    u.radScale.value = opts.quality === 'export' ? Math.max(0.4, u.maxCoC.value * u.maxCoC.value / 3600) : Math.max(1.4 * this.h / 900, u.maxCoC.value * u.maxCoC.value / 700);
    this.quad.material = this.dof; r.setRenderTarget(this.rtDof); this.quad.render(r);
    // bloom: 6-level downsample / tent upsample chain on the linear HDR image
    let src = this.rtDof.texture, sw = this.w, sh = this.h;
    this.quad.material = this.down;
    for (const m of this.mips) { this.down.uniforms.tMap.value = src; this.down.uniforms.px.value.set(0.5 / sw, 0.5 / sh); r.setRenderTarget(m.d); this.quad.render(r); src = m.d.texture; sw = m.w; sh = m.h; }
    this.quad.material = this.up; let prev = this.black;
    for (let i = this.mips.length - 1; i >= 0; i--) { const m = this.mips[i]; this.up.uniforms.tMap.value = m.d.texture; this.up.uniforms.tPrev.value = prev;
      this.up.uniforms.px.value.set(1 / m.w, 1 / m.h); r.setRenderTarget(m.u); this.quad.render(r); prev = m.u.texture; }
    const f = this.final.uniforms; f.tBloom.value = prev;
    f.tColor.value = this.rtDof.texture; f.exposure.value = Math.pow(2, opts.ev); f.grain.value = opts.grain;
    f.vignette.value = opts.vignette; f.time.value = opts.animateGrain ? (performance.now() % 1000) : 0;
    this.quad.material = this.final; r.setRenderTarget(target); this.quad.render(r);
  }
}
