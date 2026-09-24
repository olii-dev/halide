import puppeteer from 'puppeteer-core';
const IDS = (process.env.IDS || '').split(',').filter(Boolean);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 100000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 900, height: 560 });
await p.goto(`http://localhost:4173/?loc=${IDS[0]}&dof=0&sm=1024&lo=1&f=35&grain=0&ca=0`, { waitUntil: 'load', timeout: 60000 }); await p.waitForFunction('window.__ready', { timeout: 60000 });
await p.evaluate(async M => { document.body.classList.remove('in-menu'); await halide.setCarModel(halide.cars[0], M); halide.markDirty(); }, process.env.M || 'bmwm3e30');
for (const id of IDS) {
  const env = await p.evaluate(async id => { await halide.setLocation(id); halide.resetScene(); halide.markDirty(); return window.__env; }, id);
  await new Promise(r => setTimeout(r, +(process.env.W || 9000))); await p.screenshot({ path: `/tmp/loc-${id}.jpg`, quality: 80, clip: { x: 0, y: 0, width: 560, height: 560 } }); console.log(id, JSON.stringify(env));
}
await b.close();
