const $ = (s) => document.querySelector(s);
import { MAX_FOCAL } from './locations.js';
import { LOOKS } from './post.js';
import { saveShot, listShots, deleteShot } from './gallery.js';
const FSTOPS = [1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const SHUTTERS = [15, 30, 60, 125, 250, 500, 1000];
const signed = (v, d = 1, u = '') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}${u}`;

// GT7 Scapes-style: every property has its own control, nothing is tied to one drag.
export function buildUI(api) {
  const { snapshotScene, restoreScene, setCarModel, MODELS, resetScene, state, rig, carS, cars, MAX_CARS, addCar, duplicateCar, removeCar, selectCar, activeIndex, setLocation, setPaint, applyPaint, applyLights, setFocal, exportPhoto, frameCar, carDistance, cropRect, markDirty, LOCATIONS, PAINTS, FINISHES } = api;
  const BASE = import.meta.env.BASE_URL, syncs = [];
  // ---------- scene menu ----------
  const grid = $('#menu .m-grid');
  for (const L of LOCATIONS) {
    const c = document.createElement('button'); c.className = 'card'; c.dataset.id = L.id;
    c.innerHTML = `<img alt="" loading="lazy" src="${BASE}assets/thumbs/${L.id}.jpg?v=place2"><span class="lbl"><b>${L.name}</b><small>${L.place}</small></span>`;
    c.onclick = async () => {
      // hide the old scene while the new one loads, so a slow phone never shows the previous place under the new name
      document.body.classList.remove('in-menu'); document.body.classList.add('scene-loading'); $('#sceneLoad').textContent = `Loading ${L.name}…`;
      const want = L.id; state.loc = want; resetScene(); showScene();
      try { await setLocation(want); } finally { if (state.loc === want) { await new Promise(r => { const t0 = performance.now(); (function w() { if (window.__hi || performance.now() - t0 > 8000 || state.loc !== want) r(); else setTimeout(w, 100); })(); }); } }
      if (state.loc === want) document.body.classList.remove('scene-loading'); showScene(); syncAll();
    };
    grid.appendChild(c);
  }
  function showScene() { const L = LOCATIONS.find(l => l.id === state.loc); $('#sceneName').innerHTML = `<b>${L.name}</b> ${L.place}`; }
  showScene();
  $('#scenesBtn').onclick = () => { for (const c of grid.children) c.classList.toggle('cur', c.dataset.id === state.loc); document.body.classList.add('in-menu'); };
  if (!new URLSearchParams(location.search).has('loc')) document.body.classList.add('in-menu');

  // ---------- control builders ----------
  const bodies = {};
  for (const b of document.querySelectorAll('#panel .body')) bodies[b.dataset.body] = b;
  let cur = null;
  function section(tab, title) { const s = document.createElement('section'); s.className = 'sec'; s.innerHTML = `<h3>${title}</h3>`; bodies[tab].appendChild(s); cur = s; return s; }
  function slider(o) {
    const w = document.createElement('div'); w.className = 'ctl';
    w.innerHTML = `<div class="top"><label>${o.label}</label><input class="val" inputmode="decimal" spellcheck="false"></div>
      <div class="line"><button class="nd" aria-label="less">−</button><input type="range" min="${o.min}" max="${o.max}" step="${o.step ?? 'any'}"><button class="nd" aria-label="more">+</button></div>`;
    const [minus, plus] = w.querySelectorAll('.nd'), r = w.querySelector('input[type=range]'), val = w.querySelector('.val');
    const toR = o.toRange ?? (v => v), fromR = o.fromRange ?? (v => v);
    const set = v => { o.set(v); changed(); };
    r.oninput = () => { let v = fromR(+r.value); if (o.snap) v = o.snap(v); set(v); };
    const nudge = d => { set(o.clamp ? o.clamp(o.get() + d) : Math.min(o.max_ ?? Infinity, Math.max(o.min_ ?? -Infinity, o.get() + d))); };
    hold(minus, () => nudge(-(o.nudge ?? o.step))); hold(plus, () => nudge(o.nudge ?? o.step));
    val.onchange = () => { const n = parseFloat(val.value.replace('−', '-')); if (isFinite(n)) set(o.parse ? o.parse(n) : n); else sync(); val.blur(); };
    val.onfocus = () => val.select();
    const sync = () => { r.value = toR(o.get()); if (document.activeElement !== val) val.value = o.fmt(o.get()); };
    syncs.push(sync); sync(); cur.appendChild(w); return w;
  }
  function hold(btn, fn) { // press = one step, hold = repeat
    let t = 0, i = 0; const stop = () => { clearTimeout(t); clearInterval(i); };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); fn(); t = setTimeout(() => { i = setInterval(fn, 60); }, 380); });
    btn.addEventListener('pointerup', stop); btn.addEventListener('pointerleave', stop); btn.addEventListener('pointercancel', stop);
  }
  function seg(o) {
    const w = document.createElement('div'); w.className = 'ctl';
    w.innerHTML = `${o.label ? `<div class="top"><label>${o.label}</label>${o.note ? `<span class="note">${o.note}</span>` : ''}</div>` : ''}<div class="seg${o.wrap ? ' wrap' : ''}"></div>`;
    const box = w.querySelector('.seg');
    for (const opt of o.options) { const b = document.createElement('button'); b.textContent = opt.name; b.dataset.id = opt.id; b.onclick = () => { o.set(opt.id); changed(); }; box.appendChild(b); }
    const sync = () => { for (const b of box.children) b.classList.toggle('on', String(o.get()) === b.dataset.id); };
    syncs.push(sync); sync(); cur.appendChild(w); return w;
  }
  function buttons(list) { const w = document.createElement('div'); w.className = 'btns';
    for (const [name, fn] of list) { const b = document.createElement('button'); b.textContent = name; b.onclick = () => { fn(); changed(); }; w.appendChild(b); }
    cur.appendChild(w); return w; }
  function toggle(o) { return seg({ ...o, options: [{ id: 'false', name: o.off ?? 'Off' }, { id: 'true', name: o.on ?? 'On' }], get: () => String(o.get()), set: v => o.set(v === 'true') }); }
  function changed() { syncAll(); markDirty(); document.body.classList.add('used'); }
  function syncAll() { for (const s of syncs) s(); layoutFrame(); }
  const wrapDeg = v => ((v % 360) + 360) % 360;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- CAR ----------
  section('car', 'Cars');
  const carsBox = document.createElement('div'); carsBox.className = 'seg cars'; cur.appendChild(carsBox);
  const carBtns = buttons([
    ['+ Add car', () => { if (!addCar()) toast(`Up to ${MAX_CARS} cars`); else frameNote(); }],
    ['Duplicate', () => { if (!duplicateCar()) toast(`Up to ${MAX_CARS} cars`); else frameNote(); }],
    ['Remove', () => { if (cars.length > 1) removeCar(); }],
  ]);
  // model picker: swap the selected car for another model, keeping its spot, paint and settings
  let loadingModel = null;
  seg({ label: 'Model', options: MODELS.map(m => ({ id: m.id, name: m.year ? `${m.name.replace(/ \(.*\)/, '')} '${String(m.year).slice(2)}` : m.name })),
    get: () => loadingModel ?? carS.model,
    set: id => { if (id === carS.model || loadingModel) return; loadingModel = id; toast('Loading car…');
      const c = cars[activeIndex()];
      setCarModel(c, id).then(() => { loadingModel = null; toast(MODELS.find(m => m.id === id).name); changed(); })
        .catch(e => { loadingModel = null; console.error(e); toast('Could not load that car'); changed(); }); } });
  const cn = document.createElement('p'); cn.className = 'note'; cn.textContent = 'Everything below edits the selected car. Tap a car in the photo to select it.'; cur.appendChild(cn);
  function frameNote() { toast(`Car ${activeIndex() + 1} added`); }
  syncs.push(() => {
    if (carsBox.children.length !== cars.length) { carsBox.innerHTML = ''; cars.forEach((c, i) => { const b = document.createElement('button'); b.onclick = () => { selectCar(i); changed(); }; carsBox.appendChild(b); }); }
    [...carsBox.children].forEach((b, i) => { b.classList.toggle('on', i === activeIndex()); b.innerHTML = `<i style="background:${cars[i].s.color || PAINTS.find(p => p.id === cars[i].s.paint).color}"></i>Car ${i + 1}`; });
    const [add, dup, rem] = carBtns.children; add.disabled = dup.disabled = cars.length >= MAX_CARS; rem.disabled = cars.length <= 1;
  });
  section('car', 'Position');
  slider({ label: 'Left / Right', min: -25, max: 25, step: 0.01, nudge: 0.05, get: () => carS.lat, set: v => { carS.lat = clamp(v, -25, 25); }, fmt: v => `${Math.abs(v) < 0.005 ? 'centre' : `${Math.abs(v).toFixed(2)} m ${v < 0 ? 'L' : 'R'}`}`, clamp: v => clamp(v, -25, 25) });
  slider({ label: 'Near / Far', min: 3, max: 80, step: 0.01, nudge: 0.1, get: () => carS.near, set: v => { carS.near = clamp(v, 3, 80); }, fmt: v => `${v.toFixed(2)} m`, clamp: v => clamp(v, 3, 80),
    toRange: v => v, fromRange: v => v });
  buttons([['Centre', () => { carS.lat = 0; }], ['Aim camera at car', () => frameCar()]]);
  section('car', 'Rotation');
  let snap = true;
  slider({ label: 'Heading', min: 0, max: 360, step: 1, nudge: 1, get: () => carS.rot, set: v => { carS.rot = wrapDeg(Math.round(v * 10) / 10); }, fmt: v => `${v.toFixed(v % 1 ? 1 : 0)}°`,
    snap: v => (snap && !(window.event?.shiftKey || window.event?.altKey)) ? Math.round(v / 15) * 15 : v, clamp: wrapDeg });
  seg({ label: 'Slider snaps', note: 'hold ⇧ for free', options: [{ id: 'true', name: 'Every 15°' }, { id: 'false', name: 'Free' }], get: () => String(snap), set: v => { snap = v === 'true'; } });
  buttons([['Face camera', () => { carS.rot = 0; }], ['Front ¾', () => { carS.rot = 30; }], ['Side', () => { carS.rot = 90; }], ['Rear ¾', () => { carS.rot = 150; }], ['Rear', () => { carS.rot = 180; }]]);
  section('car', 'Wheels');
  slider({ label: 'Steering', min: -35, max: 35, step: 0.5, nudge: 1, get: () => carS.steer, set: v => { carS.steer = clamp(v, -35, 35); }, fmt: v => v === 0 ? 'straight' : `${Math.abs(v).toFixed(v % 1 ? 1 : 0)}° ${v > 0 ? 'left' : 'right'}`, clamp: v => clamp(v, -35, 35) });
  slider({ label: 'Wheel spin', min: 0, max: 300, step: 5, nudge: 5, get: () => state.speed, set: v => { state.speed = clamp(v, 0, 300); }, fmt: v => v ? `${v} km/h` : 'parked', clamp: v => clamp(v, 0, 300) });
  section('car', 'Lights');
  seg({ label: 'Headlights', options: [{ id: 'off', name: 'Off' }, { id: 'on', name: 'On' }, { id: 'high', name: 'High beam' }], get: () => carS.lights, set: v => { carS.lights = v; applyLights(); } });
  toggle({ label: 'Brake lights', get: () => carS.brake, set: v => { carS.brake = v; applyLights(); } });
  section('car', 'Paint');
  const sw = document.createElement('div'); sw.className = 'swatches'; cur.appendChild(sw);
  for (const P of PAINTS) { const b = document.createElement('button'); b.className = 'swatch'; b.style.background = P.color; b.title = P.name; b.dataset.id = P.id;
    b.onclick = () => { carS.color = null; setPaint(P.id); changed(); }; sw.appendChild(b); }
  const pick = document.createElement('label'); pick.className = 'swatch custom'; pick.title = 'Custom colour'; pick.innerHTML = '<input type="color">'; sw.appendChild(pick);
  const cin = pick.querySelector('input'); cin.oninput = () => { carS.color = cin.value; applyPaint(); changed(); };
  const pname = document.createElement('div'); pname.className = 'pname'; cur.appendChild(pname);
  syncs.push(() => { for (const b of sw.querySelectorAll('button')) b.classList.toggle('on', !carS.color && b.dataset.id === carS.paint); pick.classList.toggle('on', !!carS.color);
    if (carS.color) pick.style.background = carS.color; pname.textContent = carS.color ? `Custom ${carS.color.toUpperCase()}` : PAINTS.find(p => p.id === carS.paint).name; });
  seg({ label: 'Finish', wrap: true, options: FINISHES, get: () => carS.finish, set: v => { carS.finish = v; applyPaint(); } });
  section('car', 'Drag on the photo');
  seg({ note: 'off = dragging never moves anything', options: [{ id: 'off', name: 'Off' }, { id: 'rotate', name: 'Rotates car' }, { id: 'move', name: 'Moves car' }], get: () => state.dragMode, set: v => { state.dragMode = v; } , label: 'Drag' });

  // ---------- CAMERA ----------
  const lg = Math.log(MAX_FOCAL / 18);
  section('camera', 'Lens');
  slider({ label: 'Focal length', min: 0, max: 1, step: 0.001, nudge: 1, get: () => state.focal, set: v => setFocal(clamp(v, 18, MAX_FOCAL)),
    toRange: v => Math.log(v / 18) / lg, fromRange: v => 18 * Math.exp(v * lg), fmt: v => `${Math.round(v)} mm`, clamp: v => clamp(Math.round(v), 18, MAX_FOCAL) });
  buttons([[ '24', () => setFocal(24)], ['35', () => setFocal(35)], ['50', () => setFocal(50)], ['85', () => setFocal(85)], ['135', () => setFocal(135)]]).classList.add('mini');
  toggle({ label: 'Zoom keeps car size', off: 'No', on: 'Dolly zoom', get: () => state.dollyZoom, set: v => { state.dollyZoom = v; } });
  slider({ label: 'Aperture', min: 0, max: FSTOPS.length - 1, step: 1, nudge: 1, get: () => FSTOPS.indexOf(nearest(state.fstop)), set: v => { state.fstop = FSTOPS[clamp(Math.round(v), 0, FSTOPS.length - 1)]; },
    fmt: i => `f/${FSTOPS[i]}`, parse: n => FSTOPS.indexOf(nearest(n)), clamp: v => clamp(v, 0, FSTOPS.length - 1) });
  section('camera', 'Focus');
  seg({ label: 'Focus on', note: 'or tap the photo', options: [{ id: 'car', name: 'The car' }, { id: 'manual', name: 'Manual' }], get: () => state.focusMode, set: v => { state.focusMode = v; if (v === 'car') state.focus = carDistance(); } });
  const lf = Math.log(400);
  slider({ label: 'Focus distance', min: 0, max: 1, step: 0.001, nudge: 0.1, get: () => state.focus, set: v => { state.focusMode = 'manual'; state.focus = clamp(v, 0.5, 200); },
    toRange: v => Math.log(v / 0.5) / lf, fromRange: v => 0.5 * Math.exp(v * lf), fmt: v => `${v.toFixed(v < 10 ? 2 : 1)} m`, clamp: v => clamp(v, 0.5, 200) });
  toggle({ label: 'Depth of field', get: () => state.dof, set: v => { state.dof = v; } });
  section('camera', 'Exposure');
  slider({ label: 'Exposure', min: -3, max: 3, step: 0.1, nudge: 0.1, get: () => state.ev, set: v => { state.ev = Math.round(clamp(v, -3, 3) * 10) / 10; }, fmt: v => signed(v, 1, ' EV') });
  toggle({ label: 'Panning shot', note: 'background streaks along the car’s path', off: 'Off', on: 'Pan with car', get: () => state.panBlur, set: v => { state.panBlur = v; if (v && !state.speed) { state.speed = 80; toast('Wheel spin set to 80 km/h'); } } });
  seg({ label: 'Shutter speed', note: 'slower = more blur', wrap: true, options: SHUTTERS.map(s => ({ id: String(s), name: `1/${s}` })), get: () => String(state.shutter), set: v => { state.shutter = +v; } });
  section('camera', 'Camera position');
  const Lh = () => LOCATIONS.find(l => l.id === state.loc).height;
  slider({ label: 'Height', min: 0.25, max: 1.7, step: 0.01, nudge: 0.02, get: () => rig.camH, set: v => { rig.camH = clamp(v, 0.25, Lh()); }, fmt: v => `${v.toFixed(2)} m`, clamp: v => clamp(v, 0.25, Lh()) });
  slider({ label: 'Tilt', min: -25, max: 25, step: 0.1, nudge: 0.5, get: () => rig.tilt, set: v => { rig.tilt = clamp(v, -25, 25); }, fmt: v => signed(v, 1, '°'), clamp: v => clamp(v, -25, 25) });
  slider({ label: 'Pan', min: -90, max: 90, step: 0.1, nudge: 0.5, get: () => rig.pan, set: v => { rig.pan = clamp(v, -90, 90); }, fmt: v => signed(v, 1, '°'), clamp: v => clamp(v, -90, 90) });
  slider({ label: 'Roll (dutch angle)', min: -30, max: 30, step: 0.1, nudge: 0.5, get: () => rig.roll, set: v => { rig.roll = clamp(v, -30, 30); }, fmt: v => signed(v, 1, '°'), clamp: v => clamp(v, -30, 30) });
  buttons([['Aim at car', () => frameCar()], ['Level', () => { rig.roll = 0; rig.tilt = 0; }]]);
  section('camera', 'Scene');
  slider({ label: 'Scene angle', min: -180, max: 180, step: 0.5, nudge: 1, get: () => rig.sceneAngle, set: v => { rig.sceneAngle = ((v + 540) % 360) - 180; }, fmt: v => signed(v, 1, '°') });
  const sn = document.createElement('p'); sn.className = 'note'; sn.textContent = 'Turns the whole place around you and the car: picks which part of the location is behind the shot.'; cur.appendChild(sn);

  // ---------- EFFECTS ----------
  section('effects', 'Frame');
  seg({ label: 'Aspect', wrap: true, options: ['free', '3:2', '16:9', '21:9', '1:1', '4:5', '2:3', '9:16'].map(a => ({ id: a, name: a === 'free' ? 'Screen' : a })), get: () => state.aspect, set: v => { state.aspect = v; } });
  seg({ label: 'Grid', options: [{ id: 'off', name: 'Off' }, { id: 'thirds', name: 'Thirds' }, { id: 'centre', name: 'Centre' }], get: () => state.grid, set: v => { state.grid = v; } });
  section('effects', 'Look');
  seg({ wrap: true, options: Object.entries(LOOKS).map(([id, l]) => ({ id, name: l.name })), get: () => state.look, set: v => { state.look = v; } });
  section('effects', 'Colour');
  slider({ label: 'White balance', min: -1, max: 1, step: 0.01, nudge: 0.05, get: () => state.temp, set: v => { state.temp = clamp(v, -1, 1); }, fmt: v => Math.abs(v) < 0.005 ? 'as shot' : `${signed(v * 100, 0)} ${v > 0 ? 'warm' : 'cool'}`, parse: n => n / 100 });
  slider({ label: 'Tint', min: -1, max: 1, step: 0.01, nudge: 0.05, get: () => state.tint, set: v => { state.tint = clamp(v, -1, 1); }, fmt: v => Math.abs(v) < 0.005 ? '0' : `${signed(v * 100, 0)} ${v > 0 ? 'magenta' : 'green'}`, parse: n => n / 100 });
  slider({ label: 'Contrast', min: 0.6, max: 1.5, step: 0.01, nudge: 0.05, get: () => state.contrast, set: v => { state.contrast = clamp(v, 0.6, 1.5); }, fmt: v => signed((v - 1) * 100, 0), parse: n => 1 + n / 100 });
  slider({ label: 'Saturation', min: 0, max: 2, step: 0.01, nudge: 0.05, get: () => state.saturation, set: v => { state.saturation = clamp(v, 0, 2); }, fmt: v => signed((v - 1) * 100, 0), parse: n => 1 + n / 100 });
  section('effects', 'Lens effects');
  slider({ label: 'Vignette', min: 0, max: 1, step: 0.01, nudge: 0.05, get: () => state.vignette, set: v => { state.vignette = clamp(v, 0, 1); }, fmt: v => `${Math.round(v * 100)}`, parse: n => n / 100 });
  slider({ label: 'Chromatic aberration', min: 0, max: 1, step: 0.01, nudge: 0.05, get: () => state.ca, set: v => { state.ca = clamp(v, 0, 1); }, fmt: v => `${Math.round(v * 100)}`, parse: n => n / 100 });
  slider({ label: 'Film grain', min: 0, max: 1, step: 0.01, nudge: 0.05, get: () => state.grain, set: v => { state.grain = clamp(v, 0, 1); }, fmt: v => `${Math.round(v * 100)}`, parse: n => n / 100 });
  slider({ label: 'Glow (bloom)', min: 0, max: 3, step: 0.05, nudge: 0.1, get: () => state.bloom, set: v => { state.bloom = clamp(v, 0, 3); }, fmt: v => `${Math.round(v * 100)}%`, parse: n => n / 100 });
  buttons([['Reset effects', () => Object.assign(state, { look: 'none', temp: 0, tint: 0, contrast: 1, saturation: 1, vignette: 0.3, ca: 0.2, grain: 0.3, bloom: 1 })]]);

  // ---------- tabs, panel, frame overlay ----------
  const tabs = document.querySelectorAll('#panel .tabs [data-tab]');
  function showTab(id) { for (const t of tabs) t.classList.toggle('on', t.dataset.tab === id); for (const [k, b] of Object.entries(bodies)) b.hidden = k !== id; }
  for (const t of tabs) t.onclick = () => showTab(t.dataset.tab);
  showTab('car');
  const setPanel = open => { document.body.classList.toggle('panel-closed', !open); };
  $('#hidePanel').onclick = () => setPanel(false); $('#panelBtn').onclick = () => setPanel(true);
  addEventListener('keydown', e => { if (e.target.closest?.('input, textarea, select')) return; if (e.key === 'h') setPanel(document.body.classList.contains('panel-closed')); });
  function layoutFrame() {
    const fb = $('#frameBox'), r = cropRect();
    Object.assign(fb.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    fb.classList.toggle('masked', state.aspect !== 'free'); fb.dataset.grid = state.grid;
  }
  addEventListener('resize', layoutFrame);
  function nearest(v) { return FSTOPS.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a); }
  let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 1600); }
  $('#aboutBtn').onclick = () => $('#about').showModal();
  syncAll(); document.body.classList.remove('used');
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
  function saveBlobAs(url, name, w, h) {
    if (matchMedia('(max-width: 820px)').matches && navigator.canShare) {
      fetch(url).then(r => r.blob()).then(b => { const f = new File([b], name, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [f] })) return navigator.share({ files: [f] }); throw 0; }).catch(e => { if (e?.name !== 'AbortError') dlUrl(url, name, w, h); });
      return;
    }
    dlUrl(url, name, w, h);
  }
  function dlUrl(url, name, w, h) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); toast(`Saved ${w}×${h}`); }
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
      const setup = snapshotScene();
      const { blob, w, h } = await exportPhoto(edge);
      const L = LOCATIONS.find(l => l.id === state.loc);
      shot = { url: URL.createObjectURL(blob), w, h, name: fileName() };
      img.src = shot.url; await img.decode().catch(() => {});
      reveal.querySelector('.where').innerHTML = `<b>HALIDE</b>${L.name} · ${L.place}`;
      const bits = [`${Math.round(state.focal)}mm`, `f/${state.fstop}`, `${state.ev >= 0 ? '+' : ''}${state.ev.toFixed(1)} EV`];
      bits.push(`1/${state.shutter}s`); if (state.speed > 0) bits.push(`${state.speed} km/h`); if (state.look !== 'none') bits.push(LOOKS[state.look].name);
      bits.push(`${w}×${h}`);
      reveal.querySelector('.exif').textContent = bits.join('  ·  ');
      saveShot({ blob, w, h, scene: setup, name: shot.name, where: `${L.name} · ${L.place}`, exif: bits.join('  ·  ') }).then(() => { toast('Kept in your gallery'); refreshCount(); }).catch(e => console.warn('gallery', e));
      document.body.classList.remove('developing');
      reveal.setAttribute('aria-hidden', 'false'); void reveal.offsetWidth; reveal.classList.add('show');
    } catch (e) { console.error(e); document.body.classList.remove('developing'); toast('Could not develop the photo on this device'); }
    s.classList.remove('busy');
  };
  // ---------- gallery ----------
  const gal = $('#gallery'), ggrid = gal.querySelector('.g-grid'), viewer = $('#viewer'), vimg = viewer.querySelector('img');
  let urls = [], viewing = null;
  async function refreshCount() { try { const n = (await listShots()).length; for (const el of document.querySelectorAll('.g-n')) el.textContent = n ? ` ${n}` : ''; } catch {} }
  async function openGallery() {
    document.body.classList.add('in-gallery'); urls.forEach(u => URL.revokeObjectURL(u)); urls = []; ggrid.innerHTML = '';
    const shots = await listShots().catch(() => []);
    gal.querySelector('.g-count').textContent = shots.length ? `${shots.length} photo${shots.length > 1 ? 's' : ''} · kept on this device` : '';
    gal.classList.toggle('empty', !shots.length);
    for (const sh of shots) {
      const u = URL.createObjectURL(sh.thumb); urls.push(u);
      const b = document.createElement('button'); b.className = 'g-item';
      b.innerHTML = `<img alt="" src="${u}"><span>${sh.where.split(' · ')[0]}<small>${new Date(sh.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span>`;
      b.onclick = () => openShot(sh); ggrid.appendChild(b);
    }
  }
  function closeGallery() { document.body.classList.remove('in-gallery'); }
  function openShot(sh) {
    viewing = { ...sh, url: URL.createObjectURL(sh.blob) }; vimg.src = viewing.url;
    viewer.querySelector('.where').innerHTML = `<b>HALIDE</b>${sh.where}`; viewer.querySelector('.exif').textContent = sh.exif || `${sh.w}×${sh.h}`;
    viewer.querySelector('.v-edit').hidden = !sh.scene; viewer.classList.add('show');
  }
  function closeShot() { viewer.classList.remove('show'); const v = viewing; viewing = null; if (v) setTimeout(() => URL.revokeObjectURL(v.url), 500); }
  viewer.querySelector('.v-back').onclick = closeShot;
  // reopen the photo's exact setup (place, cars, paint, camera, effects). Shooting again keeps the original and adds a new photo.
  viewer.querySelector('.v-edit').onclick = async () => {
    if (!viewing?.scene) return; const snap = viewing.scene, L = LOCATIONS.find(l => l.id === snap.state.loc);
    closeShot(); closeGallery(); document.body.classList.remove('in-menu'); document.body.classList.add('scene-loading'); $('#sceneLoad').textContent = `Loading ${L?.name ?? 'setup'}…`;
    try { await restoreScene(snap); toast('Setup reopened. Shoot again to add a new photo'); }
    catch (e) { console.error(e); toast('Could not reopen that setup'); }
    document.body.classList.remove('scene-loading'); showScene(); syncAll();
  };
  // duplicate: an independent copy of the photo and its saved setup, shown straight away
  viewer.querySelector('.v-dup').onclick = async () => {
    if (!viewing) return; const { id, ts, url, thumb, ...rest } = viewing;
    try { const rec = await saveShot({ ...rest, name: rest.name?.replace(/(\.\w+)$/, '-copy$1') }); closeShot(); await openGallery(); refreshCount(); openShot(rec); toast('Duplicated'); }
    catch (e) { console.error(e); toast('Could not duplicate that photo'); }
  };
  viewer.querySelector('.v-save').onclick = () => viewing && saveBlobAs(viewing.url, viewing.name, viewing.w, viewing.h);
  viewer.querySelector('.v-del').onclick = async () => { if (!viewing || !confirm('Delete this photo from the gallery?')) return; await deleteShot(viewing.id); closeShot(); openGallery(); refreshCount(); };
  for (const b of document.querySelectorAll('.galleryBtn')) b.onclick = openGallery;
  gal.querySelector('.g-close').onclick = closeGallery;
  reveal.querySelector('.gal').onclick = () => { closeReveal(); openGallery(); };
  addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (viewer.classList.contains('show')) closeShot(); else if (document.body.classList.contains('in-gallery')) closeGallery(); });
  refreshCount();

  return {
    sync: syncAll, toast,
    focusPing(x, y) { const r = $('#focusRing'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.add('show'); setTimeout(() => r.classList.remove('show'), 700); },
  };
}
