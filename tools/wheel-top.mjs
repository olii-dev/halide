import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 800, height: 600 });
await p.goto('http://localhost:5173/?loc=simons_town_harbour&dof=0&lo=1', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
await p.evaluate(() => { document.body.classList.add('panel-closed', 'shooting'); for (const s of ['#shutter', '#panelBtn', '#top', '#toast']) { const e = document.querySelector(s); if (e) e.style.display = 'none'; } });
for (const st of [0, 25]) {
  await p.evaluate(st => { const c = halide.cars[0]; c.s.steer = st; c.s.rot = 90; c.s.near = 5; halide.rig.camH = 1.7; halide.frameCar(); halide.rig.tilt = -12; halide.markDirty(); }, st);
  await new Promise(r => setTimeout(r, 9000)); await p.screenshot({ path: `/tmp/wt-${st}.png` }); console.log('shot', st);
}
await b.close();
