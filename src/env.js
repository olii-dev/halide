// Environment analysis: load an HDRI, find the sun, pull it out of the
// image-based lighting so a real directional light can carry it (sharp
// shadows + specular), and measure how much of the ground's light comes from
// the sun vs the sky. That ratio sets how dark the car's shadow must be to
// match the real shadows already in the photo.
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const loader = new HDRLoader().setDataType(THREE.FloatType);

export async function loadHDR(url) {
  const tex = await loader.loadAsync(url);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

// Row 0 of the float data is the TOP of the panorama (flipY happens on upload).
function dirFromPixel(x, y, W, H, out) {
  const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H;
  const lon = (u - 0.5) * 2 * Math.PI, lat = (v - 0.5) * Math.PI;
  // matches three's equirectUv(): u = atan(z, x)/(2pi) + 0.5
  return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
}

export function analyse(tex, { noSun = false } = {}) {
  const { data, width: W, height: H } = tex.image;
  const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const d = new THREE.Vector3();
  // brightest pixel in the upper hemisphere (the sun) + sky median
  let maxL = 0, mx = 0, my = 0;
  const sample = [];
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, L = lum(i);
    if (L > maxL) { maxL = L; mx = x; my = y; }
    if ((x & 15) === 0 && (y & 15) === 0) sample.push(L);
  }
  sample.sort((a, b) => a - b);
  const median = sample[sample.length >> 1] || 1e-4;
  const sunDir = dirFromPixel(mx, my, W, H, new THREE.Vector3());
  const hasSun = !noSun && maxL > 40 * median && maxL > 5 && sunDir.y > -0.05;

  const dOmegaBase = (2 * Math.PI / W) * (Math.PI / H);
  const sunE = new THREE.Vector3();          // sun irradiance (normal incidence), rgb
  const skyE = new THREE.Vector3();          // sky irradiance on horizontal ground, rgb (sun removed)
  const clipped = new Float32Array(data); let gL = 0, gN = 0;    // env copy with the sun painted out
  const cosSunCut = Math.cos(THREE.MathUtils.degToRad(4));
  const thresh = Math.max(20 * median, maxL * 0.02);
  // ring colour just outside the sun, used to fill the hole
  const ring = new THREE.Vector3(); let ringN = 0;
  const cosRingIn = Math.cos(THREE.MathUtils.degToRad(5)), cosRingOut = Math.cos(THREE.MathUtils.degToRad(8));
  if (hasSun) {
    for (let y = 0; y < H / 2 + 2; y++) for (let x = 0; x < W; x++) {
      dirFromPixel(x, y, W, H, d); const c = d.dot(sunDir);
      if (c < cosRingIn && c > cosRingOut) { const i = (y * W + x) * 4; ring.x += data[i]; ring.y += data[i + 1]; ring.z += data[i + 2]; ringN++; }
    }
    ring.multiplyScalar(1 / Math.max(ringN, 1));
  }
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI, dOmega = dOmegaBase * Math.cos(lat);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      dirFromPixel(x, y, W, H, d);
      let r = data[i], g = data[i + 1], b = data[i + 2];
      if (hasSun && d.dot(sunDir) > cosSunCut && lum(i) > thresh) {
        sunE.x += (r - ring.x) * dOmega; sunE.y += (g - ring.y) * dOmega; sunE.z += (b - ring.z) * dOmega;
        r = ring.x; g = ring.y; b = ring.z;
        clipped[i] = r; clipped[i + 1] = g; clipped[i + 2] = b;
      }
      if (d.y < -0.35 && d.y > -0.8) { gL += lum(i); gN++; }
      if (d.y > 0) { skyE.x += r * d.y * dOmega; skyE.y += g * d.y * dOmega; skyE.z += b * d.y * dOmega; }
    }
  }
  const envTex = new THREE.DataTexture(clipped, W, H, THREE.RGBAFormat, THREE.FloatType);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = tex.colorSpace; envTex.flipY = true;
  envTex.magFilter = envTex.minFilter = THREE.LinearFilter; envTex.generateMipmaps = false;
  envTex.needsUpdate = true;

  const Y = (v) => 0.2126 * v.x + 0.7152 * v.y + 0.0722 * v.z;
  const sunLum = Math.max(Y(sunE), 0), skyLum = Math.max(Y(skyE), 1e-6);
  const sunOnGround = sunLum * Math.max(sunDir.y, 0);
  return {
    hasSun, sunDir, envTex,
    sunColor: sunLum > 0 ? sunE.clone().multiplyScalar(1 / sunLum) : new THREE.Vector3(1, 1, 1),
    sunIntensity: sunLum, skyLum, groundL: gL / Math.max(gN, 1),
    skyIrradiance: skyLum, skyE: skyE.clone(),
    sunShare: hasSun ? sunOnGround / (sunOnGround + skyLum) : 0,
    peak: maxL, median,
  };
}
