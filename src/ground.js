// Ground contact: a transparent shadow-catcher over the photographed ground.
// Darkening = light the car blocks. Sun part comes from the shadow map, sky
// part from a top-down occlusion map rendered from under the car and blurred
// (soft where the body is high, near-black where the tyres touch).
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const AO_RES = 512;

export class Ground {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.extent = 9; // metres covered by the occlusion map (square, centred on car)
    this.rtA = new THREE.WebGLRenderTarget(AO_RES, AO_RES, { type: THREE.HalfFloatType });
    this.rtB = this.rtA.clone();
    // tight contact layer: high-res, short falloff, light blur (the dark line where rubber meets road)
    this.rtC = new THREE.WebGLRenderTarget(1024, 1024, { type: THREE.HalfFloatType });
    this.rtD = this.rtC.clone();
    this.tightMat = new THREE.ShaderMaterial({
      vertexShader: `varying float vY; void main(){ vec4 w = modelMatrix*vec4(position,1.); vY = w.y; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `varying float vY; void main(){ float o = 1.0 - smoothstep(0.0, 0.07, vY); gl_FragColor = vec4(o, 0., 0., 1.); }`,
      side: THREE.DoubleSide,
    });
    this.aoCam = new THREE.OrthographicCamera(-this.extent / 2, this.extent / 2, this.extent / 2, -this.extent / 2, 0, 3);
    this.aoCam.position.set(0, 0, 0);
    this.aoCam.up.set(0, 0, -1);
    this.aoCam.lookAt(0, 1, 0); // look straight up from the ground
    this.heightMat = new THREE.ShaderMaterial({
      uniforms: { falloff: { value: 0.55 } },
      vertexShader: `varying float vY; void main(){ vec4 w = modelMatrix*vec4(position,1.); vY = w.y; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float falloff; varying float vY; void main(){ float o = 1.0 - smoothstep(0.0, falloff, vY); gl_FragColor = vec4(o*o, o, 0., 1.); }`,
      side: THREE.DoubleSide,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`,
      fragmentShader: `uniform sampler2D tMap; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec4 s = vec4(0.); float wt = 0.;
          for (int i = -12; i <= 12; i++) { float w = exp(-float(i*i)/72.0); s += texture2D(tMap, vUv + dir*float(i)) * w; wt += w; }
          gl_FragColor = s / wt; }`,
    });
    this.quad = new FullScreenQuad(this.blurMat);

    const mat = new THREE.ShadowMaterial({ transparent: true, depthWrite: false });
    mat.userData.uniforms = {
      tAO: { value: this.rtA.texture }, tC: { value: this.rtC.texture }, aoExtent: { value: this.extent },
      sunShare: { value: 0.6 }, carPos: { value: new THREE.Vector2() }, carYaw: { value: 0 }, aoStrength: { value: 1.0 }, contactStrength: { value: 1.0 },
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, mat.userData.uniforms);
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vWorldP;\nvoid main() {\nvWorldP = (modelMatrix*vec4(position,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', `varying vec3 vWorldP; uniform sampler2D tAO, tC; uniform float aoExtent, sunShare, aoStrength, contactStrength, carYaw; uniform vec2 carPos;
void main() {`)
        .replace('gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );', `
  vec2 lp = vWorldP.xz - carPos; float cy = cos(carYaw), sy = sin(carYaw); lp = vec2(cy*lp.x - sy*lp.y, sy*lp.x + cy*lp.y);
  vec2 auv = lp / aoExtent + 0.5; auv.y = 1.0 - auv.y;
  vec2 edge = smoothstep(0.0, 0.08, auv) * smoothstep(0.0, 0.08, 1.0 - auv);
  vec4 ao = texture2D(tAO, auv) * edge.x * edge.y;
  float sky = 1.0 - clamp(ao.g * aoStrength, 0.0, 1.0);          // broad sky occlusion
  sky *= 1.0 - clamp(ao.r * contactStrength * 0.6, 0.0, 1.0);    // tight contact darkening
  float tight = texture2D(tC, auv).r * edge.x * edge.y;
  float lit = sunShare * getShadowMask() + (1.0 - sunShare) * sky;
  lit *= 1.0 - clamp(tight * 1.6, 0.0, 0.92) * contactStrength;
  gl_FragColor = vec4( color, 1.0 - lit );`);
    };
    this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat);
    this.catcher.rotation.x = -Math.PI / 2;
    this.catcher.position.y = 0.001;
    this.catcher.receiveShadow = true;
    this.catcher.renderOrder = 1;
    scene.add(this.catcher);
  }
  setCarTransform(holder) {
    // occlusion map is baked in car space; follow the car on the ground
    const u = this.catcher.material.userData.uniforms;
    u.carPos.value.set(holder.position.x, holder.position.z); u.carYaw.value = holder.rotation.y;
  }
  set sunShare(v) { this.catcher.material.userData.uniforms.sunShare.value = v; }

  // Render the occlusion map for the car (call once per car/variant change).
  bake(car) {
    const r = this.renderer, prevTarget = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    const s = new THREE.Scene(); s.overrideMaterial = this.heightMat;
    const parent = car.parent; s.add(car); car.updateMatrixWorld(true);
    r.setRenderTarget(this.rtA); r.setClearColor(0x000000, 0); r.clear();
    r.render(s, this.aoCam);
    s.overrideMaterial = this.tightMat;
    r.setRenderTarget(this.rtC); r.clear(); r.render(s, this.aoCam);
    s.overrideMaterial = this.heightMat;
    if (parent) parent.add(car);
    for (let k = 0; k < 2; k++) {
      this.blurMat.uniforms.tMap.value = this.rtC.texture; this.blurMat.uniforms.dir.value.set((k + 1) * 0.35 / 1024, 0);
      r.setRenderTarget(this.rtD); this.quad.render(r);
      this.blurMat.uniforms.tMap.value = this.rtD.texture; this.blurMat.uniforms.dir.value.set(0, (k + 1) * 0.35 / 1024);
      r.setRenderTarget(this.rtC); this.quad.render(r);
    }
    const px = 1 / AO_RES;
    for (let k = 0; k < 3; k++) {
      this.blurMat.uniforms.tMap.value = this.rtA.texture; this.blurMat.uniforms.dir.value.set(px * (k + 1) * 0.8, 0);
      r.setRenderTarget(this.rtB); this.quad.render(r);
      this.blurMat.uniforms.tMap.value = this.rtB.texture; this.blurMat.uniforms.dir.value.set(0, px * (k + 1) * 0.8);
      r.setRenderTarget(this.rtA); this.quad.render(r);
    }
    r.setRenderTarget(prevTarget); r.setClearColor(prevClear, prevAlpha);
  }
}
