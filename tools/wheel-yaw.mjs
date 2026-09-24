import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 960, height: 640 });
await p.goto('http://localhost:5173/?loc=simons_town_harbour&dof=0&lo=1', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
for (const st of [0, 25]) {
  console.log('steer', st, JSON.stringify(await p.evaluate(async st => {
    const T = halide.THREE, c = halide.cars[0]; c.s.steer = st; halide.markDirty(); await new Promise(r => setTimeout(r, 800));
    c.holder.updateMatrixWorld(true); const inv = new T.Matrix4().copy(c.model.matrixWorld).invert(); const out = {};
    c.model.traverse(o => { if (!/^Wheel(Front|Rear)[LR]$/.test(o.name)) return;
      // axle = direction of least spread of the wheel's vertices, in car space
      const pts = []; o.traverse(m => { if (!m.isMesh) return; const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 7) pts.push(new T.Vector3().fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv)); });
      const mean = pts.reduce((a, v) => a.add(v), new T.Vector3()).divideScalar(pts.length);
      let best = null; for (let a = -45; a <= 45; a += 0.25) { const r = a * Math.PI / 180, d = new T.Vector3(Math.cos(r), 0, -Math.sin(r)); let s = 0; for (const v of pts) { const t = v.clone().sub(mean).dot(d); s += t * t; } if (!best || s < best[1]) best = [a, s]; }
      out[o.name] = best[0]; });
    return out; }, st)));
}
await b.close();
