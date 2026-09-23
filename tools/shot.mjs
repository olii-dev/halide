import puppeteer from 'puppeteer-core';
const [url, out, w = 1600, h = 900] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('console', m => console.log('page:', m.text()));
p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: +w, height: +h });
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction('window.__ready', { timeout: 180000 }); if (process.env.HI) await p.waitForFunction('window.__hi', { timeout: 180000 });
await new Promise(r => setTimeout(r, 4000));
await p.screenshot({ path: out });
await b.close();
