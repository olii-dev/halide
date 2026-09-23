import puppeteer from 'puppeteer-core';
const [url, prefix, w = 1440, h = 900, mobile] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction('window.__ready', { timeout: 300000 });
await new Promise(r => setTimeout(r, 5000));
await p.screenshot({ path: `${prefix}-a.png` });
// click through real controls: steering +, headlights high, camera tab, effects tab
const clickText = async (sel, text) => p.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim() === text); el?.click(); return !!el; }, sel, text);
console.log('side', await clickText('.btns button', 'Rear ¾'));
await p.evaluate(() => { const s = [...document.querySelectorAll('.ctl')].find(c => c.querySelector('label')?.textContent === 'Steering'); const v = s.querySelector('.val'); v.value = '25'; v.dispatchEvent(new Event('change')); });
console.log('high', await clickText('.seg button', 'High beam'));
await new Promise(r => setTimeout(r, 5000));
await p.screenshot({ path: `${prefix}-b.png` });
console.log('state', await p.evaluate(() => JSON.stringify(halide.carS)));
await clickText('#panel .tabs button', 'Camera');
await new Promise(r => setTimeout(r, 800));
await p.screenshot({ path: `${prefix}-c.png` });
await clickText('#panel .tabs button', 'Effects');
await clickText('.seg button', '21:9'); await clickText('.seg button', 'Thirds'); await clickText('.seg button', 'B&W');
await new Promise(r => setTimeout(r, 5000));
await p.screenshot({ path: `${prefix}-d.png` });
if (!mobile) { const t0 = Date.now(); const r = await p.evaluate(async () => { const { w, h } = await halide.exportPhoto(1600); return w + 'x' + h; }); console.log('export', r, Date.now() - t0, 'ms'); }
await b.close();
