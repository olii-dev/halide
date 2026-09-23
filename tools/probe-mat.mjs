import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 400, height: 225 });
await p.goto('http://localhost:5173/?loc=mealie_road&sm=256&dof=0', { timeout: 120000 });
await p.waitForFunction('window.halide', { timeout: 200000, polling: 1000 });
console.log(await p.evaluate(() => { const r = []; window.halide.car.traverse(o => { if (o.isMesh && /Tire/.test(o.material.name)) r.push([o.name, o.material.name, o.material.type, o.material.color.getHexString(), o.material.roughness, o.material.metalness, !!o.material.map, !!o.material.normalMap, o.material.envMapIntensity, o.material.emissive?.getHexString(), o.material.emissiveIntensity, !!o.material.emissiveMap]); }); return JSON.stringify(r); }));
await b.close();
