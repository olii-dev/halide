import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 200000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=384', '--renderer-process-limit=1'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await p.goto('http://localhost:4173/?loc=goegap_road&dof=0&sm=1024&lo=1', { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready', { timeout: 150000 });
await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#833'; g.fillRect(0, 0, 640, 400); g.fillStyle = '#fff'; g.font = '60px sans-serif'; g.fillText('TEST', 220, 220);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg')); const scene = halide.snapshotScene();
  const d = await new Promise((res, rej) => { const r = indexedDB.open('halide', 1); r.onupgradeneeded = () => r.result.createObjectStore('shots', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const t = d.transaction('shots', 'readwrite'); t.objectStore('shots').put({ id: 'test1', ts: Date.now() - 60000, blob, thumb: blob, w: 640, h: 400, scene, name: 'halide-goegap.jpg', where: 'Goegap · Desert road', exif: '35mm · f/2.8' }); t.oncomplete = res; t.onerror = () => rej(t.error); });
});
await p.evaluate(() => document.querySelector('#top .galleryBtn').click()); await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => document.querySelector('.g-item').click()); await new Promise(r => setTimeout(r, 1000)); await p.screenshot({ path: '/tmp/dup-viewer.png' });
await p.evaluate(() => document.querySelector('#viewer .v-dup').click()); await new Promise(r => setTimeout(r, 2500));
const n = await p.evaluate(async () => { const d = await new Promise(res => { const r = indexedDB.open('halide', 1); r.onsuccess = () => res(r.result); }); return new Promise(res => { const q = d.transaction('shots').objectStore('shots').getAll(); q.onsuccess = () => res(q.result.map(x => [x.id, x.name, !!x.scene, x.blob.size])); }); });
console.log('shots', JSON.stringify(n), n.length === 2 && n.every(x => x[2]) ? 'DUP-OK' : 'DUP-FAIL');
await p.screenshot({ path: '/tmp/dup-after.png' });
await p.evaluate(() => document.querySelector('#viewer .v-back').click()); await new Promise(r => setTimeout(r, 800)); await p.screenshot({ path: '/tmp/dup-grid.png' });
await b.close(); console.log('done');
