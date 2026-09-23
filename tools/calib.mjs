import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 320, height: 180 });
p.on('console', m => { if (m.text().startsWith('env')) console.log(m.text()); });
await p.goto('http://localhost:5173/?sm=256&dof=0&lo=1', { timeout: 120000 });
await p.waitForFunction('window.halide', { timeout: 200000, polling: 1000 });
for (const id of ['goegap_road','wide_street_01','modern_evening_street','cobblestone_street_night','mealie_road']) { await p.evaluate(id => window.halide.setLocation(id), id); }
await b.close();
