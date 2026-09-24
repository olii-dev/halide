import puppeteer from 'puppeteer-core';
const M = process.env.M || 'c8', R = +(process.env.R || 20);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 100000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 1000, height: 640 });
await p.goto(`http://localhost:4173/?loc=cobblestone_street_night&dof=0&sm=1024&lo=1&f=50&grain=0&ca=0`, { waitUntil: 'load', timeout: 60000 }); await p.waitForFunction('window.__ready', { timeout: 60000 });
for (const M of (process.env.MS || 'bmwm3e30').split(',')) {
  const r = await p.evaluate(async (M) => { await halide.setCarModel(halide.cars[0], M); const c = halide.cars[0]; const T = halide.THREE; c.model.updateMatrixWorld(true);
    const carX = new T.Vector3(1, 0, 0).transformDirection(c.model.matrixWorld);
    return c.wheels.map(w => { let best = null; w.pivot.traverse(m => { if (!m.isMesh) return; m.geometry.computeBoundingBox(); const e = m.geometry.boundingBox.getSize(new T.Vector3()), d = [e.x, e.y, e.z].sort((a, b) => a - b);
        if (d[0] < 0.7 * d[1] && (!best || d[2] > best.d)) best = { m, d: d[2], k: e.x === d[0] ? 0 : e.y === d[0] ? 1 : 2 }; });
      const ta = best ? new T.Vector3().setComponent(best.k, 1).transformDirection(best.m.matrixWorld) : null; const ax = w.axis.clone().transformDirection(w.pivot.parent.matrixWorld);
      return [w.pivot.parent.name, ta ? (Math.acos(Math.min(1, Math.abs(ta.dot(carX)))) * 57.3).toFixed(2) : '-', ta ? (Math.acos(Math.min(1, Math.abs(ta.dot(ax)))) * 57.3).toFixed(2) : '-']; }); }, M);
  console.log(M, JSON.stringify(r)); }
await b.close();
