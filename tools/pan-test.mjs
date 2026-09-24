import puppeteer from 'puppeteer-core'; import fs from 'fs';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CERR', m.text()); });
await p.setViewport({ width: 1200, height: 800 });
await p.goto('http://localhost:5173/?loc=rural_asphalt_road&kmh=80', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 300000 });
const r = await p.evaluate(async () => { halide.state.panBlur = true; halide.state.aspect = '3:2'; halide.state.shutter = 30; halide.state.dof = false; const { blob, w, h } = await halide.exportPhoto(1000); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192)); return { w, h, b64: btoa(s) }; });
fs.writeFileSync('/tmp/pan.jpg', Buffer.from(r.b64, 'base64')); console.log('pan', r.w, r.h);
await b.close(); console.log('done');
