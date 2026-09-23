// Converts 8k Poly Haven HDRs into sharp LDR backdrops (JPEG, sRGB-encoded
// linear / white point). The 2k HDR still drives lighting; this is only what
// you see behind the car. White point per location goes to backdrops.json.
import fs from 'fs'; import { execFileSync } from 'child_process';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { FloatType } from 'three';
const [src, outDir] = process.argv.slice(2);
const L = new HDRLoader(); L.setDataType(FloatType);
const meta = fs.existsSync(`${outDir}/backdrops.json`) ? JSON.parse(fs.readFileSync(`${outDir}/backdrops.json`)) : {};
for (const f of fs.readdirSync(src).filter(f => f.endsWith('_8k.hdr'))) {
  const id = f.replace('_8k.hdr', ''); const buf = fs.readFileSync(`${src}/${f}`);
  const { data, width: W, height: H } = L.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const lum = new Float32Array(W * H / 64); let k = 0;
  for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { const i = (y * W + x) * 4; lum[k++] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; }
  const sorted = Float32Array.from(lum).sort(); const white = Math.max(sorted[Math.floor(sorted.length * 0.997)] * 1.15, 1e-3);
  const rgb = Buffer.alloc(W * H * 3);
  const enc = v => { v = Math.min(Math.max(v / white, 0), 1); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
  for (let p = 0, q = 0; p < W * H * 4; p += 4, q += 3) { rgb[q] = enc(data[p]); rgb[q + 1] = enc(data[p + 1]); rgb[q + 2] = enc(data[p + 2]); }
  fs.writeFileSync('/tmp/bd.rgb', rgb);
  execFileSync('python3', ['-c', `from PIL import Image; im=Image.frombytes('RGB',(${W},${H}),open('/tmp/bd.rgb','rb').read()); im.save('${outDir}/${id}_8k.jpg',quality=90,optimize=True,subsampling=0); im.resize((${W / 2},${H / 2}),Image.LANCZOS).save('${outDir}/${id}_4k.jpg',quality=90,optimize=True)`]);
  meta[id] = { white: +white.toFixed(4) }; console.log(id, W, H, 'white', white.toFixed(3));
  fs.writeFileSync(`${outDir}/backdrops.json`, JSON.stringify(meta, null, 1));
}
