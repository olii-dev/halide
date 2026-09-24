import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 960, height: 640 });
await p.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
await p.screenshot({ path: '/tmp/sc-menu.png' });
for (const id of ['simons_town_harbour', 'cobblestone_street_night']) {
  await p.evaluate(() => { const c = halide.cars[0]; c.s.rot = 170; c.s.lat = 4; halide.state.grain = 1; halide.state.look = 'mono'; });
  await p.evaluate(() => document.querySelector('#scenesBtn').click()); await new Promise(r => setTimeout(r, 500));
  await p.evaluate(id => document.querySelector(`.card[data-id="${id}"]`).click(), id);
  await new Promise(r => setTimeout(r, 1500)); const mid = await p.evaluate(() => document.body.classList.contains('scene-loading'));
  await p.waitForFunction(() => !document.body.classList.contains('scene-loading'), { timeout: 200000 }); await new Promise(r => setTimeout(r, 4000));
  console.log(id, 'loadingShown', mid, JSON.stringify(await p.evaluate(() => ({ loc: halide.state.loc, env: window.__env?.id, name: document.querySelector('#sceneName').textContent, rot: halide.cars[0].s.rot, lat: halide.cars[0].s.lat, grain: halide.state.grain, look: halide.state.look }))));
  await p.screenshot({ path: `/tmp/sc-${id}.png` });
}
await b.close(); console.log('done');
