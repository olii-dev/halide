import puppeteer from 'puppeteer-core';
const car = process.argv[2] || 'porsche930';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=512', '--renderer-process-limit=1', '--disable-extensions'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.setViewport({ width: 800, height: 500 });
await p.goto(`http://localhost:4173/?car=${car}&loc=${process.argv[3] || 'zwartkops'}&dof=0`, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 400000 });
await new Promise(r => setTimeout(r, 8000));
console.log('info', JSON.stringify(await p.evaluate(() => { const c = halide.cars[0]; const B = new halide.THREE.Box3().setFromObject(c.model, true); return { model: c.s.model, wheels: c.wheels.length, steers: c.steers.length, paint: c.paintSlots.length, minY: B.min.y.toFixed(3), size: B.getSize(new halide.THREE.Vector3()).toArray().map(v => v.toFixed(2)) }; })));
await p.screenshot({ path: `/tmp/car-${car}-ui.png` });
await p.evaluate(() => { document.body.classList.add('panel-closed', 'shooting'); for (const s of ['#shutter', '#panelBtn', '#top', '#toast']) { const e = document.querySelector(s); if (e) e.style.display = 'none'; } });
for (const [rot, steer, name] of [[30, 25, 'q3'], [90, 0, 'side']]) {
  await p.evaluate((r, st) => { const c = halide.cars[0]; c.s.steer = st; c.s.rot = r; halide.markDirty(); }, rot, steer);
  await new Promise(r => setTimeout(r, 15000));
  await p.screenshot({ path: `/tmp/car-${car}-${name}.png` }); console.log('shot', name);
}
await b.close(); console.log('done');
