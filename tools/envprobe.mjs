import puppeteer from 'puppeteer-core';
const locs = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 200000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=512'] });
const p = await b.newPage(); await p.setViewport({ width: 640, height: 360 });
for (const loc of locs) {
  await p.goto(`http://localhost:4173/?loc=${loc}&lo=1`, { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction('window.__env && window.__ready', { timeout: 120000 });
  console.log(loc, JSON.stringify(await p.evaluate(() => window.__env)));
}
await b.close();
