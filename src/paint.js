// Automotive paint: metallic base with real flake (a high-frequency normal
// map on the base layer only, so flakes sparkle under the sun and average out
// with distance through mipmapping) under a smooth, glossy clearcoat.
import * as THREE from 'three';

function flakeTexture(size = 512) {
  const data = new Uint8Array(size * size * 4);
  let s = 1337; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cell = 2;
  for (let y = 0; y < size; y += cell) for (let x = 0; x < size; x += cell) {
    // random tilt, mostly small, some flakes steep (those give the glints)
    const a = rnd() * Math.PI * 2, t = Math.pow(rnd(), 1.6) * 0.55;
    const nx = Math.cos(a) * Math.sin(t), ny = Math.sin(a) * Math.sin(t), nz = Math.cos(t);
    for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) {
      const k = ((y + j) * size + (x + i)) * 4;
      data[k] = (nx * 0.5 + 0.5) * 255; data[k + 1] = (ny * 0.5 + 0.5) * 255; data[k + 2] = (nz * 0.5 + 0.5) * 255; data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
const FLAKE = flakeTexture();

export const PAINTS = [
  { id: 'rosso', name: 'Rosso Candy', color: '#8a0410', metalness: 0.9, roughness: 0.35, flake: 0.5 },
  { id: 'silver', name: 'Liquid Silver', color: '#b9bcbf', metalness: 0.9, roughness: 0.28, flake: 0.45 },
  { id: 'midnight', name: 'Midnight Blue', color: '#0a1a3a', metalness: 0.7, roughness: 0.3, flake: 0.6 },
  { id: 'pearl', name: 'Pearl White', color: '#e8e6e0', metalness: 0.1, roughness: 0.35, flake: 0.2, iridescence: 0.35 },
  { id: 'racing', name: 'Racing Green', color: '#0c2a17', metalness: 0.5, roughness: 0.3, flake: 0.5 },
  { id: 'solar', name: 'Solar Orange', color: '#d2480a', metalness: 0.35, roughness: 0.3, flake: 0.35 },
  { id: 'graphite', name: 'Satin Graphite', color: '#2a2b2d', metalness: 0.65, roughness: 0.55, flake: 0.3, clearRough: 0.35 },
  { id: 'gloss', name: 'Gloss Black', color: '#040404', metalness: 0.0, roughness: 0.45, flake: 0.0, clearRough: 0.012 },
];

// finish presets override the paint's own surface (colour stays)
export const FINISHES = [
  { id: 'paint', name: 'Factory' },
  { id: 'gloss', name: 'Gloss', metalness: 0.02, roughness: 0.4, flake: 0, clearRough: 0.012, iridescence: 0 },
  { id: 'metallic', name: 'Metallic', metalness: 0.85, roughness: 0.32, flake: 0.5, clearRough: 0.03, iridescence: 0 },
  { id: 'pearl', name: 'Pearl', metalness: 0.3, roughness: 0.3, flake: 0.25, clearRough: 0.03, iridescence: 0.4 },
  { id: 'satin', name: 'Satin', metalness: 0.5, roughness: 0.5, flake: 0.15, clearRough: 0.38, iridescence: 0 },
  { id: 'matte', name: 'Matte', metalness: 0.25, roughness: 0.72, flake: 0, clearcoat: 0, iridescence: 0 },
];
export function resolvePaint(presetId, finishId, color) {
  const p = PAINTS.find(x => x.id === presetId) || PAINTS[0];
  const f = FINISHES.find(x => x.id === finishId);
  const out = { ...p, ...(f && f.id !== 'paint' ? f : {}), id: p.id, name: p.name };
  if (color) out.color = color;
  return out;
}

export function makePaint(p, template) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.color), metalness: p.metalness, roughness: p.roughness,
    clearcoat: p.clearcoat ?? 1, clearcoatRoughness: p.clearRough ?? 0.03,
    normalMap: p.flake > 0 ? FLAKE : null, normalScale: new THREE.Vector2(p.flake, p.flake),
    iridescence: p.iridescence ?? 0, iridescenceIOR: 1.3, iridescenceThicknessRange: [250, 600],
    sheen: p.sheen ?? 0, sheenColor: new THREE.Color(p.sheenColor ?? '#000000'), sheenRoughness: 0.35,
    specularColor: new THREE.Color(p.spec ?? '#ffffff'),
    // under a clearcoat the basecoat's own shine is weak: without this, solid and dark paints get a broad
    // soft highlight on top of the coat's sharp one, which is exactly what makes them read as plastic
    specularIntensity: p.metalness > 0.5 ? 1 : 0.25,
    envMapIntensity: 1, side: THREE.DoubleSide,
  });
  if (m.normalMap) { m.normalMap = FLAKE.clone(); m.normalMap.repeat.set(24, 24); m.normalMap.needsUpdate = true; }
  if (template?.aoMap) { m.aoMap = template.aoMap; m.aoMapIntensity = template.aoMapIntensity ?? 1; }
  return m;
}

export function plateTexture(text = 'HALIDE') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e7df'; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 10; g.strokeRect(12, 12, 1000, 232);
  g.fillStyle = '#161616'; g.font = 'bold 150px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 512, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
