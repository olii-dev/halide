// Offline: how much "sun" energy lies within each angular radius of the sun (2k HDR).
import fs from 'fs';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
const L = new HDRLoader().setDataType(THREE.FloatType);
for (const id of process.argv.slice(2)) {
  const buf = fs.readFileSync(`public/assets/hdri/${id}_2k.hdr`);
  const { data, width: W, height: H } = L.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const lum = i => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const dir = (x, y) => { const u = (x + .5) / W, v = 1 - (y + .5) / H, lon = (u - .5) * 2 * Math.PI, lat = (v - .5) * Math.PI; return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]; };
  let mx = 0, my = 0, maxL = 0; for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x++) { const l = lum((y * W + x) * 4); if (l > maxL) { maxL = l; mx = x; my = y; } }
  const s = dir(mx, my); const base = (2 * Math.PI / W) * (Math.PI / H);
  const radii = [0.5, 1, 1.5, 2, 3, 4, 6]; const E = radii.map(() => 0); let sky = 0;
  for (let y = 0; y < H; y++) { const lat = (0.5 - (y + .5) / H) * Math.PI, dO = base * Math.cos(lat);
    for (let x = 0; x < W; x++) { const d = dir(x, y), c = d[0] * s[0] + d[1] * s[1] + d[2] * s[2], ang = Math.acos(Math.min(1, c)) * 180 / Math.PI, l = lum((y * W + x) * 4);
      radii.forEach((r, k) => { if (ang < r) E[k] += l * dO; });
      if (d[1] > 0 && ang > 6) sky += l * d[1] * dO; } }
  console.log(id, 'elev', (Math.asin(s[1]) * 180 / Math.PI).toFixed(1), 'maxL', maxL.toFixed(0), 'E(<r):', radii.map((r, k) => `${r}:${E[k].toFixed(2)}`).join(' '), 'skyHoriz(ex6)', sky.toFixed(2));
}
