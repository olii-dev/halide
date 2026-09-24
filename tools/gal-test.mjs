import puppeteer from 'puppeteer-core';
const [url, prefix, w = 1440, h = 900] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: +w, height: +h });
await p.goto(url + '&ex=800', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
for (let i = 0; i < 2; i++) {
  await p.evaluate(i => { halide.carS.rot = i ? 150 : 30; halide.markDirty(); }, i);
  await p.click('#shutter'); await p.waitForFunction(() => document.querySelector('#reveal').classList.contains('show'), { timeout: 300000 });
  await new Promise(r => setTimeout(r, 2500)); if (i === 0) await p.screenshot({ path: `${prefix}-reveal.png` });
  await p.click('#reveal .back'); await new Promise(r => setTimeout(r, 1000));
}
await p.click('#top .galleryBtn'); await new Promise(r => setTimeout(r, 2000));
console.log('items', await p.evaluate(() => document.querySelectorAll('.g-item').length), await p.evaluate(() => document.querySelector('.g-count').textContent));
await p.screenshot({ path: `${prefix}-gallery.png` });
await p.click('.g-item'); await new Promise(r => setTimeout(r, 1500)); await p.screenshot({ path: `${prefix}-viewer.png` });
await b.close(); console.log('done');
