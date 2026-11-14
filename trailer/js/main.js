// WILVO Engineering trailer · "Van order tot levering" · 45 s · the real draaiplateau from order to delivery.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, mix, seg, hold, ease, hash } from './util.js';
import { Map2D } from './map2d.js';
import { Draaiplateau, P } from './draaiplateau.js';
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
const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.02, 200);
const composer = new EffectComposer(renderer); composer.setSize(1920, 1080);
const renderPass = new RenderPass(new THREE.Scene(), camera); composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.3, 0.5, 1.0); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- studio (the product)
const studio = new THREE.Scene(); studio.background = new THREE.Color('#e6e4df'); studio.environment = env;
const hemi = new THREE.HemisphereLight('#ffffff', '#b9b4aa', 0.45); studio.add(hemi);
const key = new THREE.DirectionalLight('#fff4e6', 1.5); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.1; key.shadow.camera.far = 40; key.shadow.bias = -0.00004; key.shadow.normalBias = 0.004; key.shadow.camera.left = key.shadow.camera.bottom = -1.0; key.shadow.camera.right = key.shadow.camera.top = 1.0; studio.add(key); studio.add(key.target);
const rim = new THREE.DirectionalLight('#dde9ff', 0.6); rim.position.set(-4, 3, -5); studio.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#e3e1dc', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001; floor.receiveShadow = true; studio.add(floor);
const product = new Draaiplateau(env); await product.load('./assets/draaiplateau.glb'); studio.add(product.group); studio.add(product.tools);
const tools = product;
function orbit(az, el, dist, target, fov = 32) { const a = az * Math.PI / 180, e = el * Math.PI / 180; return { pos: [target[0] + dist * Math.cos(e) * Math.sin(a), target[1] + dist * Math.sin(e), target[2] + dist * Math.cos(e) * Math.cos(a)], target, fov }; }
const orbitT = (t, A, B, e = ease.io) => { const k = e(t); return orbit(lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k), mix(A[3], B[3], k), lerp(A[4] ?? 32, B[4] ?? 32, k)); };

// ---------------------------------------------------------------- the location (2D map)
const site = await (await fetch('./site.json')).json();
const mapCanvas = document.getElementById('map');
const map = new Map2D(mapCanvas, site); await map.load;
const ST = site.stations; const BLD = [105, 72];

// ---------------------------------------------------------------- overlay
const ui = document.getElementById('ui'); const ov = new Overlay(ui);
const flash = document.getElementById('flash'), black = document.getElementById('black'), paper = document.getElementById('paperbg'), lbox = document.getElementById('letterbox');
let flashK = 0, blackK = 0, paperK = 0, lboxK = 0;
const pinLabels = {};

function buildOverlay() {
  const A = (el, t0, t1, o) => ov.add(el, t0, t1, o);
  const place = (el, x, y, w) => { el.style.left = x + 'px'; el.style.top = y + 'px'; if (w) el.style.width = w + 'px'; return el; };
  // ---- act 1: hook
  const words = ['EEN ORDER.', 'ÉÉN PRODUCT.', 'ÉÉN ROUTE.', 'ÉÉN HUB.'];
  words.forEach((w, i) => { const t0 = 0.6 + i * 0.95; const el = place(h('div', 'big white', w), 110, 740); el.style.textShadow = '0 10px 50px rgba(0,0,0,0.5)'; A(el, t0, t0 + 0.95, { in: 'slam', inD: 0.16, inE: ease.outExpo, out: 'none', outD: 0.01 }); });
  { const el = place(h('div', 'k', 'WILVO · MELKWEG 1 · BERGEIJK'), 110, 690); el.style.color = '#fff'; A(el, 0.6, 4.4, { in: 'fade', inD: 0.3 }); }
  { const el = place(h('div', '', `<img class="logo" src="wilvo-logo.svg" alt="WILVO"><div class="k" style="margin-top:34px">Engineering</div><div class="title" style="margin-top:12px">Van order tot levering</div>`), 110, 300, 1200); A(el, 4.4, 6.5, { in: 'slam', inD: 0.35, inE: ease.outExpo, out: 'none', outD: 0.01 }); }
  // ---- act 2: order
  { const el = place(h('div', 'chip', '<i></i>Melkweg 1 · Bergeijk'), 110, 920); A(el, 7.0, 11.0, { in: 'left', inD: 0.5 }); }
  { const el = place(h('div', 'card', `<div class="k">Nieuwe order</div><h2>Draaiplateau · 25 stuks</h2><p>De klant stuurt het TPD: STEP-model, lastekeningen en de exploded view.</p><div class="files"><div class="file step"><b>STEP</b>DRAAIPLATEAU.stp</div><div class="file"><b>PDF</b>Lastekening_middenas.pdf</div></div><div class="row"><div><small>Materiaal</small>Alu · 6 mm</div><div><small>Levertijd</small>3 weken</div><div><small>Order</small>SO-26-04812</div></div>`), 1120, 150, 720); A(el, 7.6, 10.8, { in: 'left', inD: 0.5, inE: ease.outBack, out: 'right', outD: 0.3, dist: 90 }); }
  const pin = (k, text, t0, t1, cls = '') => { const el = h('div', 'pinwrap'); const chip = h('div', 'label3d ' + cls, text); chip.style.transform = 'translate(-50%, -170%)'; el.appendChild(chip); pinLabels[k] = pinLabels[k] || []; pinLabels[k].push(el); A(el, t0, t1, { in: 'pop', inD: 0.3, inE: ease.outBack, out: 'fade', outD: 0.15 }); };
  pin('kantoor', 'Werkvoorbereiding', 9.6, 11.0, 'red');
  // ---- act 3: text montage (texts come from the real skill output for this product)
  const mont = (t0, t1, k, title, sub) => { const el = place(h('div', 'mont', `<div class="k">${k}</div><div class="mt">${title}</div>${sub ? `<div class="ms">${sub}</div>` : ''}`), 110, 150, 900); A(el, t0, t1, { in: 'slam', inD: 0.22, inE: ease.outExpo, out: 'fade', outD: 0.12 }); return el; };
  mont(11.0, 12.4, 'AI-skill · 1', 'Maakbaarheid<br>gecheckt', '16 sleuven 20 × 8 passen de nokken · a1 rondom haalbaar · <span class="bad">1 bevinding: lasproces staat niet op de tekening</span>');
  mont(12.4, 13.8, 'AI-skill · 2', '3D-model<br>gerepareerd', 'DRAAIPLATEAU_gecorrigeerd.stp · dubbele lagers eruit · 16 houders in lijn');
  mont(13.8, 15.4, 'AI-skill · 3', 'Route<br>voorspeld', '');
  { const r = place(h('div', 'route', ['Laser', 'Zagen', 'Lassen', 'Montage', 'Expeditie'].map((s, i) => `<span><b>${i + 1}</b>&nbsp;${s}</span>`).join('')), 110, 560); A(r, 14.0, 15.4, { in: 'fade', inD: 0.1, update: stagger(r, 0.1, 0, 24) }); }
  mont(15.4, 16.6, 'AI-skill · 3', 'Werkinstructies<br>gegenereerd', 'Draaiplateau lassen · 10 stappen &nbsp;·&nbsp; Draaiplateau monteren · 9 stappen &nbsp;·&nbsp; 3D, per stap, met stuklijst');
  mont(16.6, 17.5, 'Engineering Hub', 'Wat wil je<br>maken?', 'Inspection Plan · Tekening uitlezen · Instructiemaker · Montage · 3D-viewer · Epicor issues · Digital twin');
  { const el = place(h('div', 'big', 'Klaar voor productie'), 110, 430); el.style.fontSize = '160px'; A(el, 17.5, 18.0, { in: 'slam', inD: 0.2, inE: ease.outExpo, out: 'none', outD: 0.01 }); }
  // ---- act 4: production HUD
  const depts = [['Lasersnijden', 'Bystronic BySpeed 3015 · Alu 6 mm', '#9dbb61', 18.0, 22.0, 'laser'], ['Zagen', 'Kaltenbach KKS 401 · middenas Ø20 × 27', '#f0954a', 22.0, 26.0, 'zett'], ['Lassen', 'TIG 141 · a1 rondom + 16 I-naden', '#d0675d', 26.0, 30.0, 'lasse'], ['Montage', '8 lagers · 8 × M8 · M10 verzonken', '#ffc93c', 30.0, 34.0, 'monta'], ['Expeditie', 'Verzendmagazijn · dock 2', '#8b9298', 34.0, 38.0, 'verze']];
  depts.forEach(([n, m, c, t0, t1, k], i) => { const el = place(h('div', 'hud', `<div class="zone" style="background:${c}"></div><div class="step">${i + 1}<small>/5</small></div><div class="dept"><div class="name">${n}</div><div class="mach">${m}</div></div>`), 110, 0); el.style.top = ''; el.style.bottom = '110px'; A(el, t0, t1, { in: 'up', inD: 0.3, inE: ease.outExpo, out: 'fade', outD: 0.15, dist: 60 }); pin(k, n, t0 + 0.15, t0 + 0.85); });
  { const el = place(h('div', 'progress', '<i></i>'), 110, 0); el.style.top = ''; const bar = el.firstChild; A(el, 18, 38, { in: 'fade', inD: 0.3, update: t => { bar.style.width = (100 * seg(t, 18, 38)) + '%'; } }); }
  const corner = (t0, t1, k, v) => { const el = place(h('div', 'corner', `<div class="k">${k}</div><div class="v">${v}</div>`), 0, 110); el.style.left = ''; el.style.right = '110px'; A(el, t0, t1, { in: 'down', inD: 0.3, out: 'fade', outD: 0.15 }); };
  corner(18.8, 22.0, 'Snijden', 'onderplaat: tapgat + 16 sleuven<br>bovenplaat: verzonken gat · 2 × 600 × 600');
  corner(22.8, 26.0, 'Zagen', 'buis Ø20 × 16,8 · Alu<br>op lengte 27 mm · pos 1');
  corner(26.8, 30.0, 'Lassen', 'middenas: hoeklas a1 rondom<br>16 nokken: I-naad, vlak afgewerkt');
  corner(30.8, 34.0, 'Montage', '8 lagers Ø22 × 7 tussen de houders<br>M8 × 30 + moer · bovenplaat · M10 × 40');
  corner(34.8, 38.0, 'Expeditie', 'SO-26-04812 · 25 stuks');
  // ---- act 5: finale
  pin('dock', 'Geleverd', 36.9, 41.4, 'red');
  { const bd = place(h('div', '', ''), 0, 640); bd.style.width = '1920px'; bd.style.height = '440px'; bd.style.background = 'linear-gradient(180deg, rgba(10,13,16,0) 0%, rgba(10,13,16,0.75) 50%, rgba(10,13,16,0.9) 100%)'; A(bd, 38.2, 41.5, { in: 'fade', inD: 0.6, out: 'fade', outD: 0.2 }); }
  { const stats = [[5, 'bewerkingen'], [3, 'AI-skills'], [8, 'generatoren'], [1, 'Engineering Hub']]; const el = place(h('div', 'stats light', stats.map(([n, l]) => `<div class="stat"><div class="v">0</div><div class="l">${l}</div></div>`).join('')), 110, 800); const vs = [...el.querySelectorAll('.v')]; const fns = vs.map((v, i) => counter(v, stats[i][0], 1.0, '', 0.1 + i * 0.12)); A(el, 38.4, 41.5, { in: 'up', inD: 0.5, out: 'fade', outD: 0.2, update: (t, lt) => fns.forEach(f => f(t, lt)) }); }
  { const el = place(h('div', 'k light', 'Van order tot levering · Melkweg 1'), 110, 750); A(el, 38.4, 41.5, { in: 'fade', inD: 0.4 }); }
  { const el = place(h('div', '', `<img class="logo" src="wilvo-logo.svg" alt="WILVO">`), 650, 300, 620); A(el, 41.5, 45, { in: 'slam', inD: 0.35, inE: ease.outExpo, out: 'fade', outD: 0.8 }); }
  { const el = place(h('div', 'tag', ''), 0, 640); el.style.width = '1920px'; el.style.textAlign = 'center'; A(el, 42.0, 45, { in: 'fade', inD: 0.2, out: 'fade', outD: 0.8, update: (t, lt) => { const s = 'think. make. organize. you win.'; const n = Math.floor(clamp(lt / 1.2) * s.length); el.innerHTML = s.slice(0, n).replace('you win.', '<b>you win.</b>'); } }); }
  { const el = place(h('div', '', `<div class="k" style="text-align:center">Engineering Hub</div><div class="sub" style="text-align:center;margin-top:14px">Wat wil je maken?</div>`), 0, 760); el.style.width = '1920px'; A(el, 43.0, 45, { in: 'up', inD: 0.5, out: 'fade', outD: 0.8 }); }
}
buildOverlay();

// ---------------------------------------------------------------- shots: [t0, t1, scene, cam(lt, t)]
const S = []; const shot = (t0, t1, scene, cam) => S.push({ t0, t1, scene, cam });
const C = [0, 0.02, 0];
const mapT = (k, A, B, e = ease.io) => [lerp(A[0], B[0], e(k)), lerp(A[1], B[1], e(k)), Math.exp(lerp(Math.log(A[2]), Math.log(B[2]), e(k))), lerp(A[3] || 0, B[3] || 0, e(k))];
const nok = i => { const p = product.nokPos(i, 18); return [p.x, p.y, p.z]; };
shot(0.0, 0.6, 'none', () => null);
shot(0.6, 1.55, 'studio', lt => orbitT(lt / 0.95, [30, 24, 1.5, C, 30], [60, 28, 1.4, C, 30]));                 // wire STEP
shot(1.55, 2.5, 'map', lt => mapT(lt / 0.95, [BLD[0], BLD[1], 5.2, -0.12], [BLD[0], BLD[1], 5.8, -0.1], ease.lin));
shot(2.5, 3.45, 'studio', lt => orbitT(lt / 0.95, [-25, 50, 1.6, [-0.2, 0, 0], 30], [-12, 52, 1.5, [-0.2, 0, 0], 30], ease.lin)); // laser
shot(3.45, 4.4, 'studio', lt => orbitT(lt / 0.95, [40, 30, 0.3, [0, 0.03, 0], 30], [55, 26, 0.27, [0, 0.03, 0], 30], ease.lin));   // weld ring
shot(4.4, 6.5, 'none', () => null);
shot(6.5, 11.0, 'map', lt => mapT(lt / 4.5, [BLD[0] + 240, BLD[1] - 160, 0.86, -0.1], [BLD[0] + 25, BLD[1] + 5, 6.2, 0.0], ease.io));
const left = [0.1, 0.03, -0.2];
shot(11.0, 18.0, 'studio', lt => orbitT(lt / 7.0, [35, 30, 1.55, left, 30], [95, 26, 1.45, left, 30], ease.lin));
const hop = (t0, a, b) => shot(t0, t0 + 0.8, 'map', lt => mapT(lt / 0.8, [ST[a][0], ST[a][1], 7.5, 0.0], [ST[b][0], ST[b][1], 7.5, 0.0]));
hop(18.0, 'kantoor', 'laser');
shot(18.8, 22.0, 'studio', lt => orbitT(lt / 3.2, [-30, 50, 1.7, [-0.1, 0, 0], 30], [-5, 44, 1.45, [0.05, 0, 0], 30], ease.lin));
hop(22.0, 'laser', 'zett');
shot(22.8, 26.0, 'studio', lt => orbitT(lt / 3.2, [55, 22, 0.7, [-0.04, 0.08, 0], 28], [40, 20, 0.6, [-0.02, 0.07, 0], 28], ease.lin));
hop(26.0, 'zett', 'lasse');
shot(26.8, 27.9, 'studio', lt => orbitT(lt / 1.1, [30, 36, 0.34, [0, 0.02, 0], 30], [60, 30, 0.3, [0, 0.02, 0], 30], ease.lin));     // middenas a1
shot(27.9, 28.5, 'studio', lt => orbitT(lt / 0.6, [40, 34, 1.5, [0, 0.03, 0], 30], [48, 32, 1.5, [0, 0.03, 0], 30], ease.io));          // flip
shot(28.5, 30.0, 'studio', lt => orbitT(lt / 1.5, [30, 38, 0.5, nok(4), 30], [60, 34, 0.9, [0, 0.03, 0], 30], ease.io));                 // nok welds, pulling out
hop(30.0, 'lasse', 'monta');
shot(30.8, 32.4, 'studio', lt => orbitT(lt / 1.6, [25, 28, 0.34, nok(1), 30], [45, 26, 0.34, nok(1), 30], ease.lin));                  // bearing + M8 + nut
shot(32.4, 34.0, 'studio', lt => orbitT(lt / 1.6, [40, 28, 1.5, [0, 0.04, 0], 30], [25, 24, 1.3, [0, 0.04, 0], 30], ease.lin));          // top plate + M10
hop(34.0, 'monta', 'verze');
shot(34.8, 36.6, 'studio', lt => orbitT(lt / 1.8, [30, 34, 1.9, [0, 0.08, 0], 30], [45, 30, 1.7, [0, 0.08, 0], 30], ease.lin));
shot(36.6, 38.0, 'map', lt => mapT(lt / 1.4, [ST.verze[0], ST.verze[1], 7.5, 0], [ST.dock[0], ST.dock[1] + 10, 6.5, 0.03]));
shot(38.0, 41.5, 'map', lt => mapT(lt / 3.5, [BLD[0] + 20, BLD[1] - 10, 5.2, 0.03], [BLD[0] - 40, BLD[1] + 20, 1.35, 0.22], ease.io));
shot(41.5, 45.0, 'none', () => null);
function shotAt(t) { for (const s of S) if (t >= s.t0 && t < s.t1) return s; return S[S.length - 1]; }

// ---------------------------------------------------------------- state per time
const mapState = { outline: 0, pins: {}, route: 0, pulse: 0 };
function setState(t) {
  const s = product.state; Object.assign(s, { wire: 0, show: 1, sheet: 0, cut: 0, tube: 0, saw: 0, nok: 1, mid: 1, flip: 0, weldRing: 1, weldNok: 1, weldCool: 1, bearings: 1, screws: 1, nuts: 1, top: 1, topY: 0, bolt: 1, boltY: 0, carton: 0, cartonLid: 0, flaw: 0, scanY: -1 });
  product.head.visible = product.torch.visible = product.blade.visible = product.key.visible = product.spanner.visible = false;
  product.group.position.set(0, 0, 0); product.group.rotation.set(0, 0, 0); product.group.visible = true;
  let laserWindow = [-1, -1], weldWindow = [-1, -1], arc = 0, torchAt = null, sawWindow = [-1, -1];
  const bare = () => Object.assign(s, { nok: 0, mid: 0, weldRing: 0, weldNok: 0, weldCool: 0, bearings: 0, screws: 0, nuts: 0, top: 0, bolt: 0 });
  // ---- hook
  if (t < 0.6) product.group.visible = false;
  else if (t < 1.55) { s.wire = 1; product.group.rotation.y = (t - 0.6) * 0.5; }
  else if (t < 3.45) { if (t >= 2.5) { s.sheet = 1; s.cut = 0.55 + seg(t, 2.5, 3.45) * 0.2; laserWindow = [2.5, 3.45]; product.head.visible = true; } }
  else if (t < 4.4) { bare(); s.nok = 1; s.mid = 1; s.weldRing = seg(t, 3.45, 4.3); weldWindow = [3.45, 4.3]; arc = 1; torchAt = 'ring'; }
  // ---- engineering: the assembled model, scan, flaw on the lagers, fix
  else if (t < 18.0) { const lt = t - 11; s.wire = 1 - ease.io(seg(lt, 0, 0.6)); const sc = (lt - 0.3) / 1.0; s.scanY = lt > 0.3 && lt < 1.4 ? (sc - 0.5) : -1; s.flaw = seg(lt, 0.9, 1.1) * (1 - seg(lt, 1.9, 2.3)); s.topY = 0; if (lt > 6.5) product.group.visible = false; product.group.rotation.y = lt * 0.1; }
  // ---- production
  else if (t < 22.0) { s.sheet = 1; s.cut = ease.lin(seg(t, 19.0, 21.7)); laserWindow = [19.0, 21.7]; product.head.visible = t >= 18.8; }
  else if (t < 26.0) { s.tube = 1; sawWindow = [23.4, 24.6]; const k = seg(t, 23.4, 24.6); s.saw = k + seg(t, 24.7, 25.4); product.blade.visible = t >= 22.8; product.blade.position.set(0.0, 0.05 + 0.128 - 0.04 * ease.io(k) + 0.04 * ease.io(seg(t, 24.7, 25.2)), 0.0); product.blade.rotation.x = t * 40; }
  else if (t < 30.0) { bare(); s.nok = 1; s.mid = 1; s.weldRing = seg(t, 26.9, 27.8); s.weldCool = seg(t, 27.9, 28.6); weldWindow = [26.9, 27.8]; arc = hold(t, 26.9, 27.8, 0.06); torchAt = 'ring'; product.torch.visible = t >= 26.8 && t < 27.85; s.flip = seg(t, 27.95, 28.45); if (t >= 28.5) { s.weldNok = seg(t, 28.5, 29.7); const i = Math.min(15, Math.floor(s.weldNok * 16)); const a = 28.5 + i * 0.075; weldWindow = [a, a + 0.075]; arc = t < 29.75 ? 1 : 0; torchAt = i; product.torch.visible = t < 29.75; } }
  else if (t < 34.0) { bare(); s.nok = 1; s.mid = 1; s.weldRing = 1; s.weldNok = 1; s.weldCool = 1; s.bearings = seg(t, 30.9, 31.3) * 0.125 + seg(t, 31.9, 32.5) * 0.875; s.screws = seg(t, 31.15, 31.5) * 0.125 + seg(t, 32.0, 32.6) * 0.875; s.nuts = seg(t, 31.4, 31.75) * 0.125 + seg(t, 32.1, 32.7) * 0.875; s.top = 1; s.topY = 1 - ease.io(seg(t, 32.6, 33.3)); s.bolt = 1; s.boltY = 1 - ease.io(seg(t, 33.35, 33.75)); product.spanner.visible = t >= 31.45 && t < 31.9; product.key.visible = t >= 33.3 && t < 33.95; }
  else if (t < 38.0) { s.carton = seg(t, 34.8, 35.3); const drop = ease.io(seg(t, 35.4, 36.0)); product.group.position.y = 0.006 + 0.3 * (1 - drop); s.cartonLid = seg(t, 36.0, 36.5); }
  else product.group.visible = false;
  product.apply(t);
  product.carton.position.y = -product.group.position.y;
  // effects
  product.sparks.emit = tt => product.cutPoint(0.55 * (t < 6 ? 1 : 0) + clamp((tt - laserWindow[0]) / (laserWindow[1] - laserWindow[0])) * (t < 6 ? 0.2 : 1)).clone();
  product.sparks.update(t, laserWindow[0], laserWindow[1], 0.7);
  if (product.head.visible) { const p = product.cutPoint(s.cut); product.head.position.set(p.x, 0.006 + 0.012, p.z); }
  let wp = new THREE.Vector3(0, 0.006, 0); let ang = 0;
  if (torchAt === 'ring') { const k = clamp((t - weldWindow[0]) / (weldWindow[1] - weldWindow[0])); ang = k * Math.PI * 2; wp = new THREE.Vector3(0.0112 * Math.cos(ang), 0.006, 0.0112 * Math.sin(ang)); product.torch.position.set(wp.x * 1.9, 0.012, wp.z * 1.9); product.torch.rotation.set(0, -ang, 0); product.torch.rotateX(-0.45); }
  else if (typeof torchAt === 'number') { const k = clamp((t - weldWindow[0]) / (weldWindow[1] - weldWindow[0])); const c = product.nokPos(torchAt, 0); const a = k * Math.PI * 2; wp = new THREE.Vector3(c.x + 0.011 * Math.cos(a), c.y + 0.001, c.z + 0.006 * Math.sin(a)); product.torch.position.set(wp.x + 0.004, wp.y + 0.006, wp.z + 0.004); product.torch.rotation.set(0.35, 0, -0.35); }
  product.weldSparks.emit = () => wp.clone(); product.weldSparks.update(t, weldWindow[0], weldWindow[1], 0.4);
  product.arc.intensity = arc > 0 ? (t < 6 ? 0.0002 : 0.0004) * (0.6 + 0.4 * hash(Math.floor(t * 90))) : 0; product.arc.position.copy(wp).add(new THREE.Vector3(0, 0.008, 0));
  product.sawSparks.emit = () => new THREE.Vector3(0.0, 0.05 - 0.008, 0.0); product.sawSparks.update(t, sawWindow[0], sawWindow[1], 0.6);
  if (product.spanner.visible) { const r = Math.min(7, Math.floor(s.nuts * 8)); const i = product.order.nuts.indexOf(r); const c = product.rest.nuts[i]; const p = P(c.x, c.y, c.z); const a = product.screwAxis[i]; product.spanner.position.set(p.x + a.x * 0.012, p.y, p.z - a.y * 0.012); product.spanner.rotation.set(0, Math.atan2(a.x, -a.y) + Math.PI / 2, 0.6 * Math.sin(t * 14)); }
  if (product.key.visible) { const k = seg(t, 33.35, 33.95); product.key.position.set(0, 0.041 + 0.015 - 0.012 * ease.io(k), 0); product.key.rotation.y = k * Math.PI * 4; }
  // ---- map state
  mapState.outline = Math.max(hold(t, 1.55, 2.5, 0.2), seg(t, 8.4, 9.2) * (t < 11 ? 1 : 0), t >= 18 && t < 38 ? 0.7 : 0, t >= 38 ? seg(t, 38, 38.6) : 0);
  const starts = { kantoor: 9.6, laser: 18.0, zett: 22.0, lasse: 26.0, monta: 30.0, verze: 34.0, dock: 36.9 };
  for (const k of Object.keys(starts)) { let a = 0; if (k === 'kantoor') a = t >= 9.6 && t < 11 ? seg(t, 9.6, 9.9) : 0; else if (t >= 18 && t < 41.5 && starts[k] <= t) a = Math.min(seg(t, starts[k], starts[k] + 0.3), t > 41 ? 1 - seg(t, 41, 41.5) : 1); mapState.pins[k] = a; }
  let rp = 0; if (t >= 18) { const segs = [[18, 'laser'], [22, 'zett'], [26, 'lasse'], [30, 'monta'], [34, 'verze'], [36.9, 'dock']]; for (let i = 1; i < segs.length; i++) { const [, ka] = segs[i - 1], [tb, kb] = segs[i]; if (t >= tb - 0.1) rp = lerp(map.routeU[ka], map.routeU[kb], ease.io(seg(t, tb - 0.1, tb + 0.7))); } }
  mapState.route = rp; mapState.pulse = t;
  // ---- screen effects
  flashK = Math.max(hold(t, 4.4, 4.7, 0.1) * 0.9, hold(t, 18.0, 18.25, 0.08) * 0.8, hold(t, 41.5, 41.7, 0.06) * 0.7, arc * 0.03 * hash(Math.floor(t * 60)));
  blackK = t < 0.45 ? 1 : t < 0.6 ? 1 - seg(t, 0.45, 0.6) : t >= 44.2 ? seg(t, 44.2, 45) : 0;
  paperK = (t >= 4.4 && t < 6.5) ? 1 : (t >= 41.5) ? 1 : 0;
  lboxK = (t >= 18 && t < 38) ? 1 : 0;
}

function applyCam(c) { camera.position.set(...c.pos); camera.lookAt(...c.target); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); }
export function seek(t) {
  t = clamp(t, 0, DURATION);
  setState(t);
  const sh = shotAt(t); const c = sh.cam(t - sh.t0, t);
  const onMap = sh.scene === 'map';
  if (onMap) { map.setCam(...c); map.draw(t, mapState); }
  mapCanvas.style.opacity = onMap ? '1' : '0';
  for (const [k, els] of Object.entries(pinLabels)) { const [x, y] = map.project(ST[k][0], ST[k][1]); els.forEach(el => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.dataset.off = onMap ? '' : '1'; }); }
  ov.update(t);
  for (const els of Object.values(pinLabels)) els.forEach(el => { if (el.dataset.off) el.style.opacity = '0'; });
  flash.style.opacity = flashK; black.style.opacity = blackK; paper.style.opacity = paperK; lbox.style.borderTopWidth = lbox.style.borderBottomWidth = (lboxK * 70) + 'px';
  if (sh.scene !== 'studio') { renderer.setClearColor('#06080b', 1); renderer.clear(); if (sh.scene === 'none' && (t < 0.6 || t >= 44.8)) black.style.opacity = '1'; }
  else {
    renderPass.scene = studio; applyCam(c);
    const dark = t < 4.4; studio.background.set(dark ? '#0b0f13' : '#e6e4df'); floor.material.color.set(dark ? '#0f1316' : '#e3e1dc'); hemi.intensity = dark ? 0.15 : 0.45; product.wireMat.color.set(dark ? '#6db3ff' : '#1f6fd6');
    key.position.set(-camera.position.z * 0.6 + 2.5, Math.max(2.5, camera.position.y + 4), camera.position.x * 0.6 + 2.5); bloom.strength = 0.3;
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
window.__trailer = { seek, DURATION, ready: true, play };
if (!CAPTURE) {
  const start = parseFloat(Q.get('t') || '0') || 0; seek(start);
  const hint = h('div', 'hint', 'klik of spatie: afspelen / pauze · ← → : 5 s'); document.getElementById('stage').appendChild(hint);
  const toggle = () => { if (playing) { playing = false; t0 = t0 + (performance.now() - tStart) / 1000; if (audioCtx) audioCtx.suspend(); } else { if (audioCtx) audioCtx.resume(); play(t0 >= DURATION ? 0 : t0); } };
  addEventListener('click', toggle); addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle(); } if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { const was = playing; playing = false; t0 = clamp((was ? t0 + (performance.now() - tStart) / 1000 : t0) + (e.code === 'ArrowRight' ? 5 : -5), 0, DURATION); seek(t0); if (was) play(t0); } });
  if (Q.has('autoplay')) play(start);
  loop();
}
