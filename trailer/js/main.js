// WILVO Engineering trailer · "Van order tot levering" · timeline, cameras, overlays, sound.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, mix, seg, hold, ease, track, hash, BEAT, BAR } from './util.js';
import { World, W, ZONE_ORDER } from './world.js';
import { Product, Tools, PRODUCT, BL, BW, FH, T as PT } from './product.js';
import { Overlay, h, typer, counter, stagger } from './overlay.js';
import { Score } from './audio.js';
import { sfxCues } from './cues.js';

export const DURATION = 90;
const DROP = 42.0;
const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
const pmrem = new THREE.PMREMGenerator(renderer); const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 2500);
const composer = new EffectComposer(renderer); composer.setSize(1920, 1080);
const renderPass = new RenderPass(new THREE.Scene(), camera); composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.3, 0.5, 1.0); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- studio (product + machines)
const studio = new THREE.Scene(); studio.background = new THREE.Color('#e6e4df'); studio.environment = env;
{
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b4aa', 0.45); studio.add(hemi);
  const key = new THREE.DirectionalLight('#fff4e6', 1.5); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.1; key.shadow.camera.far = 40; key.shadow.bias = -0.00004; key.shadow.normalBias = 0.004; studio.add(key); studio.add(key.target); studio.userData.key = key;
  const rim = new THREE.DirectionalLight('#dde9ff', 0.6); rim.position.set(-4, 3, -5); studio.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#e3e1dc', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001; floor.receiveShadow = true; studio.add(floor); studio.userData.floor = floor;
}
const product = new Product(env); const rig = new THREE.Group(); rig.add(product.group); studio.add(rig);
const tools = new Tools(env); studio.add(tools.group);
const machines = {}; // id -> { root, box, size, center }
const MACH = { laser: 'm07-bystronic-byspeed', brake: 'm29-bystronic-xpert', robot: 'm12-otc-lasrobot', press: 'm-inp-haeger824', cmm: 'm64-sciroco-cmm', crane: 'm-mont-zwenkkraan' };
async function loadMachines() {
  const L = new GLTFLoader();
  await Promise.all(Object.entries(MACH).map(async ([id, file]) => {
    try {
      const g = await L.loadAsync(`./models/${file}.glb`); const root = g.scene; root.visible = false;
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.isMeshStandardMaterial) { o.material.envMapIntensity = 0.9; } } });
      const box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); box.getSize(size); const center = new THREE.Vector3(); box.getCenter(center);
      // stand it on the studio floor, centred on the origin
      root.position.set(-center.x, -box.min.y, -center.z);
      studio.add(root); machines[id] = { root, size, center: new THREE.Vector3(0, size.y / 2, 0) };
    } catch (e) { console.warn('machine missing', id, e.message); }
  }));
}
function showMachine(id) { for (const [k, m] of Object.entries(machines)) m.root.visible = k === id; }
// spherical studio camera: az/el in degrees, dist in metres, target in metres
function orbit(az, el, dist, target, fov = 32) { const a = az * Math.PI / 180, e = el * Math.PI / 180; return { pos: [target[0] + dist * Math.cos(e) * Math.sin(a), target[1] + dist * Math.sin(e), target[2] + dist * Math.cos(e) * Math.cos(a)], target, fov }; }
const orbitT = (t, A, B, e = ease.io) => { const k = e(t); return orbit(lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k), mix(A[3], B[3], k), lerp(A[4] ?? 32, B[4] ?? 32, k)); };

// ---------------------------------------------------------------- world (the twin)
const world = new World(renderer, env);
const data = await (await fetch('./data.json')).json();
await Promise.all([world.load(data), loadMachines()]);
// hall camera in plan coordinates: [x, y, h]
const hallCam = (pos, target, fov = 35) => ({ pos: W(pos[0], pos[1], pos[2]).toArray(), target: W(target[0], target[1], target[2]).toArray(), fov });
const deptView = (k, o = {}) => { const s = world.stations[k]; const d = o.d ?? 1; return hallCam([s[0] - 20 * d + (o.dx || 0), s[1] - 24 * d + (o.dy || 0), 20 * d + (o.dh || 0)], [s[0], s[1], 1.2], o.fov ?? 38); };

// ---------------------------------------------------------------- overlay
const ui = document.getElementById('ui'); const ov = new Overlay(ui);
const flash = document.getElementById('flash'), black = document.getElementById('black'), paper = document.getElementById('paperbg'), lbox = document.getElementById('letterbox');
let flashK = 0, blackK = 0, paperK = 0, lboxK = 0;

function buildOverlay() {
  const A = (el, t0, t1, o) => ov.add(el, t0, t1, o);
  const place = (el, x, y, w) => { el.style.left = x + 'px'; el.style.top = y + 'px'; if (w) el.style.width = w + 'px'; return el; };
  // ---- act 1: hook
  const hookWords = ['EEN ORDER.', 'ÉÉN PRODUCT.', 'ÉÉN ROUTE.', 'ÉÉN HUB.'];
  hookWords.forEach((w, i) => { const t0 = 0.9 + i * 1.17; const el = place(h('div', 'big white', w), 110, 740); el.style.textShadow = '0 10px 50px rgba(0,0,0,0.5)'; A(el, t0, t0 + 1.17, { in: 'slam', inD: 0.18, inE: ease.outExpo, out: 'none', outD: 0.01 }); });
  { const el = place(h('div', 'k', 'WILVO · MELKWEG 1 · BERGEIJK'), 110, 690); el.style.color = '#fff'; A(el, 0.9, 5.55, { in: 'fade', inD: 0.3 }); }
  { const el = place(h('div', '', `<img class="logo" src="wilvo-logo.svg" alt="WILVO"><div class="k" style="margin-top:34px">Engineering</div><div class="title" style="margin-top:12px">Van order tot levering</div>`), 110, 300, 1200); A(el, 5.6, 7.6, { in: 'slam', inD: 0.35, inE: ease.outExpo, out: 'fade', outD: 0.3 }); }
  // ---- act 2: order
  { const el = place(h('div', 'chip', '<i></i>Melkweg 1 · Bergeijk'), 110, 920); A(el, 7.9, 12.2, { in: 'left', inD: 0.5 }); }
  { const el = place(h('div', 'card', `<div class="k">Nieuwe order</div><h2>Behuizing A · 250 stuks</h2><p>Klant stuurt het technisch productdossier: STEP-model en tekening.</p><div class="files"><div class="file step"><b>STEP</b>behuizing-A.step</div><div class="file"><b>PDF</b>tekening-A-rev-B.pdf</div></div><div class="row"><div><small>Materiaal</small>S235 · 3,0 mm</div><div><small>Levertijd</small>3 weken</div><div><small>Order</small>SO-26-04812</div></div>`), 1080, 300, 720); A(el, 9.4, 13.4, { in: 'left', inD: 0.5, inE: ease.outBack, out: 'right', outD: 0.4, dist: 90 }); }
  { const el = place(h('div', 'chip', '<i></i>Werkvoorbereiding'), 110, 920); A(el, 12.4, 15, { in: 'left', inD: 0.4 }); }
  // ---- act 3: engineering (dark console on the right, product on the left)
  const skill = (t0, t1, k, title, p, lines, big) => {
    const head = place(h('div', 'act', `<div class="k">${k}</div><h1>${title}</h1><p>${p}</p>`), 110, 130, 760); A(head, t0, t1, { in: 'up', inD: 0.45, out: 'fade', outD: 0.25 });
    const con = place(h('div', 'console', `<div class="hd"><i></i><b>AI-skill</b> ${k}</div>` + lines.map(([cls, txt]) => `<div class="ln ${cls}">${txt}</div>`).join('') + (big ? `<div class="big2">${big}</div>` : '')), 1120, 250, 700); con.style.minHeight = '560px';
    const lns = [...con.querySelectorAll('.ln')]; const bg = con.querySelector('.big2');
    A(con, t0 + 0.15, t1, { in: 'left', inD: 0.45, inE: ease.outQuint, out: 'fade', outD: 0.25, update: (t, lt) => { lns.forEach((l, i) => { const k = ease.outQuint(seg(lt, 0.5 + i * 0.42, 0.75 + i * 0.42)); l.style.opacity = k; l.style.transform = `translateX(${(1 - k) * 24}px)`; }); if (bg) { const k = ease.outQuint(seg(lt, 0.5 + lns.length * 0.42 + 0.2, 0.9 + lns.length * 0.42)); bg.style.opacity = k; bg.style.transform = `translateY(${(1 - k) * 20}px)`; } } });
    return con;
  };
  skill(15.0, 22.5, 'Maakbaarheid', 'Kan dit<br>gemaakt worden?', 'De skill leest STEP en tekening en toetst het deel aan de zetregels van WILVO.', [
    ['ok', `buigradius R<sub>in</sub> = T <em>· 3,0 mm</em>`], ['ok', `flenshoogte ≥ 4·T <em>· 50 mm</em>`], ['ok', `gat tot zetlijn ≥ 3·T <em>· 30 mm</em>`], ['ok', `uitslag ${PRODUCT.uitslag} <em>· past op 3000 × 1500</em>`], ['ok', `snijranden loodrecht op het vlak`], ['bad', `hoekontlasting ontbreekt <em>· 4 hoeken</em>`]], 'Maakbaarheidsrapport');
  { const st = place(h('div', 'stamp', '1 bevinding'), 1480, 760); A(st, 19.4, 22.5, { in: 'slam', inD: 0.25, inE: ease.outExpo, out: 'fade', outD: 0.25 }); }
  skill(22.5, 28.0, '3D-model fixen', 'Het model<br>wordt gerepareerd', 'Ontlastingssneden erin, radius consistent. Het STEP-bestand gaat terug, klaar voor de laser.', [
    ['arrow', `ontlastingssnede 4,5 × 5,0 mm <em>· 4×</em>`], ['arrow', `buigradius gelijk <em>· R = T over het hele deel</em>`], ['ok', `geometrie gesloten · 1 solid`], ['ok', `behuizing-A-rev-C.step <em>· opgeslagen</em>`]], '2 wijzigingen');
  skill(28.0, 34.5, 'Werkvoorbereiding', 'De route<br>wordt voorspeld', 'Bewerkingen, volgorde en instructies komen uit het dossier, niet uit het hoofd.', [
    ['arrow', `lasersnijden <em>· BySpeed 3015 · O₂ · 5,2 m/min</em>`], ['arrow', `zetten <em>· 2 zettingen · V = 24</em>`], ['arrow', `lassen <em>· hoeklas 2× 230 mm · MAG</em>`], ['arrow', `inpersen <em>· 4× PEM M6</em>`], ['arrow', `montage <em>· 2 beugels op grondplaat</em>`], ['ok', `werkinstructies <em>· HTML · 6 stappen</em>`]], 'Route + instructies');
  { const r = place(h('div', 'route', ['Laser', 'Zetten', 'Lassen', 'Inpersen', 'Kwaliteit', 'Montage', 'Expeditie'].map((s, i) => `<span><b>${i + 1}</b>&nbsp;${s}</span>`).join('')), 110, 900); A(r, 30.6, 34.5, { in: 'fade', inD: 0.2, update: stagger(r, 0.16, 0, 24) }); }
  // hub
  { const head = place(h('div', 'act', `<div class="k">Engineering Hub</div><h1>Wat wil je<br>maken?</h1><p>Eén plek voor werkvoorbereiding en kwaliteit, in de browser, zonder installatie.</p>`), 110, 130, 760); A(head, 34.5, 40.5, { in: 'up', inD: 0.45, out: 'fade', outD: 0.25 }); }
  { const tiles = [['Werkvoorbereiding', 'Inspection Plan Generator', 'Gevalideerde kenmerken, exact de 18 kolommen die Epicor verwacht.'], ['Werkvoorbereiding', 'Tekening uitlezen', 'Maten en toleranties uit de tekening, klaar als regels.'], ['Werkvoorbereiding', 'Instructiemaker', 'Verpakkingsinstructie met lagen, foto’s en stuklijst.'], ['Werkvoorbereiding', 'Montage-instructie', 'STEP in, onderdelenlijst en stappen eruit.'], ['Hulpmiddel', '3D-viewer', 'STEP-bestanden in 3D, ook met handbediening.'], ['Hulpmiddel', 'Epicor issues', 'De issuelijst voor Epicor en WiCam, gedeeld.'], ['Hulpmiddel', 'Digital twin', 'Melkweg 1 in 3D: afdelingen, machines, processen.'], ['Hulpmiddel', 'BOM Generator', 'Stuklijsten uit het model.']];
    const g = place(h('div', 'tiles', tiles.map(([k, n, p], i) => `<div class="tile"><div class="n">${i + 1}</div><div class="kk">${k}</div><h3>${n}</h3><p>${p}</p></div>`).join('')), 110, 440, 1700);
    const kids = [...g.children];
    A(g, 34.8, 40.5, { in: 'fade', inD: 0.1, update: (t, lt) => { kids.forEach((c, i) => { const k = ease.outBack(seg(lt, i * 0.11, i * 0.11 + 0.4)); c.style.opacity = Math.min(1, k * 2); c.style.transform = `translateY(${(1 - k) * 60}px) scale(${0.9 + 0.1 * k})`; c.classList.toggle('on', lt > 2.2 + i * 0.12); }); } });
  }
  // klaar
  { const el = place(h('div', 'big', 'Klaar voor productie'), 110, 420); el.style.fontSize = '170px'; A(el, 40.5, 42.0, { in: 'slam', inD: 0.25, inE: ease.outExpo, out: 'none', outD: 0.01 }); }
  { const el = place(h('div', 'redbar', ''), 0, 1000); el.style.height = '14px'; A(el, 40.5, 42.0, { in: 'fade', inD: 0.01, out: 'none', outD: 0.01, update: (t, lt) => { el.style.width = (1920 * ease.io(lt / 1.5)) + 'px'; } }); }
  // ---- act 4: production HUD
  const depts = [['Lasersnijden', 'Bystronic BySpeed 3015 · CO₂-laser', '#9dbb61', 44.0, 49.0], ['Zetten', 'Bystronic Xpert · 200 ton', '#f0954a', 49.0, 54.0], ['Lassen', 'OTC DR4200L · lasrobot', '#d0675d', 54.0, 58.5], ['Inpersen', 'Haeger 824-D · PEM M6', '#f2cf63', 58.5, 62.0], ['Kwaliteit', 'Brown & Sharpe · 3D-meetmachine', '#8f5bc4', 62.0, 66.0], ['Montage', 'Zwenkkraan 500 kg · werkgebied D', '#ffc93c', 66.0, 71.0], ['Expeditie', 'Inpandig laaddock · dock 2', '#8b9298', 71.0, 76.0]];
  depts.forEach(([n, m, c, t0, t1], i) => { const el = place(h('div', 'hud', `<div class="zone" style="background:${c}"></div><div class="step">${i + 1}<small>/7</small></div><div class="dept"><div class="name">${n}</div><div class="mach">${m}</div></div>`), 110, 0); el.style.top = ''; el.style.bottom = '110px'; A(el, t0, t1, { in: 'up', inD: 0.3, inE: ease.outExpo, out: 'fade', outD: 0.15, dist: 60 }); });
  { const el = place(h('div', 'progress', '<i></i>'), 110, 0); el.style.top = ''; const bar = el.firstChild; A(el, 44, 76, { in: 'fade', inD: 0.3, update: t => { bar.style.width = (100 * seg(t, 44, 76)) + '%'; } }); }
  { const el = place(h('div', 'big white', 'Productie'), 110, 760); el.style.textShadow = '0 10px 50px rgba(0,0,0,0.35)'; A(el, 42.0, 44.0, { in: 'slam', inD: 0.25, inE: ease.outExpo, out: 'fade', outD: 0.2 }); }
  // corner readouts during the close-ups
  const corner = (t0, t1, k, v) => { const el = place(h('div', 'corner', `<div class="k">${k}</div><div class="v">${v}</div>`), 0, 110); el.style.left = ''; el.style.right = '110px'; A(el, t0, t1, { in: 'down', inD: 0.3, out: 'fade', outD: 0.15 }); };
  corner(44.0, 49.0, 'Snijden', 'S235 · 3,0 mm · O₂ 1,3 bar<br>5,2 m/min · 49 platen / 8 u');
  corner(49.0, 54.0, 'Zetten', 'V = 24 mm · R<sub>in</sub> = 3,0 mm<br>2 zettingen · 1 gereedschapset');
  corner(54.0, 58.5, 'Lassen', 'MAG · hoeklas a3<br>2 × 230 mm · 1 opspanning');
  corner(58.5, 62.0, 'Inpersen', 'PEM M6 · 4 stuks<br>inperskracht 12 kN');
  corner(62.0, 66.0, 'Meten', 'inspectieplan · 10 kenmerken<br>uit de tekening gelezen');
  corner(66.0, 71.0, 'Montage', '2 beugels · grondplaat · 4 bouten<br>instructie · 6 stappen');
  corner(71.0, 76.0, 'Expeditie', 'SO-26-04812 · 250 stuks<br>geleverd');
  // inspection micro-table (quality)
  { const rows = [['Lengte buitenzijde', '240,00', '0,20', '0,20', 'Schuifmaat'], ['Breedte', '160,00', '0,10', '0,10', 'Schuifmaat'], ['Flenshoogte', '50,00', '0,20', '0,20', 'Schuifmaat'], ['Gat Ø6,5', '6,50', '0,05', '0,05', 'CMM'], ['Hartafstand gaten', '170,00', '0,10', '0,10', 'CMM'], ['Haaksheid flens', '90,0°', '0,5°', '0,5°', 'Gradenboog'], ['Vlakheid', '0,30', '', '', 'CMM']];
    const el = place(h('div', 'table', `<div class="tr th"><div>#</div><div>Kenmerk</div><div>Nominaal</div><div>+ Tol</div><div>− Tol</div><div>Status</div></div>` + rows.map((r, i) => `<div class="tr"><div>${i + 1}</div><div>${r[0]}</div><div>${r[1]}</div><div>${r[2]}</div><div>${r[3]}</div><div class="ok">·</div></div>`).join('')), 1080, 300, 740);
    const trs = [...el.querySelectorAll('.tr:not(.th)')];
    A(el, 62.6, 66.0, { in: 'left', inD: 0.4, out: 'fade', outD: 0.15, update: (t, lt) => trs.forEach((tr, i) => { const on = lt > 0.5 + i * 0.32; tr.classList.toggle('lit', on); tr.lastElementChild.textContent = on ? 'Klaar ✓' : '·'; }) });
  }
  // ---- act 5: finale
  { const bd = place(h('div', 'backdrop', ''), 0, 640); bd.style.width = '1920px'; bd.style.height = '440px'; bd.style.background = 'linear-gradient(180deg, rgba(239,243,246,0) 0%, rgba(239,243,246,0.92) 45%, rgba(239,243,246,0.97) 100%)'; A(bd, 76.2, 82.0, { in: 'fade', inD: 0.6, out: 'fade', outD: 0.2 }); }
  { const stats = [[7, 'afdelingen'], [83, 'machines in het model'], [8, 'generatoren'], [3, 'AI-skills'], [1, 'digital twin']]; const el = place(h('div', 'stats', stats.map(([n, l]) => `<div class="stat"><div class="v">0</div><div class="l">${l}</div></div>`).join('')), 110, 790); const vs = [...el.querySelectorAll('.v')]; const fns = vs.map((v, i) => counter(v, stats[i][0], 1.4, '', 0.1 + i * 0.12)); A(el, 76.4, 82.0, { in: 'up', inD: 0.5, out: 'fade', outD: 0.2, update: (t, lt) => fns.forEach(f => f(t, lt)) }); }
  { const el = place(h('div', 'k', 'Van order tot levering · Melkweg 1'), 110, 740); A(el, 76.4, 82.0, { in: 'fade', inD: 0.4 }); }
  { const el = place(h('div', '', `<img class="logo" src="wilvo-logo.svg" alt="WILVO">`), 650, 300, 620); A(el, 82.0, 90, { in: 'slam', inD: 0.35, inE: ease.outExpo, out: 'fade', outD: 1.0 }); }
  { const el = place(h('div', 'tag', ''), 0, 640); el.style.width = '1920px'; el.style.textAlign = 'center'; A(el, 82.6, 90, { in: 'fade', inD: 0.2, out: 'fade', outD: 1.0, update: (t, lt) => { const s = 'think. make. organize. you win.'; const n = Math.floor(clamp(lt / 1.3) * s.length); el.innerHTML = s.slice(0, n).replace('you win.', '<b>you win.</b>'); } }); }
  { const el = place(h('div', '', `<div class="k" style="text-align:center">Engineering Hub</div><div class="sub" style="text-align:center;margin-top:14px">Wat wil je maken?</div>`), 0, 760); el.style.width = '1920px'; A(el, 86.0, 90, { in: 'up', inD: 0.5, out: 'fade', outD: 1.0 }); }
}
buildOverlay();

// ---------------------------------------------------------------- shots
// each shot: [t0, t1, scene, camFn(lt, t) -> {pos,target,fov}]
const S = [];
const shot = (t0, t1, scene, cam, fx) => S.push({ t0, t1, scene, cam, fx });
const hero = [0, 0.03, 0];
// act 1 (hook cuts)
shot(0.0, 0.9, 'none', () => orbit(0, 0, 1, [0, 0, 0]));
shot(0.9, 2.07, 'studio', lt => orbitT(lt / 1.17, [30, 22, 0.55, hero, 30], [60, 28, 0.5, hero, 30]));   // wireframe part
shot(2.07, 3.24, 'hall', lt => hallCam([-40 + lt * 20, -70, 55], [100, 60, 0], 30));                    // twin from above
shot(3.24, 4.41, 'studio', lt => orbitT(lt / 1.17, [-20, 20, 0.5, hero, 30], [-40, 18, 0.42, hero, 30])); // laser sparks
shot(4.41, 5.6, 'studio', lt => orbitT(lt / 1.19, [150, 24, 0.45, hero, 30], [180, 20, 0.4, hero, 30]));  // weld flash
shot(5.6, 7.5, 'none', () => orbit(0, 0, 1, [0, 0, 0]));
// act 2: exterior from the south-west, push in; then dive to the office wing
shot(7.5, 12.4, 'hall', lt => { const k = ease.io(lt / 4.9); return hallCam([lerp(-110, -60, k), lerp(-120, -70, k), lerp(42, 30, k)], [lerp(70, 60, k), lerp(50, 45, k), 4], 30); });
shot(12.4, 15.0, 'hall', lt => { const k = ease.io(lt / 2.6); return hallCam([lerp(-60, -5, k), lerp(-70, 2, k), lerp(30, 20, k)], [lerp(60, 16, k), lerp(45, 35, k), lerp(4, 2, k)], lerp(30, 34, k)); });
// act 3: studio product on the left of frame (target shifted so the part sits left)
const left = [0.02, 0.02, -0.12];
shot(15.0, 22.5, 'studio', lt => orbitT(lt / 7.5, [35, 26, 0.62, left, 30], [55, 22, 0.56, left, 30], ease.lin));
shot(22.5, 28.0, 'studio', lt => orbitT(lt / 5.5, [120, 20, 0.5, left, 30], [85, 28, 0.56, left, 30], ease.lin));
shot(28.0, 34.5, 'hall', lt => { const k = ease.io(lt / 6.5); return hallCam([lerp(40, 60, k), lerp(-60, -50, k), lerp(150, 165, k)], [lerp(90, 110, k), lerp(60, 70, k), 0], lerp(30, 28, k)); });
shot(34.5, 40.5, 'none', () => orbit(0, 0, 1, [0, 0, 0]));
shot(40.5, 42.0, 'none', () => orbit(0, 0, 1, [0, 0, 0]));
// act 4
shot(42.0, 44.0, 'hall', lt => { const k = ease.io(lt / 2); return hallCam([lerp(-30, -5, k), lerp(-90, -10, k), lerp(70, 40, k)], [lerp(90, 40, k), lerp(60, 48, k), 1], lerp(30, 36, k)); });
const dept = (t0, t1, from, to) => shot(t0, t1, 'hall', lt => { const k = ease.io(lt / (t1 - t0)); const A = deptView(from), B = deptView(to); return { pos: mix(A.pos, B.pos, k), target: mix(A.target, B.target, k), fov: lerp(A.fov, B.fov, k) }; });
const part = [0, 0.02, 0];
shot(44.0, 45.3, 'studio', lt => { const m = machines.laser; const c = m ? [0, m.size.y * 0.35, 0] : part; const d = m ? m.size.x * 0.95 : 1; return orbitT(lt / 1.3, [28, 16, d, c, 28], [22, 14, d * 0.9, c, 28], ease.lin); });
shot(45.3, 47.2, 'studio', lt => orbitT(lt / 1.9, [-25, 56, 0.9, [0.08, 0.0, 0.04], 30], [-12, 52, 0.8, [0.08, 0.0, 0.04], 30], ease.lin));
dept(47.2, 49.0, 'laser', 'zett');
shot(49.0, 50.2, 'studio', lt => { const m = machines.brake; const c = m ? [0, m.size.y * 0.4, 0] : part; const d = m ? m.size.x * 1.0 : 1; return orbitT(lt / 1.2, [34, 14, d, c, 28], [40, 12, d * 0.92, c, 28], ease.lin); });
shot(50.2, 52.2, 'studio', lt => orbitT(lt / 2.0, [112, 24, 0.78, [0, 0.03, 0], 30], [100, 26, 0.7, [0, 0.03, 0], 30], ease.lin));
dept(52.2, 54.0, 'zett', 'lasse');
shot(54.0, 55.1, 'studio', lt => { const m = machines.robot; const c = m ? [0, m.size.y * 0.4, 0] : part; const d = m ? Math.max(m.size.x, m.size.z) * 1.05 : 1; return orbitT(lt / 1.1, [-35, 20, d, c, 28], [-25, 18, d * 0.92, c, 28], ease.lin); });
shot(55.1, 57.0, 'studio', lt => orbitT(lt / 1.9, [200, 26, 0.5, part, 30], [215, 22, 0.44, part, 30], ease.lin));
dept(57.0, 58.5, 'lasse', 'inper');
shot(58.5, 59.3, 'studio', lt => { const m = machines.press; const c = m ? [0, m.size.y * 0.45, 0] : part; const d = m ? m.size.y * 1.6 : 1; return orbitT(lt / 0.8, [50, 11, d, c, 28], [44, 10, d * 0.95, c, 28], ease.lin); });
shot(59.3, 60.8, 'studio', lt => orbitT(lt / 1.5, [30, 40, 0.5, part, 30], [20, 36, 0.46, part, 30], ease.lin));
dept(60.8, 62.0, 'inper', 'kwali');
shot(62.0, 62.9, 'studio', lt => { const m = machines.cmm; const c = m ? [0, m.size.y * 0.45, 0] : part; const d = m ? m.size.y * 1.5 : 1; return orbitT(lt / 0.9, [40, 14, d, c, 28], [34, 13, d * 0.95, c, 28], ease.lin); });
shot(62.9, 64.6, 'studio', lt => orbitT(lt / 1.7, [40, 30, 0.6, left, 30], [50, 28, 0.56, left, 30], ease.lin));
dept(64.6, 66.0, 'kwali', 'monta');
shot(66.0, 67.2, 'studio', lt => { const m = machines.crane; const c = m ? [0, m.size.y * 0.42, 0] : part; const d = m ? Math.max(m.size.x, m.size.y, m.size.z) * 2.1 : 1; return orbitT(lt / 1.2, [110, 7, d, c, 26], [125, 9, d * 0.95, c, 26], ease.lin); });
shot(67.2, 69.4, 'studio', lt => orbitT(lt / 2.2, [40, 18, 1.0, [0, 0.07, 0], 30], [25, 16, 0.85, [0, 0.07, 0], 30], ease.lin));
dept(69.4, 71.0, 'monta', 'verze');
shot(71.0, 73.0, 'studio', lt => orbitT(lt / 2.0, [30, 22, 1.35, [0, 0.09, 0], 30], [45, 18, 1.2, [0, 0.09, 0], 30], ease.lin));
shot(73.0, 76.0, 'hall', lt => { const k = ease.io(lt / 3); return hallCam([lerp(120, 60, k), lerp(-40, -110, k), lerp(16, 60, k)], [lerp(153, 150, k), lerp(-8, 0, k), 2], lerp(36, 30, k)); });
// act 5
shot(76.0, 82.0, 'hall', lt => { const k = lt / 6; return hallCam([lerp(-90, -70, k), lerp(-150, -140, k), lerp(90, 100, k)], [lerp(100, 105, k), lerp(60, 62, k), 0], 30); });
shot(82.0, 90.0, 'none', () => orbit(0, 0, 1, [0, 0, 0]));

function shotAt(t) { for (const s of S) if (t >= s.t0 && t < s.t1) return s; return S[S.length - 1]; }

// ---------------------------------------------------------------- state per time
let studioMachine = null;
function setState(t) {
  const s = product.state; for (const k in s) s[k] = 0; s.relief = 1; s.scanY = -1; s.cut = 0;
  tools.brake.visible = tools.torch.visible = tools.ram.visible = tools.stylus.visible = false;
  product.group.position.set(0, 0, 0); product.group.rotation.set(0, 0, 0); product.group.visible = true; rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0);
  studioMachine = null; studio.userData.floor.visible = true;
  let laserWindow = [-1, -1], weldWindow = [-1, -1]; let arc = 0;
  world.pallet.visible = false; world.truck.visible = false;
  let routeP = 0, zone = null, zoneK = 0, roofLift = 0, roofFade = 0;
  // ---- hook
  if (t < 0.9) { product.group.visible = false; }
  else if (t < 2.07) { s.wire = 1; s.bend1 = s.bend2 = 1; }
  else if (t < 4.41) { if (t >= 3.24) { s.sheet = 1; s.cut = seg(t, 3.24, 4.41) * 0.6 + 0.2; laserWindow = [3.24, 4.41]; } }
  else if (t < 5.6) { s.bend1 = s.bend2 = 1; s.weld = seg(t, 4.41, 5.6); weldWindow = [4.41, 5.4]; arc = 1; }
  // ---- engineering
  else if (t < 22.5) { s.bend1 = s.bend2 = 1; const lt = t - 15; s.wire = 1 - ease.io(seg(lt, 0, 0.8)); const sc = (lt - 0.8) / 2.2; s.scanY = lt > 0.8 && lt < 5.2 ? ((sc % 1) - 0.5) : -1; s.relief = 0; s.flaw = seg(lt, 4.3, 4.6); }
  else if (t < 28.0) { s.bend1 = s.bend2 = 1; const lt = t - 22.5; s.flaw = 1 - seg(lt, 2.0, 3.2); s.relief = seg(lt, 1.9, 2.9); }
  else if (t < 42.0) { product.group.visible = t < 28.0; routeP = t >= 30.5 ? ease.io(seg(t, 30.5, 33.8)) : 0; roofLift = 34 * ease.io(seg(t, 28.0, 30.0)); roofFade = ease.io(seg(t, 28.6, 30.4)); if (t > 34.5) { roofLift = 0; roofFade = 0; routeP = 0; } }
  // ---- production
  else {
    roofLift = 34 * ease.io(seg(t, 42.0, 43.6)); roofFade = ease.io(seg(t, 42.4, 43.8));
    const SU = k => world.stationU(k);
    const hop = (t0, t1, a, b) => { const k = ease.io(seg(t, t0, t1)); return lerp(SU(a), SU(b), k); };
    let u = SU('laser');
    if (t < 44.0) { u = lerp(SU('plmag'), SU('laser'), ease.io(seg(t, 42.6, 44))); zone = 'laser'; zoneK = seg(t, 43, 44); }
    else if (t < 49.0) { zone = 'laser'; zoneK = 1; u = hop(47.2, 49.0, 'laser', 'zett'); if (t >= 49 - 1.8) { zone = 'zett'; zoneK = seg(t, 48.2, 49); } }
    else if (t < 54.0) { zone = 'zett'; zoneK = 1; u = hop(52.2, 54.0, 'zett', 'lasse'); if (t >= 53.2) { zone = 'lasse'; zoneK = seg(t, 53.2, 54); } }
    else if (t < 58.5) { zone = 'lasse'; zoneK = 1; u = hop(57.0, 58.5, 'lasse', 'inper'); if (t >= 57.8) { zone = 'inper'; zoneK = seg(t, 57.8, 58.5); } }
    else if (t < 62.0) { zone = 'inper'; zoneK = 1; u = hop(60.8, 62.0, 'inper', 'kwali'); if (t >= 61.4) { zone = 'kwali'; zoneK = seg(t, 61.4, 62); } }
    else if (t < 66.0) { zone = 'kwali'; zoneK = 1; u = hop(64.6, 66.0, 'kwali', 'monta'); if (t >= 65.3) { zone = 'monta'; zoneK = seg(t, 65.3, 66); } }
    else if (t < 71.0) { zone = 'monta'; zoneK = 1; u = hop(69.4, 71.0, 'monta', 'verze'); if (t >= 70.3) { zone = 'verze'; zoneK = seg(t, 70.3, 71); } }
    else if (t < 76.0) { zone = 'verze'; zoneK = 1 - seg(t, 73.5, 75); u = lerp(SU('verze'), SU('dock'), ease.io(seg(t, 73.0, 74.2))); world.setTruck(seg(t, 73.4, 76.0), t >= 73.4); }
    else { u = 1; routeP = 1; roofLift = 34 * (1 - ease.io(seg(t, 77.5, 80.5))); roofFade = 1 - ease.io(seg(t, 77.0, 80.0)); }
    routeP = Math.max(routeP, Math.min(1, u + 0.004)); if (t >= 76) routeP = 1;
    world.setPallet(u, t >= 42.6 && t < 74.2);
    // product per step (studio)
    if (t >= 44.0 && t < 49.0) { studioMachine = t < 45.3 ? 'laser' : null; s.sheet = 1; s.cut = ease.lin(seg(t, 45.4, 47.0)) * 1.0; laserWindow = [45.4, 47.0]; product.group.rotation.y = 0.2; }
    else if (t >= 49.0 && t < 54.0) { studioMachine = t < 50.2 ? 'brake' : null; tools.brake.visible = studioMachine === null;
      // press brake: punch down -> both legs rise symmetrically about the bend line; punch up -> part settles flat
      const press = (t0) => ({ down: seg(t, t0, t0 + 0.6), up: seg(t, t0 + 0.75, t0 + 1.05) });
      const p1 = press(50.3), p2 = press(51.8);
      s.bend1 = p1.down; s.bend2 = p2.down;
      const cur = t < 51.55 ? p1 : p2; const side = t < 51.55 ? -1 : 1;
      product.group.position.set(0, 0, -side * BW / 2);           // bend line on the origin
      rig.rotation.x = side * (Math.PI / 4) * ease.io(cur.down) * (1 - ease.io(cur.up));
      rig.position.y = 0.004 - 0.014 * ease.io(cur.down) * (1 - ease.io(cur.up));
      const shift = ease.io(seg(t, 51.3, 51.7)); product.group.position.z = -side * BW / 2 + (t < 51.55 ? 0 : 0) ; if (t >= 51.3 && t < 51.55) product.group.position.z = BW / 2 - BW * shift;
      tools.punchGroup.position.y = 0.2 - 0.19 * ease.io(cur.down) * (1 - ease.io(cur.up)); }
    else if (t >= 54.0 && t < 58.5) { studioMachine = t < 55.1 ? 'robot' : null; s.bend1 = s.bend2 = 1; s.weld = seg(t, 55.2, 57.0); weldWindow = [55.2, 57.0]; arc = hold(t, 55.2, 57.0, 0.1); tools.torch.visible = studioMachine === null; s.weldCool = seg(t, 57.0, 58.5); }
    else if (t >= 58.5 && t < 62.0) { studioMachine = t < 59.3 ? 'press' : null; s.bend1 = s.bend2 = 1; s.weld = 1; s.weldCool = 1; s.inserts = [59.2, 59.6, 60.0, 60.4].reduce((a, tt, i) => a + seg(t, tt, tt + 0.25) / 4, 0); tools.ram.visible = studioMachine === null; }
    else if (t >= 62.0 && t < 66.0) { studioMachine = t < 62.9 ? 'cmm' : null; s.bend1 = s.bend2 = 1; s.weld = 1; s.weldCool = 1; s.inserts = 1; tools.stylus.visible = studioMachine === null; }
    else if (t >= 66.0 && t < 71.0) { studioMachine = t < 67.2 ? 'crane' : null; s.bend1 = s.bend2 = 1; s.weld = 1; s.weldCool = 1; s.inserts = 1; s.base = 1; s.explode = 1 - seg(t, 67.4, 68.0); s.assemble = seg(t, 67.8, 69.0); product.group.position.y = PT; }
    else if (t >= 71.0 && t < 76.0) { s.bend1 = s.bend2 = 1; s.weld = 1; s.weldCool = 1; s.inserts = 1; s.base = 1; s.assemble = 1; s.box = seg(t, 71.2, 71.9); s.boxLid = seg(t, 72.0, 72.5); product.group.position.y = PT; }
  }
  // apply
  product.apply(t);
  showMachine(studioMachine);
  if (studioMachine) product.group.visible = false;
  // laser head sparks follow the cut
  product.sparks.emit = tt => product.cutPoint(product.state.cut > 0 ? clamp((tt - laserWindow[0]) / (laserWindow[1] - laserWindow[0])) : 0).clone();
  product.sparks.update(t, laserWindow[0], laserWindow[1], 0.6);
  product.weldSparks.emit = tt => { const k = clamp((tt - weldWindow[0]) / (weldWindow[1] - weldWindow[0])); return new THREE.Vector3(-(BL / 2) + BL * k, PT + 0.002, BW / 2 - 0.002); };
  product.weldSparks.update(t, weldWindow[0], weldWindow[1], 0.5);
  if (tools.torch.visible || arc > 0) { const k = clamp((t - weldWindow[0]) / (weldWindow[1] - weldWindow[0])); tools.torch.position.set(-(BL / 2) + BL * k, PT + 0.004, BW / 2 + 0.004); }
  product.arc.intensity = arc > 0 ? 0.012 * (0.6 + 0.4 * hash(Math.floor(t * 90))) : 0; product.arc.position.copy(tools.torch.position).add(new THREE.Vector3(0, 0.01, 0));
  if (tools.ram.visible) { const i = Math.min(3, Math.floor(seg(t, 59.2, 60.8) * 4)); const [x, z] = product.webHoles[i]; const tt = [59.2, 59.6, 60.0, 60.4][i]; const k = hold(t, tt - 0.25, tt + 0.3, 0.2); tools.ram.position.set(x, 0.12 - 0.095 * k, z); }
  if (tools.stylus.visible) { const pts = [[-0.1, 0.012, -0.06], [0.1, 0.012, -0.06], [0.1, 0.012, 0.06], [-0.1, 0.012, 0.06], [0.0, 0.05, 0.08]]; const tms = [62.8, 63.3, 63.8, 64.2, 64.5]; let i = 0; for (let j = 0; j < tms.length; j++) if (t >= tms[j] - 0.4) i = j; const p = pts[i], prev = pts[Math.max(0, i - 1)]; const k = ease.io(seg(t, tms[i] - 0.4, tms[i])); tools.stylus.position.set(lerp(prev[0], p[0], k), lerp(prev[1], p[1], k) + 0.03 * Math.sin(Math.PI * k), lerp(prev[2], p[2], k)); }
  // hall
  world.setRoof(roofLift, roofFade); world.routeMat.uniforms.progress.value = routeP; world.setZoneFocus(zone, zoneK);
  for (const [k, ring] of Object.entries(world.markers)) { const su = world.stationU(k); const lit = routeP >= su - 0.002 ? 1 : 0; ring.material.opacity = lit * (0.5 + 0.3 * Math.sin(t * 5)); ring.scale.setScalar(lit ? 1 + 0.15 * Math.sin(t * 5) : 1); }
  world.update(t);
  // screen effects
  flashK = Math.max(hold(t, 5.6, 5.9, 0.1) * 0.9, hold(t, 42.0, 42.25, 0.08) * 0.8, hold(t, 82.0, 82.2, 0.06) * 0.7, arc * 0.05 * hash(Math.floor(t * 60)));
  blackK = t < 0.9 ? 1 - seg(t, 0.75, 0.9) : (t >= 34.5 && t < 42 ? 0 : 0) + (t >= 89 ? seg(t, 89, 90) : 0);
  if (t >= 0.9 && t < 5.6) blackK = 0; if (t < 0.75) blackK = 1;
  paperK = (t >= 5.6 && t < 7.5) ? 1 - seg(t, 7.2, 7.5) : (t >= 34.5 && t < 42.0) ? 1 : (t >= 82.0) ? 1 : 0;
  lboxK = (t >= 42 && t < 76) ? 1 : 0;
}

// ---------------------------------------------------------------- render one frame at time t
function applyCam(c) { camera.position.set(...c.pos); camera.lookAt(...c.target); camera.fov = c.fov; camera.updateProjectionMatrix(); }
export function seek(t) {
  t = clamp(t, 0, DURATION);
  setState(t);
  const sh = shotAt(t); const lt = t - sh.t0; const c = sh.cam(lt, t);
  applyCam(c);
  ov.update(t);
  flash.style.opacity = flashK; black.style.opacity = blackK; paper.style.opacity = paperK; lbox.style.borderTopWidth = lbox.style.borderBottomWidth = (lboxK * 70) + 'px';
  if (sh.scene === 'none') { renderer.setClearColor('#06080b', 1); renderer.clear(); paper.style.opacity = Math.max(paperK, t >= 34.5 && t < 42 ? 1 : 0); if (t < 0.9 || t >= 89.5) { black.style.opacity = Math.max(blackK, 1); } }
  else {
    const scene = sh.scene === 'hall' ? world.scene : studio; renderPass.scene = scene;
    if (sh.scene === 'studio') { const key = studio.userData.key; key.position.set(camera.position.x * 0.3 + 2, Math.max(1.5, camera.position.y + 3), camera.position.z * 0.3 + 3); key.target.position.set(0, 0, 0); const m = studioMachine ? machines[studioMachine] : null; const sz = m ? Math.max(m.size.x, m.size.y, m.size.z) : 0.5; key.shadow.camera.left = key.shadow.camera.bottom = -sz; key.shadow.camera.right = key.shadow.camera.top = sz; key.shadow.camera.updateProjectionMatrix(); bloom.strength = 0.35; }
    else { bloom.strength = 0.2; }
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

window.__trailer = { seek, DURATION, ready: true, sfxCues, Score, play, machines: Object.keys(machines) };
if (!CAPTURE) {
  const start = parseFloat(Q.get('t') || '0') || 0;
  seek(start);
  const hint = h('div', 'hint', 'klik of spatie: afspelen / pauze · ← → : 5 s'); document.getElementById('stage').appendChild(hint);
  const toggle = () => { if (playing) { playing = false; t0 = t0 + (performance.now() - tStart) / 1000; if (audioCtx) audioCtx.suspend(); } else { if (audioCtx) audioCtx.resume(); play(t0 >= DURATION ? 0 : t0); } };
  addEventListener('click', toggle); addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle(); } if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { const was = playing; playing = false; t0 = clamp((was ? t0 + (performance.now() - tStart) / 1000 : t0) + (e.code === 'ArrowRight' ? 5 : -5), 0, DURATION); seek(t0); if (was) play(t0); } });
  if (Q.has('autoplay')) play(start);
  loop();
}
