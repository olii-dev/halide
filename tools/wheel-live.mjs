import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 1000, height: 640 });
await p.goto('https://halide.mebbo.cloud/?loc=simons_town_harbour&dof=0', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
await p.evaluate(() => { document.body.classList.add('panel-closed', 'shooting'); for (const s of ['#shutter', '#panelBtn', '#top', '#toast']) { const e = document.querySelector(s); if (e) e.style.display = 'none'; } });
for (const st of [0]) {
  await p.evaluate(st => { const c = halide.cars[0]; c.s.steer = st; c.s.rot = 240; c.s.near = 9.34; halide.markDirty(); }, st);
  await new Promise(r => setTimeout(r, 9000)); await p.screenshot({ path: `/tmp/wt-${st}.png` }); console.log('shot', st);
}
await b.close();
