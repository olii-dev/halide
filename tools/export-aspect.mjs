import puppeteer from 'puppeteer-core'; import fs from 'fs';
const [url] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 1200, height: 800 });
await p.goto(url, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
for (const a of ['21:9', '1:1']) {
  const r = await p.evaluate(async a => { halide.state.aspect = a; halide.state.dof = false; const { blob, w, h } = await halide.exportPhoto(900); const buf = await blob.arrayBuffer(); return { w, h, b64: btoa(String.fromCharCode(...new Uint8Array(buf))) }; }, a);
  fs.writeFileSync(`/tmp/ex-${a.replace(':', 'x')}.jpg`, Buffer.from(r.b64, 'base64')); console.log(a, r.w, r.h);
}
await p.evaluate(() => { halide.state.aspect = '21:9'; halide.markDirty(); }); await new Promise(r => setTimeout(r, 3000)); await p.screenshot({ path: '/tmp/ex-view.png' });
await b.close(); console.log('done');
