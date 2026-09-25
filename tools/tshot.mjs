import puppeteer from 'puppeteer-core';
const [url, out, wait = '8', w = '1280', h = '720'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 300000,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=512'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: +w, height: +h });
await p.goto(url, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction('window.__ready', { timeout: 120000 });
try { await p.waitForFunction('window.__hi', { timeout: 60000 }); } catch { console.log('no __hi'); }
await p.evaluate(() => { document.body.classList.remove('in-menu'); const el = document.querySelector('#panel'); if (el) el.style.display = 'none'; });
await new Promise(r => setTimeout(r, +wait * 1000));
await p.screenshot({ path: out });
console.log('shot', out);
await b.close();
