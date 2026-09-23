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

const finalFS = `
uniform sampler2D tColor; uniform float exposure, grain, vignette, time; uniform vec2 res;

varying vec2 vUv;
#include <tonemapping_pars_fragment>

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = texture2D(tColor, vUv).rgb * exposure;
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
      time: { value: 0 }, res: { value: new THREE.Vector2() }, toneMappingExposure: { value: 1 } } });
    this.quad = new FullScreenQuad(this.dof);
    this.setSize(1, 1);
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    this.rtScene?.dispose(); this.rtDof?.dispose();
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4,
      depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType) });
    this.rtDof = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
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
    u.radScale.value = opts.quality === 'export' ? 0.35 : 1.4 * Math.max(1, this.h / 900);
    this.quad.material = this.dof; r.setRenderTarget(this.rtDof); this.quad.render(r);
    const f = this.final.uniforms;
    f.tColor.value = this.rtDof.texture; f.exposure.value = Math.pow(2, opts.ev); f.grain.value = opts.grain;
    f.vignette.value = opts.vignette; f.time.value = opts.animateGrain ? (performance.now() % 1000) : 0;
    this.quad.material = this.final; r.setRenderTarget(target); this.quad.render(r);
  }
}
