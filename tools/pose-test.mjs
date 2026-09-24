import puppeteer from 'puppeteer-core';
const M = process.env.M || 'c8', R = +(process.env.R || 20);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 100000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 1000, height: 640 });
await p.goto(`http://localhost:4173/?loc=cobblestone_street_night&dof=0&sm=1024&lo=1&f=50&grain=0&ca=0`, { waitUntil: 'load', timeout: 60000 }); await p.waitForFunction('window.__ready', { timeout: 60000 });
const ANG = +(process.env.ANG || 90), ST = +(process.env.ST || 29.5);
await p.evaluate(async (M, ANG, ST) => { document.body.classList.remove('in-menu'); document.querySelector('#panel').style.display = 'none';
  await halide.setCarModel(halide.cars[0], M); const c = halide.cars[0]; c.s.rot = 20; c.s.near = 7; c.s.steer = ST; halide.markDirty();
  await new Promise(r => setTimeout(r, 500));
  const q = new halide.THREE.Quaternion(); for (const w of c.wheels) { q.setFromAxisAngle(w.axis, ANG * Math.PI / 180); w.pivot.quaternion.copy(w.base).multiply(q); }
  halide.markDirty(); }, M, ANG, ST);
await new Promise(r => setTimeout(r, 15000)); await p.screenshot({ path: `/tmp/pose-${M}-${ANG}.png` }); console.log('shot');
await b.close();
