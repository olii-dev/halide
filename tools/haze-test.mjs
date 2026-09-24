import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 100000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => /error|ERR/i.test(m.text()) && console.log('C', m.text().slice(0, 300)));
await p.setViewport({ width: 1000, height: 640 });
await p.goto(`http://localhost:4173/?loc=${process.env.LOC || 'goegap_road'}&dof=0&sm=1024&lo=1&f=50&grain=0&ca=0&haze=${process.env.H || 0}`, { waitUntil: 'load', timeout: 60000 }); await p.waitForFunction('window.__ready', { timeout: 60000 });
await p.evaluate(async (M, X) => { document.body.classList.remove('in-menu'); await halide.setCarModel(halide.cars[0], M); halide.cars[0].s.rot = 30; if (X) eval(X); halide.markDirty(); }, process.env.M || 'bmwm3e30', process.env.X || '');
await new Promise(r => setTimeout(r, 15000)); await p.screenshot({ path: `/tmp/haze-${process.env.H || 0}.png` }); console.log('shot');
await b.close();
