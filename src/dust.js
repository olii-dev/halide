// road dust: a height-based dirt film baked into the car's materials in the shader. Thickest at the sills,
// arches and wheels, thinning up the doors with a patchy edge; dust is matte and non-metallic, so it also
// kills the clearcoat and metal flake where it lies. One uniform per car drives amount; colour follows the place.
import * as THREE from 'three';
export const dustColor = { value: new THREE.Color('#9a8b78') };
export function addDust(m, amt, scale = 1) {
  if (!m || m.userData.dusted) return m; m.userData.dusted = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.dustAmt = amt; sh.uniforms.dustCol = dustColor; sh.uniforms.dustScale = { value: scale };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDustW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDustW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const head = `varying vec3 vDustW; uniform float dustAmt, dustScale; uniform vec3 dustCol; float dustK;
float dh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float dn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh(i), dh(i + vec3(1,0,0)), f.x), mix(dh(i + vec3(0,1,0)), dh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh(i + vec3(0,0,1)), dh(i + vec3(1,0,1)), f.x), mix(dh(i + vec3(0,1,1)), dh(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + head)
      .replace('#include <color_fragment>', `#include <color_fragment>
  { float a = clamp(dustAmt * min(dustScale, 1.1), 0.0, 1.0);
    float n = dn(vDustW * 3.0) * 0.3 + dn(vDustW * vec3(16.0, 40.0, 16.0)) * 0.45 + dn(vDustW * 90.0) * 0.25;  // soft broad variation + fine grit, streaked vertically
    float reach = 0.18 + 0.75 * a;                       // how far up the body the dirt climbs
    float edge = vDustW.y - (n - 0.5) * 0.12;             // patchy tide line, not a ruler-straight band
    float low = 1.0 - smoothstep(reach * 0.35, reach, edge);
    float dpat = smoothstep(0.15, 0.85, n);             // dirt collects in blotches, with cleaner gaps
    dustK = a * clamp(low * (0.35 + 0.55 * dpat) + 0.15 * a * dpat, 0.0, 0.8) * (dustScale > 1.0 ? 0.75 : 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, dustCol * (0.62 + 0.25 * n), dustK); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.95, dustK);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0.0, dustK);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  #ifdef USE_CLEARCOAT\n  material.clearcoat *= 1.0 - dustK;\n  #endif');
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|dust';
  m.needsUpdate = true; return m;
}
