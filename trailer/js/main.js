// WILVO Engineering trailer · "Van order tot levering" · 45 s · timeline, cameras, overlays, sound.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, mix, seg, hold, ease, hash } from './util.js';
import { Aerial } from './aerial.js';
import { Product, Tools, PRODUCT, BL, BW, FH, T as PT } from './product.js';
import { Overlay, h, counter, stagger } from './overlay.js';
import { Score } from './audio.js';
import { sfxCues, DURATION } from './cues.js';

export { DURATION };
const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
const pmrem = new THREE.PMREMGenerator(renderer); const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 20000);
const composer = new EffectComposer(renderer); composer.setSize(1920, 1080);
const renderPass = new RenderPass(new THREE.Scene(), camera); composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.3, 0.5, 1.0); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- studio (the product)
const studio = new THREE.Scene(); studio.background = new THREE.Color('#e6e4df'); studio.environment = env;
const hemi = new THREE.HemisphereLight('#ffffff', '#b9b4aa', 0.45); studio.add(hemi);
const key = new THREE.DirectionalLight('#fff4e6', 1.5); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.1; key.shadow.camera.far = 40; key.shadow.bias = -0.00004; key.shadow.normalBias = 0.004; key.shadow.camera.left = key.shadow.camera.bottom = -0.6; key.shadow.camera.right = key.shadow.camera.top = 0.6; studio.add(key); studio.add(key.target);
const rim = new THREE.DirectionalLight('#dde9ff', 0.6); rim.position.set(-4, 3, -5); studio.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#e3e1dc', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001; floor.receiveShadow = true; studio.add(floor);
const product = new Product(env); const rig = new THREE.Group(); rig.add(product.group); studio.add(rig);
const tools = new Tools(env); studio.add(tools.group);
function orbit(az, el, dist, target, fov = 32) { const a = az * Math.PI / 180, e = el * Math.PI / 180; return { pos: [target[0] + dist * Math.cos(e) * Math.sin(a), target[1] + dist * Math.sin(e), target[2] + dist * Math.cos(e) * Math.cos(a)], target, fov }; }
const orbitT = (t, A, B, e = ease.io) => { const k = e(t); return orbit(lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k), mix(A[3], B[3], k), lerp(A[4] ?? 32, B[4] ?? 32, k)); };

// ---------------------------------------------------------------- the location
const site = await (await fetch('./site.json')).json();
const aerial = new Aerial(renderer, site);
const ST = site.stations;
const BLD = [105, 72]; // centre of the building

// ---------------------------------------------------------------- overlay
const ui = document.getElementById('ui'); const ov = new Overlay(ui);
const flash = document.getElementById('flash'), black = document.getElementById('black'), paper = document.getElementById('paperbg'), lbox = document.getElementById('letterbox');
let flashK = 0, blackK = 0, paperK = 0, lboxK = 0;
const pinLabels = {}; // DOM chips that follow the aerial pins

function buildOverlay() {
  const A = (el, t0, t1, o) => ov.add(el, t0, t1, o);
  const place = (el, x, y, w) => { el.style.left = x + 'px'; el.style.top = y + 'px'; if (w) el.style.width = w + 'px'; return el; };
  // ---- act 1: hook (dark studio cuts)
  const words = ['EEN ORDER.', 'ÉÉN PRODUCT.', 'ÉÉN ROUTE.', 'ÉÉN HUB.'];
  words.forEach((w, i) => { const t0 = 0.6 + i * 0.95; const el = place(h('div', 'big white', w), 110, 740); el.style.textShadow = '0 10px 50px rgba(0,0,0,0.5)'; A(el, t0, t0 + 0.95, { in: 'slam', inD: 0.16, inE: ease.outExpo, out: 'none', outD: 0.01 }); });
  { const el = place(h('div', 'k', 'WILVO · MELKWEG 1 · BERGEIJK'), 110, 690); el.style.color = '#fff'; A(el, 0.6, 4.4, { in: 'fade', inD: 0.3 }); }
  { const el = place(h('div', '', `<img class="logo" src="wilvo-logo.svg" alt="WILVO"><div class="k" style="margin-top:34px">Engineering</div><div class="title" style="margin-top:12px">Van order tot levering</div>`), 110, 300, 1200); A(el, 4.4, 6.5, { in: 'slam', inD: 0.35, inE: ease.outExpo, out: 'none', outD: 0.01 }); }
  // ---- act 2: order on the aerial
  { const el = place(h('div', 'chip', '<i></i>Melkweg 1 · Bergeijk'), 110, 920); A(el, 7.0, 11.0, { in: 'left', inD: 0.5 }); }
  { const el = place(h('div', 'card', `<div class="k">Nieuwe order</div><h2>Behuizing A · 250 stuks</h2><p>De klant stuurt het TPD: STEP-model en tekening.</p><div class="files"><div class="file step"><b>STEP</b>behuizing-A.step</div><div class="file"><b>PDF</b>tekening-A-rev-B.pdf</div></div><div class="row"><div><small>Materiaal</small>S235 · 3,0 mm</div><div><small>Levertijd</small>3 weken</div><div><small>Order</small>SO-26-04812</div></div>`), 1120, 560, 690); A(el, 7.6, 10.8, { in: 'left', inD: 0.5, inE: ease.outBack, out: 'right', outD: 0.3, dist: 90 }); }
  // pin labels (positions updated per frame)
  const pin = (k, text, t0, t1, cls = '') => { const el = h('div', 'pinwrap'); const chip = h('div', 'label3d ' + cls, text); chip.style.transform = 'translate(-50%, -150%)'; el.appendChild(chip); pinLabels[k] = pinLabels[k] || []; pinLabels[k].push(el); A(el, t0, t1, { in: 'pop', inD: 0.3, inE: ease.outBack, out: 'fade', outD: 0.15 }); };
  pin('kantoor', 'Werkvoorbereiding', 9.3, 11.0, 'red');
  // ---- act 3: engineering montage over the product
  const mont = (t0, t1, k, title, sub) => { const el = place(h('div', 'mont', `<div class="k">${k}</div><div class="mt">${title}</div>${sub ? `<div class="ms">${sub}</div>` : ''}`), 110, 150, 900); A(el, t0, t1, { in: 'slam', inD: 0.22, inE: ease.outExpo, out: 'fade', outD: 0.12 }); return el; };
  mont(11.0, 12.4, 'AI-skill · 1', 'Maakbaarheid<br>gecheckt', 'R<sub>in</sub> = T · flens ≥ 4T · gat–zetlijn ≥ 3T · <span class="bad">1 bevinding: hoekontlasting</span>');
  mont(12.4, 13.8, 'AI-skill · 2', '3D-model<br>gerepareerd', 'ontlastingssneden 4× · radius consistent · STEP rev-C');
  mont(13.8, 15.4, 'AI-skill · 3', 'Route<br>voorspeld', '');
  { const r = place(h('div', 'route', ['Laser', 'Zetten', 'Lassen', 'Montage', 'Expeditie'].map((s, i) => `<span><b>${i + 1}</b>&nbsp;${s}</span>`).join('')), 110, 560); A(r, 14.0, 15.4, { in: 'fade', inD: 0.1, update: stagger(r, 0.1, 0, 24) }); }
  mont(15.4, 16.6, 'AI-skill · 3', 'Werkinstructies<br>gegenereerd', 'HTML · 6 stappen · uit STEP en tekening');
  mont(16.6, 17.5, 'Engineering Hub', 'Wat wil je<br>maken?', 'Inspection Plan · Tekening uitlezen · Instructiemaker · Montage · 3D-viewer · Epicor issues · Digital twin');
  { const el = place(h('div', 'big', 'Klaar voor productie'), 110, 430); el.style.fontSize = '160px'; A(el, 17.5, 18.0, { in: 'slam', inD: 0.2, inE: ease.outExpo, out: 'none', outD: 0.01 }); }
  // ---- act 4: production HUD
  const depts = [['Lasersnijden', 'Bystronic BySpeed 3015 · CO₂-laser', '#9dbb61', 18.0, 22.0, 'laser'], ['Zetten', 'Bystronic Xpert · 200 ton', '#f0954a', 22.0, 26.0, 'zett'], ['Lassen', 'OTC DR4200L · lasrobot', '#d0675d', 26.0, 30.0, 'lasse'], ['Montage', 'Montagehal · werkgebied D', '#ffc93c', 30.0, 34.0, 'monta'], ['Expeditie', 'Verzendmagazijn · dock 2', '#8b9298', 34.0, 38.0, 'verze']];
  depts.forEach(([n, m, c, t0, t1, k], i) => { const el = place(h('div', 'hud', `<div class="zone" style="background:${c}"></div><div class="step">${i + 1}<small>/5</small></div><div class="dept"><div class="name">${n}</div><div class="mach">${m}</div></div>`), 110, 0); el.style.top = ''; el.style.bottom = '110px'; A(el, t0, t1, { in: 'up', inD: 0.3, inE: ease.outExpo, out: 'fade', outD: 0.15, dist: 60 }); pin(k, n, t0 + 0.15, t0 + 0.85); });
  { const el = place(h('div', 'progress', '<i></i>'), 110, 0); el.style.top = ''; const bar = el.firstChild; A(el, 18, 38, { in: 'fade', inD: 0.3, update: t => { bar.style.width = (100 * seg(t, 18, 38)) + '%'; } }); }
  const corner = (t0, t1, k, v) => { const el = place(h('div', 'corner', `<div class="k">${k}</div><div class="v">${v}</div>`), 0, 110); el.style.left = ''; el.style.right = '110px'; A(el, t0, t1, { in: 'down', inD: 0.3, out: 'fade', outD: 0.15 }); };
  corner(18.8, 22.0, 'Snijden', 'S235 · 3,0 mm · O₂<br>5,2 m/min · uitslag ' + PRODUCT.uitslag);
  corner(22.8, 26.0, 'Zetten', 'V = 24 mm · R<sub>in</sub> = 3,0 mm<br>2 zettingen · 1 gereedschapset');
  corner(26.8, 30.0, 'Lassen', 'MAG · hoeklas a3<br>2 × 230 mm');
  corner(30.8, 34.0, 'Montage', '2 beugels · grondplaat · 4 bouten<br>instructie · 6 stappen');
  corner(34.8, 38.0, 'Expeditie', 'SO-26-04812 · 250 stuks');
  // ---- act 5: finale
  pin('dock', 'Geleverd', 36.9, 41.4, 'red');
  { const bd = place(h('div', '', ''), 0, 640); bd.style.width = '1920px'; bd.style.height = '440px'; bd.style.background = 'linear-gradient(180deg, rgba(10,13,16,0) 0%, rgba(10,13,16,0.75) 50%, rgba(10,13,16,0.9) 100%)'; A(bd, 38.2, 41.5, { in: 'fade', inD: 0.6, out: 'fade', outD: 0.2 }); }
  { const stats = [[5, 'bewerkingen'], [3, 'AI-skills'], [8, 'generatoren'], [1, 'Engineering Hub']]; const el = place(h('div', 'stats light', stats.map(([n, l]) => `<div class="stat"><div class="v">0</div><div class="l">${l}</div></div>`).join('')), 110, 800); const vs = [...el.querySelectorAll('.v')]; const fns = vs.map((v, i) => counter(v, stats[i][0], 1.0, '', 0.1 + i * 0.12)); A(el, 38.4, 41.5, { in: 'up', inD: 0.5, out: 'fade', outD: 0.2, update: (t, lt) => fns.forEach(f => f(t, lt)) }); }
  { const el = place(h('div', 'k', 'Van order tot levering · Melkweg 1'), 110, 750); A(el, 38.4, 41.5, { in: 'fade', inD: 0.4 }); }
  { const el = place(h('div', '', `<img class="logo" src="wilvo-logo.svg" alt="WILVO">`), 650, 300, 620); A(el, 41.5, 45, { in: 'slam', inD: 0.35, inE: ease.outExpo, out: 'fade', outD: 0.8 }); }
  { const el = place(h('div', 'tag', ''), 0, 640); el.style.width = '1920px'; el.style.textAlign = 'center'; A(el, 42.0, 45, { in: 'fade', inD: 0.2, out: 'fade', outD: 0.8, update: (t, lt) => { const s = 'think. make. organize. you win.'; const n = Math.floor(clamp(lt / 1.2) * s.length); el.innerHTML = s.slice(0, n).replace('you win.', '<b>you win.</b>'); } }); }
  { const el = place(h('div', '', `<div class="k" style="text-align:center">Engineering Hub</div><div class="sub" style="text-align:center;margin-top:14px">Wat wil je maken?</div>`), 0, 760); el.style.width = '1920px'; A(el, 43.0, 45, { in: 'up', inD: 0.5, out: 'fade', outD: 0.8 }); }
}
buildOverlay();

// ---------------------------------------------------------------- shots: [t0, t1, scene, cam(lt, t)]
const S = []; const shot = (t0, t1, scene, cam) => S.push({ t0, t1, scene, cam });
const hero = [0, 0.03, 0];
shot(0.0, 0.6, 'none', () => orbit(0, 0, 1, [0, 0, 0]));
shot(0.6, 1.55, 'studio', lt => orbitT(lt / 0.95, [30, 22, 0.55, hero, 30], [60, 28, 0.5, hero, 30]));
shot(1.55, 2.5, 'aerial', lt => aerial.camT(lt / 0.95, [BLD, 420, 38, 20], [BLD, 380, 36, 26], ease.lin));
shot(2.5, 3.45, 'studio', lt => orbitT(lt / 0.95, [-25, 50, 0.9, [0.08, 0, 0.04], 30], [-12, 52, 0.8, [0.08, 0, 0.04], 30], ease.lin));
shot(3.45, 4.4, 'studio', lt => orbitT(lt / 0.95, [150, 24, 0.45, hero, 30], [180, 20, 0.4, hero, 30], ease.lin));
shot(4.4, 6.5, 'none', () => orbit(0, 0, 1, [0, 0, 0]));
// act 2: the dive — from 2.5 km straight down to a tilted view of the building
shot(6.5, 11.0, 'aerial', lt => { const k = ease.io(lt / 4.5); return aerial.camT(k, [[BLD[0] + 300, BLD[1] - 200], 2600, 4, -20, 30], [[BLD[0] - 10, BLD[1] + 10], 300, 34, 28, 30], ease.lin); });
// act 3: product in the studio, slow orbit, left of frame
const left = [0.02, 0.02, -0.12];
shot(11.0, 18.0, 'studio', lt => orbitT(lt / 7.0, [35, 26, 0.62, left, 30], [95, 22, 0.56, left, 30], ease.lin));
// act 4: per step an aerial hop (0.8 s) and the action
const hop = (t0, a, b, hd0, hd1) => shot(t0, t0 + 0.8, 'aerial', lt => aerial.camT(lt / 0.8, [ST[a], 150, 40, hd0, 30], [ST[b], 130, 42, hd1, 30]));
hop(18.0, 'kantoor', 'laser', 20, 40);
shot(18.8, 22.0, 'studio', lt => orbitT(lt / 3.2, [-25, 56, 0.9, [0.08, 0.0, 0.04], 30], [-8, 50, 0.78, [0.08, 0.0, 0.04], 30], ease.lin));
hop(22.0, 'laser', 'zett', 40, 60);
shot(22.8, 26.0, 'studio', lt => orbitT(lt / 3.2, [96, 20, 0.72, [0, 0.075, 0], 26], [84, 22, 0.66, [0, 0.075, 0], 26], ease.lin));
hop(26.0, 'zett', 'lasse', 60, 80);
shot(26.8, 30.0, 'studio', lt => orbitT(lt / 3.2, [200, 26, 0.5, hero, 30], [222, 22, 0.44, hero, 30], ease.lin));
hop(30.0, 'lasse', 'monta', 80, 110);
shot(30.8, 34.0, 'studio', lt => orbitT(lt / 3.2, [40, 18, 1.0, [0, 0.07, 0], 30], [25, 16, 0.85, [0, 0.07, 0], 30], ease.lin));
hop(34.0, 'monta', 'verze', 110, 150);
shot(34.8, 36.6, 'studio', lt => orbitT(lt / 1.8, [30, 22, 1.35, [0, 0.09, 0], 30], [45, 18, 1.2, [0, 0.09, 0], 30], ease.lin));
shot(36.6, 38.0, 'aerial', lt => aerial.camT(lt / 1.4, [ST.verze, 130, 42, 150, 30], [ST.dock, 160, 45, 175, 30]));
// act 5: pull out over the whole site, then the end card
shot(38.0, 41.5, 'aerial', lt => aerial.camT(lt / 3.5, [[BLD[0] + 20, BLD[1] - 30], 260, 40, 190, 30], [[BLD[0] - 40, BLD[1] + 40], 900, 30, 230, 30], ease.io));
shot(41.5, 45.0, 'none', () => orbit(0, 0, 1, [0, 0, 0]));
function shotAt(t) { for (const s of S) if (t >= s.t0 && t < s.t1) return s; return S[S.length - 1]; }

// ---------------------------------------------------------------- state per time
function setState(t) {
  const s = product.state; for (const k in s) s[k] = 0; s.relief = 1; s.scanY = -1;
  tools.brake.visible = tools.torch.visible = tools.ram.visible = tools.stylus.visible = tools.head.visible = false;
  product.group.position.set(0, 0, 0); product.group.rotation.set(0, 0, 0); product.group.visible = true; rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0);
  let laserWindow = [-1, -1], weldWindow = [-1, -1], arc = 0;
  // ---- hook
  if (t < 0.6) product.group.visible = false;
  else if (t < 1.55) { s.wire = 1; s.bend1 = s.bend2 = 1; product.group.rotation.y = (t - 0.6) * 0.8; }
  else if (t < 3.45) { if (t >= 2.5) { s.sheet = 1; s.cut = seg(t, 2.5, 3.45) * 0.6 + 0.2; laserWindow = [2.5, 3.45]; tools.head.visible = true; } }
  else if (t < 4.4) { s.bend1 = s.bend2 = 1; s.weld = seg(t, 3.45, 4.4); weldWindow = [3.45, 4.3]; arc = 1; }
  // ---- engineering
  else if (t < 18.0) { s.bend1 = s.bend2 = 1; const lt = t - 11; s.wire = 1 - ease.io(seg(lt, 0, 0.6)); const sc = (lt - 0.3) / 1.0; s.scanY = lt > 0.3 && lt < 1.4 ? (sc - 0.5) : -1; s.relief = seg(lt, 2.0, 2.6); s.flaw = seg(lt, 0.9, 1.1) * (1 - seg(lt, 1.9, 2.3)); if (lt > 6.5) product.group.visible = false; }
  // ---- production
  else if (t < 22.0) { s.sheet = 1; s.cut = seg(t, 19.0, 21.6); laserWindow = [19.0, 21.6]; tools.head.visible = t >= 18.8; product.group.rotation.y = 0.2; }
  else if (t < 26.0) { tools.brake.visible = t >= 22.8; const press = t0 => ({ down: seg(t, t0, t0 + 0.6), up: seg(t, t0 + 0.75, t0 + 1.05) }); const p1 = press(23.1), p2 = press(24.6); s.bend1 = p1.down; s.bend2 = p2.down; const cur = t < 24.35 ? p1 : p2; const side = t < 24.35 ? -1 : 1; product.group.position.set(0, 0, -side * BW / 2); if (t >= 24.1 && t < 24.35) product.group.position.z = BW / 2 - BW * ease.io(seg(t, 24.1, 24.35)); rig.rotation.x = side * (Math.PI / 4) * ease.io(cur.down) * (1 - ease.io(cur.up)); rig.position.y = 0.054 - 0.014 * ease.io(cur.down) * (1 - ease.io(cur.up)); tools.brake.position.y = 0.05; tools.punchGroup.position.y = 0.17 - 0.16 * ease.io(cur.down) * (1 - ease.io(cur.up)); }
  else if (t < 30.0) { s.bend1 = s.bend2 = 1; s.weld = seg(t, 27.0, 29.2); weldWindow = [27.0, 29.2]; arc = hold(t, 27.0, 29.2, 0.1); tools.torch.visible = t >= 26.8; s.weldCool = seg(t, 29.2, 30.0); }
  else if (t < 34.0) { s.bend1 = s.bend2 = 1; s.weld = 1; s.weldCool = 1; s.inserts = 1; s.base = 1; s.explode = 1 - seg(t, 31.0, 31.6); s.assemble = seg(t, 31.4, 32.8); product.group.position.y = PT; }
  else if (t < 38.0) { s.bend1 = s.bend2 = 1; s.weld = 1; s.weldCool = 1; s.inserts = 1; s.base = 1; s.assemble = 1; s.box = seg(t, 35.0, 35.6); s.boxLid = seg(t, 35.7, 36.2); product.group.position.y = PT; }
  else product.group.visible = false;
  product.apply(t);
  // effects
  product.sparks.emit = tt => product.cutPoint(clamp((tt - laserWindow[0]) / (laserWindow[1] - laserWindow[0]))).clone();
  product.sparks.update(t, laserWindow[0], laserWindow[1], 0.6);
  if (tools.head.visible) { const k = clamp((t - laserWindow[0]) / (laserWindow[1] - laserWindow[0])); const p = product.cutPoint(k); tools.head.position.set(p.x, PT + 0.012, p.z); }
  product.weldSparks.emit = tt => { const k = clamp((tt - weldWindow[0]) / (weldWindow[1] - weldWindow[0])); return new THREE.Vector3(-(BL / 2) + BL * k, PT + 0.002, BW / 2 - 0.002); };
  product.weldSparks.update(t, weldWindow[0], weldWindow[1], 0.5);
  if (tools.torch.visible || arc > 0) { const k = clamp((t - weldWindow[0]) / (weldWindow[1] - weldWindow[0])); tools.torch.position.set(-(BL / 2) + BL * k, PT + 0.004, BW / 2 + 0.004); }
  product.arc.intensity = arc > 0 ? (t < 6 ? 0.004 : 0.012) * (0.6 + 0.4 * hash(Math.floor(t * 90))) : 0; product.arc.position.copy(tools.torch.position).add(new THREE.Vector3(0, 0.01, 0));
  // ---- aerial state: outline, pins, route
  const outline = Math.max(hold(t, 1.55, 2.5, 0.2), seg(t, 8.0, 9.0) * (t < 11 ? 1 : 0), t >= 18 && t < 38 ? 0.6 : 0, t >= 38 ? seg(t, 38, 38.6) : 0);
  aerial.setOutline(outline * (0.55 + 0.45 * Math.sin(t * 4) * 0.3));
  const order = ['kantoor', 'laser', 'zett', 'lasse', 'monta', 'verze', 'dock']; const starts = { kantoor: 9.3, laser: 18.0, zett: 22.0, lasse: 26.0, monta: 30.0, verze: 34.0, dock: 36.9 };
  for (const k of order) { let a = 0; if (t >= starts[k] && t < 11.0 && k === 'kantoor') a = seg(t, 9.3, 9.6); if (t >= 18 && t < 41.5 && starts[k] <= t && k !== 'kantoor') a = Math.min(seg(t, starts[k], starts[k] + 0.3), t > 41 ? 1 - seg(t, 41, 41.5) : 1); aerial.setPin(k, a, t - starts[k]); }
  let rp = 0; if (t >= 18) { const segs = [[18, 'laser'], [22, 'zett'], [26, 'lasse'], [30, 'monta'], [34, 'verze'], [36.9, 'dock']]; for (let i = 1; i < segs.length; i++) { const [ta, ka] = segs[i - 1], [tb, kb] = segs[i]; if (t >= ta) rp = lerp(aerial.routeU[ka], aerial.routeU[kb], ease.io(seg(t, tb - 0.1, tb + 0.7))); } }
  aerial.setRoute(rp, t);
  // ---- screen effects
  flashK = Math.max(hold(t, 4.4, 4.7, 0.1) * 0.9, hold(t, 18.0, 18.25, 0.08) * 0.8, hold(t, 41.5, 41.7, 0.06) * 0.7, arc * 0.05 * hash(Math.floor(t * 60)));
  blackK = t < 0.45 ? 1 : t < 0.6 ? 1 - seg(t, 0.45, 0.6) : t >= 44.2 ? seg(t, 44.2, 45) : 0;
  paperK = (t >= 4.4 && t < 6.5) ? 1 : (t >= 41.5) ? 1 : 0;
  lboxK = (t >= 18 && t < 38) ? 1 : 0;
}

function applyCam(c) { camera.position.set(...c.pos); camera.lookAt(...c.target); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); }
export function seek(t) {
  t = clamp(t, 0, DURATION);
  setState(t);
  const sh = shotAt(t); const c = sh.cam(t - sh.t0, t); applyCam(c);
  // pin labels follow their pins on the aerial
  for (const [k, els] of Object.entries(pinLabels)) { const [x, y] = aerial.project(camera, ST[k][0], ST[k][1]); els.forEach(el => { el.style.left = (x * 1920) + 'px'; el.style.top = (y * 1080) + 'px'; el.dataset.off = sh.scene !== 'aerial' ? '1' : ''; }); }
  ov.update(t);
  for (const els of Object.values(pinLabels)) els.forEach(el => { if (el.dataset.off) el.style.opacity = '0'; });
  flash.style.opacity = flashK; black.style.opacity = blackK; paper.style.opacity = paperK; lbox.style.borderTopWidth = lbox.style.borderBottomWidth = (lboxK * 70) + 'px';
  if (sh.scene === 'none') { renderer.setClearColor('#06080b', 1); renderer.clear(); if (t < 0.6 || t >= 44.8) black.style.opacity = '1'; }
  else {
    renderPass.scene = sh.scene === 'aerial' ? aerial.scene : studio;
    if (sh.scene === 'studio') { const dark = t < 4.4; studio.background.set(dark ? '#0b0f13' : '#e6e4df'); floor.material.color.set(dark ? '#0f1316' : '#e3e1dc'); hemi.intensity = dark ? 0.15 : 0.45; product.wire.material.color.set(dark ? '#6db3ff' : '#1f6fd6'); key.position.set(camera.position.x * 0.3 + 2, Math.max(1.5, camera.position.y + 3), camera.position.z * 0.3 + 3); bloom.strength = 0.35; }
    else bloom.strength = 0.5;
    composer.render();
  }
}

// ---------------------------------------------------------------- playback
let score = null, audioCtx = null, playing = false, t0 = 0, tStart = 0;
function startAudio(from) { if (CAPTURE) return; if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (score) { try { score.master.disconnect(); } catch (e) { } } score = new Score(audioCtx, from); score.schedule(); sfxCues(score); }
function play(from = 0) { playing = true; t0 = from; tStart = performance.now(); startAudio(from); }
function loop() { requestAnimationFrame(loop); if (!playing) return; const t = t0 + (performance.now() - tStart) / 1000; if (t >= DURATION) { playing = false; seek(DURATION); return; } seek(t); }
function fit() { const s = Math.min(innerWidth / 1920, innerHeight / 1080); document.getElementById('stage').style.setProperty('--s', s); }
addEventListener('resize', fit); fit();
// wait for the aerial textures before the first frame
await new Promise(r => { const chk = () => { const ok = [aerial.wide, aerial.close].every(m => m.material.map.image && m.material.map.image.width); ok ? r() : setTimeout(chk, 50); }; chk(); });
window.__trailer = { seek, DURATION, ready: true, play };
if (!CAPTURE) {
  const start = parseFloat(Q.get('t') || '0') || 0; seek(start);
  const hint = h('div', 'hint', 'klik of spatie: afspelen / pauze · ← → : 5 s'); document.getElementById('stage').appendChild(hint);
  const toggle = () => { if (playing) { playing = false; t0 = t0 + (performance.now() - tStart) / 1000; if (audioCtx) audioCtx.suspend(); } else { if (audioCtx) audioCtx.resume(); play(t0 >= DURATION ? 0 : t0); } };
  addEventListener('click', toggle); addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle(); } if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { const was = playing; playing = false; t0 = clamp((was ? t0 + (performance.now() - tStart) / 1000 : t0) + (e.code === 'ArrowRight' ? 5 : -5), 0, DURATION); seek(t0); if (was) play(t0); } });
  if (Q.has('autoplay')) play(start);
  loop();
}
