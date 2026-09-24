import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 100000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
const [w, h] = (process.env.VP || '1280x800').split('x').map(Number);
await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
await p.goto('http://localhost:4173/?lo=1&sm=512', { waitUntil: 'load', timeout: 60000 });
await new Promise(r => setTimeout(r, 4000));
if (process.env.F) await p.click(`#menu .chip[data-f="${process.env.F}"]`);
await new Promise(r => setTimeout(r, +(process.env.W || 1500)));
await p.screenshot({ path: `/tmp/menu-${process.env.N || 'a'}.png` });
if (process.env.CLICK) { await p.click('#menu .m-grid .card:nth-child(' + (process.env.NTH || 1) + ')'); await new Promise(r => setTimeout(r, +(process.env.LW || 700))); if (process.env.FORCE) await p.evaluate(() => document.body.classList.add('scene-loading')); await p.screenshot({ path: `/tmp/menu-${process.env.N || 'a'}-load.png` }); }
console.log('ok', await p.evaluate(() => document.querySelectorAll('#menu .m-grid .card').length));
await b.close();
