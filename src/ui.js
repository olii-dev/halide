const $ = (s) => document.querySelector(s);
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
    { key: 'focal', label: 'FOCAL', min: 0, max: 1, step: 0.001, get: () => Math.log(state.focal / 18) / Math.log(400 / 18),
      set: v => setFocal(18 * Math.pow(400 / 18, v)), fmt: () => `${Math.round(state.focal)}mm` },
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
  $('#shutter').onclick = async () => {
    const s = $('#shutter'); if (s.classList.contains('busy')) return;
    s.classList.add('busy'); const f = $('#flash'); f.classList.add('go'); requestAnimationFrame(() => f.classList.remove('go'));
    await new Promise(r => setTimeout(r, 60));
    try {
      const mobile = matchMedia('(max-width: 820px)').matches;
      const { blob, w, h } = await exportPhoto(mobile ? 2560 : 3840);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      const L = LOCATIONS.find(l => l.id === state.loc);
      a.download = `halide-${L.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}.jpg`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast(`Saved ${w}×${h}`);
    } catch (e) { console.error(e); toast('Could not save the photo on this device'); }
    s.classList.remove('busy');
  };
  addEventListener('keydown', e => { if (e.key === 'h') document.body.classList.toggle('shooting'); });
  return {
    sync() { for (const { d, inp, out } of inputs) { inp.value = d.get(); out.textContent = d.fmt(); } },
    focusPing(x, y) { const r = $('#focusRing'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.add('show'); setTimeout(() => r.classList.remove('show'), 700); used(); },
  };
}
