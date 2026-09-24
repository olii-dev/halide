import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 960, height: 640 });
await p.goto('http://localhost:5173/?loc=simons_town_harbour&dof=0&lo=1', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
console.log(JSON.stringify(await p.evaluate(async () => {
  const c = halide.cars[0]; c.s.steer = 25; halide.markDirty(); await new Promise(r => setTimeout(r, 1000));
  return c.steers.map(st => ({ q: st.g.quaternion.toArray().map(v => +v.toFixed(3)), kids: st.g.children.map(k => k.name + ':' + k.children.map(x => x.name + '[' + x.children.map(y => y.name).join(',') + ']').join(';')), up: st.up.toArray().map(v => +v.toFixed(2)) }));
})));
await b.close();
