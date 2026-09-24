import puppeteer from 'puppeteer-core';
const tag = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 200000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 1100, height: 650 });
await p.goto('http://localhost:4173/?loc=goegap_road&dof=0&sm=1024&lo=1&f=50&grain=0&ca=0', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 150000 });
await p.evaluate(async (M) => { await halide.setCarModel(halide.cars[0], M); halide.setPaint('gloss'); halide.carS.rot = 35; halide.frameCar?.(); halide.markDirty(); }, process.env.M || 'c8');
await new Promise(r => setTimeout(r, +(process.env.W || 25000))); await p.screenshot({ path: `/tmp/real-${tag}.png` }); console.log('shot');
await b.close(); console.log('done');
