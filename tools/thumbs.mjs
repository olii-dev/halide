import puppeteer from 'puppeteer-core'; import { execFileSync } from 'child_process';
const ids = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: 960, height: 596 });
for (const id of ids) {
  await p.goto(`http://localhost:5173/?loc=${id}`, { waitUntil: 'load', timeout: 120000 }); await p.waitForFunction('window.__ready && window.__hi', { timeout: 300000 });
  await p.evaluate(() => { document.body.classList.add('panel-closed', 'shooting'); for (const s of ['#shutter', '#panelBtn', '#top', '#toast']) document.querySelector(s).style.display = 'none'; });
  await new Promise(r => setTimeout(r, 5000));
  await p.screenshot({ path: `/tmp/th-${id}.png` });
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('/tmp/th-${id}.png').convert('RGB').resize((640,397), Image.LANCZOS).save('public/assets/thumbs/${id}.jpg', quality=86)`]);
  console.log('thumb', id);
}
await b.close(); console.log('ALLDONE');
