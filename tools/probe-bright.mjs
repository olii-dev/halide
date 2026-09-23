import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 640, height: 360 });
await p.goto('http://localhost:5173/?loc=mealie_road&paint=rosso&sm=512&lo=1&dof=0', { timeout: 120000 });
await p.waitForFunction('window.__ready && window.halide', { timeout: 300000, polling: 1000 });
await new Promise(r => setTimeout(r, 4000));
console.log('env', await p.evaluate(() => JSON.stringify(window.__env)));
const pts = { door: [0.4375, 0.47], fender: [0.625, 0.465], road: [0.55, 0.62], grass: [0.72, 0.42] };
async function sample(label) { await new Promise(r => setTimeout(r, 2500)); await p.screenshot({ path: `/tmp/pb-${label}.png` }); console.log('shot', label); }
const paint = (f) => p.evaluate(`window.halide.car.traverse(o => { if (o.isMesh && o.material.clearcoat === 1 && o.material.normalMap) { (${f})(o.material); o.material.needsUpdate = true; } })`);
await sample('A');
await paint('m => { m.metalness = 0.9; m.color.set(0x8a0410); m.roughness = 0.35; }'); await sample('B');
await p.evaluate('window.halide.sun.intensity *= 0.6'); await sample('C');
await b.close();
