// Browser gallery: every developed photo is kept in IndexedDB on this device (never uploaded).
const DB = 'halide', STORE = 'shots';
let dbp = null;
function db() {
  dbp ??= new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbp;
}
async function tx(mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode); const s = t.objectStore(STORE); const out = fn(s); t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error); }); }
export async function thumbOf(blob, edge = 480) {
  const bmp = await createImageBitmap(blob); const k = edge / Math.max(bmp.width, bmp.height);
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
}
export async function saveShot(shot) {
  const rec = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), ...shot, thumb: await thumbOf(shot.blob) };
  await tx('readwrite', s => s.put(rec)); return rec;
}
export const listShots = () => tx('readonly', s => s.getAll()).then(a => a.sort((x, y) => y.ts - x.ts));
export const deleteShot = id => tx('readwrite', s => s.delete(id));
