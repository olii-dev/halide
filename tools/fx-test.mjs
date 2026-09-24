import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 200000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 800, height: 500 });
for (const [n, qs] of [['off', 'ca=0&grain=0'], ['on', 'ca=1&grain=0.8']]) {
  await p.goto(`http://localhost:4173/?loc=goegap_road&dof=0&sm=1024&lo=1&f=35&${qs}`, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 150000 });
  await p.evaluate(() => document.querySelector('#panel')?.style.setProperty('display', 'none'));
  await new Promise(r => setTimeout(r, 15000)); await p.screenshot({ path: `/tmp/fx-${n}.png` }); console.log('shot', n);
}
await b.close(); console.log('done');
