import puppeteer from 'puppeteer-core';
const [url, out] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 960, height: 540 });
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction('window.__ready', { timeout: 300000, polling: 1000 });
await new Promise(r => setTimeout(r, 3000));
const idle0 = await p.evaluate(() => ({ lo: __perf.lo.length, hi: __perf.hi.length }));
await new Promise(r => setTimeout(r, 3000));
const idle1 = await p.evaluate(() => ({ lo: __perf.lo.length, hi: __perf.hi.length }));
console.log('idle 3s: new renders', idle1.lo - idle0.lo, idle1.hi - idle0.hi);
// drag off-car to turn
const yaw0 = await p.evaluate(() => halide.rig.carYaw);
await p.mouse.move(100, 300); await p.mouse.down(); for (let i = 1; i <= 6; i++) { await p.mouse.move(100 + i * 20, 300); await new Promise(r => setTimeout(r, 300)); } await p.mouse.up();
const yaw1 = await p.evaluate(() => halide.rig.carYaw);
console.log('turn drag yaw delta', (yaw1 - yaw0).toFixed(3));
// drag the car itself (center of car)
const pos0 = await p.evaluate(() => halide.carHolder.position.toArray().map(v => +v.toFixed(2)));
await p.mouse.move(480, 300); await p.mouse.down(); for (let i = 1; i <= 5; i++) { await p.mouse.move(480 + i * 25, 300); await new Promise(r => setTimeout(r, 300)); } await p.mouse.up();
await new Promise(r => setTimeout(r, 1500));
const pos1 = await p.evaluate(() => halide.carHolder.position.toArray().map(v => +v.toFixed(2)));
console.log('car move', JSON.stringify(pos0), '->', JSON.stringify(pos1));
// trackpad swipe
await p.mouse.move(700, 150); await p.mouse.wheel({ deltaX: 60 }); await new Promise(r => setTimeout(r, 500));
console.log('swipe yaw', (await p.evaluate(() => halide.rig.carYaw) - yaw1).toFixed(3));
await new Promise(r => setTimeout(r, 2000));
const perf = await p.evaluate(() => __perf);
const med = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1].toFixed(0) : '-';
console.log('lo frames', perf.lo.length, 'median ms', med(perf.lo), '| hi frames', perf.hi.length, 'median ms', med(perf.hi));
await p.screenshot({ path: out });
await b.close();
