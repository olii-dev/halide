const $ = (s) => document.querySelector(s);
import { MAX_FOCAL } from './locations.js';
const FSTOPS = [1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

export function buildUI({ state, rig, setLocation, setPaint, setFocal, exportPhoto, LOCATIONS, PAINTS }) {
  const locs = $('#locs'), paints = $('#paints'), dials = $('#dials');
  for (const L of LOCATIONS) {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = L.name; b.title = L.place; b.dataset.id = L.id;
    b.onclick = async () => { mark(locs, L.id); toast(L.place); await setLocation(L.id); };
    locs.appendChild(b);
  }
  for (const P of PAINTS) {
    const b = document.createElement('button'); b.className = 'swatch'; b.style.background = P.color; b.title = P.name; b.dataset.id = P.id;
    b.onclick = () => { mark(paints, P.id); setPaint(P.id); toast(P.name); };
    paints.appendChild(b);
  }
  const dialDefs = [
    { key: 'focal', label: 'FOCAL', min: 0, max: 1, step: 0.001, get: () => Math.log(state.focal / 18) / Math.log(MAX_FOCAL / 18),
      set: v => setFocal(18 * Math.pow(MAX_FOCAL / 18, v)), fmt: () => `${Math.round(state.focal)}mm` },
    { key: 'fstop', label: 'APERTURE', min: 0, max: FSTOPS.length - 1, step: 1, get: () => FSTOPS.indexOf(nearest(state.fstop)),
      set: v => { state.fstop = FSTOPS[v]; }, fmt: () => `f/${state.fstop}` },
    { key: 'ev', label: 'EXPOSURE', min: -3, max: 3, step: 0.1, get: () => state.ev, set: v => { state.ev = v; }, fmt: () => `${state.ev >= 0 ? '+' : ''}${state.ev.toFixed(1)}` },
    { key: 'h', label: 'HEIGHT', min: 0.25, max: 1.7, step: 0.01, get: () => rig.camH, set: v => { rig.camH = v; }, fmt: () => `${rig.camH.toFixed(2)}m` },
    { key: 'speed', label: 'WHEELS', min: 0, max: 200, step: 5, get: () => state.speed, set: v => { state.speed = v; }, fmt: () => state.speed ? `${state.speed} km/h` : 'still' },
    { key: 'grain', label: 'GRAIN', min: 0, max: 1, step: 0.01, get: () => state.grain, set: v => { state.grain = v; }, fmt: () => `${Math.round(state.grain * 100)}` },
  ];
  const inputs = [];
  for (const d of dialDefs) {
    const w = document.createElement('div'); w.className = 'dial';
    w.innerHTML = `<label>${d.label}</label><output></output><input type="range" min="${d.min}" max="${d.max}" step="${d.step}">`;
    const inp = w.querySelector('input'), out = w.querySelector('output');
    inp.value = d.get(); out.textContent = d.fmt();
    inp.oninput = () => { d.set(+inp.value); out.textContent = d.fmt(); used(); };
    inputs.push({ d, inp, out }); dials.appendChild(w);
  }
  function nearest(v) { return FSTOPS.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a); }
  function mark(parent, id) { for (const c of parent.children) c.classList.toggle('on', c.dataset.id === id); used(); }
  mark(locs, state.loc); mark(paints, state.paint); document.body.classList.remove('used');
  function used() { document.body.classList.add('used'); }
  let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 1600); }
  $('#aboutBtn').onclick = () => $('#about').showModal();
  document.getElementById('stage').addEventListener('pointerdown', used, { once: true });
  // capture: shutter sound + curtain, "developing" while the full-res render runs, then the print reveal
  let actx = null;
  function click() {
    try {
      actx ??= new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, len = Math.floor(actx.sampleRate * 0.09), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const k = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 6) * (k < 0.45 ? 1 : 0.55); }
      const n = actx.createBufferSource(); n.buffer = buf; const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.8;
      const g = actx.createGain(); g.gain.value = 0.35; n.connect(f).connect(g).connect(actx.destination); n.start(t);
      const n2 = actx.createBufferSource(); n2.buffer = buf; const g2 = actx.createGain(); g2.gain.value = 0.22; n2.connect(f); n2.start(t + 0.1);
    } catch {}
  }
  const reveal = $('#reveal'), img = reveal.querySelector('img');
  let shot = null;
  function fileName() { const L = LOCATIONS.find(l => l.id === state.loc); return `halide-${L.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}.jpg`; }
  function save() {
    if (!shot) return;
    // phones: the share sheet offers "Save Image" straight to Photos
    if (matchMedia('(max-width: 820px)').matches && navigator.canShare) {
      fetch(shot.url).then(r => r.blob()).then(b => { const f = new File([b], shot.name, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [f] })) return navigator.share({ files: [f] }); throw 0; }).catch(e => { if (e?.name !== 'AbortError') dl(); });
      return;
    }
    dl();
  }
  function dl() {
    const a = document.createElement('a'); a.href = shot.url; a.download = shot.name; a.click(); toast(`Saved ${shot.w}×${shot.h}`);
  }
  function closeReveal() {
    reveal.classList.remove('show'); reveal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('developing');
    const s = shot; shot = null; if (s) setTimeout(() => { URL.revokeObjectURL(s.url); if (!shot) img.removeAttribute('src'); }, 600);
  }
  reveal.querySelector('.save').onclick = save;
  reveal.querySelector('.back').onclick = closeReveal;
  addEventListener('keydown', e => { if (!reveal.classList.contains('show')) return; if (e.key === 'Escape') closeReveal(); if (e.key === 's' || e.key === 'Enter') save(); });
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  $('#shutter').onclick = async () => {
    const s = $('#shutter'); if (s.classList.contains('busy') || shot) return;
    s.classList.add('busy'); click();
    const c = $('#curtain'); c.classList.remove('snap'); void c.offsetWidth; c.classList.add('snap');
    await new Promise(r => setTimeout(r, 120));
    document.body.classList.add('developing');
    await frame();
    try {
      const mobile = matchMedia('(max-width: 820px)').matches;
      const edge = +new URLSearchParams(location.search).get('ex') || (mobile ? 2560 : 3840); // ex= only for testing
      const { blob, w, h } = await exportPhoto(edge);
      const L = LOCATIONS.find(l => l.id === state.loc);
      shot = { url: URL.createObjectURL(blob), w, h, name: fileName() };
      img.src = shot.url; await img.decode().catch(() => {});
      reveal.querySelector('.where').innerHTML = `<b>HALIDE</b>${L.name} · ${L.place}`;
      const bits = [`${Math.round(state.focal)}mm`, `f/${state.fstop}`, `${state.ev >= 0 ? '+' : ''}${state.ev.toFixed(1)} EV`];
      if (state.speed > 0) bits.push(`1/60s · ${state.speed} km/h`);
      bits.push(`${w}×${h}`);
      reveal.querySelector('.exif').textContent = bits.join('  ·  ');
      document.body.classList.remove('developing');
      reveal.setAttribute('aria-hidden', 'false'); void reveal.offsetWidth; reveal.classList.add('show');
    } catch (e) { console.error(e); document.body.classList.remove('developing'); toast('Could not develop the photo on this device'); }
    s.classList.remove('busy');
  };
  addEventListener('keydown', e => { if (e.key === 'h') document.body.classList.toggle('shooting'); });
  return {
    sync() { for (const { d, inp, out } of inputs) { inp.value = d.get(); out.textContent = d.fmt(); } },
    focusPing(x, y) { const r = $('#focusRing'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.add('show'); setTimeout(() => r.classList.remove('show'), 700); used(); },
  };
}
