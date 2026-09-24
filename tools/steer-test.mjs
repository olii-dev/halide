import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 960, height: 640 });
await p.goto('http://localhost:5173/?loc=derelict_highway_noon&dof=0', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
await p.evaluate(() => { document.body.classList.add('panel-closed', 'shooting'); for (const s of ['#shutter', '#panelBtn', '#top', '#toast']) { const e = document.querySelector(s); if (e) e.style.display = 'none'; } });
console.log('steers', await p.evaluate(() => halide.cars[0].steers.length)); for (const [rot, name] of [[30, 'q3'], [-30, 'q3b']]) {
  await p.evaluate(r => { const c = halide.cars[0]; c.s.steer = 30; c.s.rot = r; halide.markDirty(); }, rot);
  await new Promise(r => setTimeout(r, 12000));
  await p.screenshot({ path: `/tmp/steer-${name}.png` }); console.log('shot', name);
}
await b.close(); console.log('done');
