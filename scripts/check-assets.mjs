// Refuse to deploy if any scene or car is missing a file (public/assets is not in git, so a wiped workspace can lose some)
import fs from 'fs';
const { LOCATIONS } = await import('../src/locations.js'); const { MODELS } = await import('../src/cars.js');
const meta = JSON.parse(fs.readFileSync('public/assets/backdrop/backdrops.json'));
const miss = [];
for (const L of LOCATIONS) {
  const files = L.plate ? [`plate/${L.id}.jpg`, `hdri/${L.light}_2k.hdr`, `thumbs/${L.id}.jpg`] : [`hdri/${L.id}_2k.hdr`, `backdrop/${L.id}_8k.jpg`, `backdrop/${L.id}_4k.jpg`, `thumbs/${L.id}.jpg`];
  for (const f of files) if (!fs.existsSync(`public/assets/${f}`)) miss.push(f);
  if (!L.plate && !meta[L.id]) miss.push(`backdrops.json:${L.id}`); if (L.plate && !L.credit) miss.push(`credit:${L.id}`);
}
for (const M of MODELS) for (const f of [`cars/${M.file}`, `carthumbs/${M.id}.jpg`]) if (!fs.existsSync(`public/assets/${f}`)) miss.push(f);
if (miss.length) { console.error('MISSING ASSETS:\n' + miss.join('\n')); process.exit(1); } else console.log(`assets ok: ${LOCATIONS.length} scenes, ${MODELS.length} cars`);
