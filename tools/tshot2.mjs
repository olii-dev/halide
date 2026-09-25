import puppeteer from 'puppeteer-core';
const [url, out] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 200000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=512'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.setViewport({ width: +(process.env.W || 900), height: +(process.env.H || 506) });
await p.goto(url, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction('window.__ready', { timeout: 120000 });
try { await p.waitForFunction('window.__hi', { timeout: 45000 }); } catch {}
await p.evaluate(() => { document.body.classList.remove('in-menu'); const el = document.querySelector('#panel'); if (el) el.style.display = 'none'; });
if (process.env.EVAL) { const r = await p.evaluate(process.env.EVAL); if (r !== undefined) console.log('EVAL:', JSON.stringify(r)); }
await new Promise(r => setTimeout(r, +(process.env.WAIT || 5000)));
await p.screenshot({ path: out }); console.log('shot', out);
await b.close();
