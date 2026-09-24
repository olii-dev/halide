import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 100000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
for (const [n, vp] of [['desk', { width: 1100, height: 700 }], ['phone', { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
  await p.setViewport(vp);
  await p.goto('http://localhost:4173/?loc=goegap_road&dof=0&sm=512&lo=1', { waitUntil: 'load', timeout: 60000 }); await p.waitForFunction('window.__ready', { timeout: 60000 });
  await p.evaluate(() => { document.body.classList.remove('in-menu'); const c = document.querySelector('.cards'); c.scrollIntoView({ block: 'center' }); });
  await new Promise(r => setTimeout(r, 4000)); await p.screenshot({ path: `/tmp/picker-${n}.png` }); console.log('shot', n);
}
await b.close();
