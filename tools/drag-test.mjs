import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { const t = m.text(); if (/^(grab|drag)/.test(t)) console.log(t); });
await p.setViewport({ width: 960, height: 640 });
await p.goto('http://localhost:5173/?loc=derelict_highway_noon&dof=0&dbg=1', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
await p.evaluate(() => { document.body.classList.add('panel-closed', 'shooting'); for (const s of ['#shutter', '#panelBtn', '#top', '#toast']) { const e = document.querySelector(s); if (e) e.style.display = 'none'; } });
// steering: yaw of each front wheel group relative to the car body
console.log('steer', JSON.stringify(await p.evaluate(async () => { const c = halide.cars[0]; c.s.steer = 25; halide.markDirty(); await new Promise(r => setTimeout(r, 1500));
  const T = halide.THREE; const qc = c.model.getWorldQuaternion(new T.Quaternion()).invert();
  return c.steers.map(st => { const q = st.g.getWorldQuaternion(new T.Quaternion()).premultiply(qc); const v = new T.Vector3(0, 0, 1).applyQuaternion(q); const bq = st.base; return +(Math.atan2(v.x, v.z) * 180 / Math.PI).toFixed(1); }); })));
const scr = () => p.evaluate(() => { const c = halide.cars[0]; const v = c.holder.position.clone().setY(0.6).project(halide.camera); const R = document.querySelector('canvas').getBoundingClientRect(); return { x: Math.round(R.left + (v.x + 1) / 2 * R.width), y: Math.round(R.top + (1 - v.y) / 2 * R.height), lat: c.s.lat, near: c.s.near, rot: c.s.rot }; });
const a = await scr(); console.log('before', JSON.stringify(a));
await p.mouse.move(a.x, a.y); await p.mouse.down();
for (let i = 1; i <= 10; i++) { await p.mouse.move(a.x + 18 * i, a.y + 4 * i); await new Promise(r => setTimeout(r, 150)); }
await p.mouse.up(); await new Promise(r => setTimeout(r, 1000));
const m = await scr(); console.log('after', JSON.stringify(m), 'expected ~', a.x + 180, a.y + 40);
// drag on empty sky should not move it
await p.mouse.move(100, 60); await p.mouse.down(); await p.mouse.move(300, 80, { steps: 8 }); await p.mouse.up(); await new Promise(r => setTimeout(r, 800));
console.log('after-sky', JSON.stringify(await scr()));
await new Promise(r => setTimeout(r, 10000)); await p.screenshot({ path: '/tmp/drag-after.png' });
await b.close(); console.log('done');
