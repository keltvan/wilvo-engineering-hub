// The factory: the digital twin's geometry (exported from the twin, unchanged) restyled for film.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, lerp, ease, hash, seg } from './util.js';

export const CX = 105, CY = 72;
// plan coordinates (metres, x east, y north) -> scene (x, up, z)
export const W = (x, y, h = 0) => new THREE.Vector3(x - CX, h, CY - y);
export const Wa = ([x, y, h = 0]) => W(x, y, h);

const pointIn = (pt, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const centroid = p => { let a = 0, cx = 0, cy = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length], f = p[i][0] * q[1] - q[0] * p[i][1]; a += f; cx += (p[i][0] + q[0]) * f; cy += (p[i][1] + q[1]) * f; } a *= 0.5; return [cx / (6 * a), cy / (6 * a)]; };

export const ZONE_ORDER = ['laser', 'zett', 'lasse', 'inper', 'kwali', 'monta', 'verze'];

export class World {
  constructor(renderer, env) {
    this.renderer = renderer; this.env = env;
    this.scene = new THREE.Scene();
    { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#a9bccb'); gr.addColorStop(0.55, '#d8e2e8'); gr.addColorStop(1, '#eef2f4'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; this.scene.background = tx; }
    this.scene.fog = new THREE.Fog('#dde5ea', 380, 900);
    this.scene.environment = env;
    this.groups = {}; this.zoneMeshes = {}; this.zoneMats = {}; this.roofMats = []; this.fadeMats = [];
    this.light();
  }

  light() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight('#f4f7ff', '#8f8a80', 0.55); s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff6e8', 1.7); this.sun.position.set(-120, 180, 110); this.sun.castShadow = true;
    const sh = this.sun.shadow; sh.mapSize.set(3072, 3072); sh.camera.near = 20; sh.camera.far = 600; sh.camera.left = -220; sh.camera.right = 220; sh.camera.top = 220; sh.camera.bottom = -220; sh.bias = -0.0006; sh.normalBias = 0.6; sh.radius = 2;
    s.add(this.sun); s.add(this.sun.target);
    this.fill = new THREE.DirectionalLight('#dfe9ff', 0.3); this.fill.position.set(150, 90, -160); s.add(this.fill);
  }

  async load(data) {
    this.data = data;
    const L = new GLTFLoader();
    const names = ['site', 'bld', 'canopyGroup', 'doorGroup', 'shrubGroup', 'garageGroup', 'neighGroup', 'l2', 'l3', 'inrG', 'wpG'];
    const gl = await Promise.all(names.map(n => L.loadAsync(`./models/${n}.glb`)));
    gl.forEach((g, i) => { const root = g.scene; root.name = names[i]; this.groups[names[i]] = root; this.scene.add(root); });
    this.restyle();
    this.classifyZones();
    this.buildFloor();
    this.buildRoute();
    this.buildPallet();
    this.buildTruck();
    this.roof = this.groups.bld.getObjectByName('roofGroup');
    this.roof.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; this.roofMats.push(o.material); } });
    this.roofY = 0;
    return this;
  }

  restyle() {
    const kill = [];
    const dark = new THREE.Color('#2a2f34');
    for (const [name, g] of Object.entries(this.groups)) {
      g.traverse(o => {
        if (o.isLine || o.isLineSegments || o.isPoints) { kill.push(o); return; }
        if (!o.isMesh) return;
        const m = o.material;
        if (m.transparent && m.opacity < 0.02) { kill.push(o); return; }
        if (m.type === 'MeshBasicMaterial' && m.opacity >= 0.99 && name !== 'bld') { kill.push(o); return; } // pick helpers
        o.castShadow = name !== 'site' && name !== 'neighGroup'; o.receiveShadow = true;
        if (m.isMeshStandardMaterial) { m.envMapIntensity = 0.35; if (m.roughness > 0.85) m.roughness = 0.82; if (m.map) m.map.anisotropy = 8; }
        if (name === 'neighGroup') { o.material = new THREE.MeshStandardMaterial({ color: '#e3e7ea', roughness: 0.95, transparent: true, opacity: 0.85 }); o.castShadow = false; }
        if (name === 'l2' && m.transparent && m.opacity < 0.95 && m.color.getHex() === 0x9fc6d8) { m.opacity = 0.35; } // glazing bands
        if (m.isMeshStandardMaterial && m.transparent && m.opacity >= 0.45 && m.opacity < 0.95) { this.fadeMats.push(m); }
      });
    }
    kill.forEach(o => o.parent && o.parent.remove(o));
    // the dashed work-place outlines (wcG) are not finished everywhere: hide the whole helper group
    const wc = this.groups.l2.getObjectByName('wcG'); if (wc) wc.visible = false;
  }

  classifyZones() {
    const zones = this.data.zones; const bb = new THREE.Box3(), c = new THREE.Vector3();
    zones.forEach(z => { this.zoneMeshes[z.id] = []; });
    this.groups.l2.traverse(o => {
      if (!o.isMesh) return; bb.setFromObject(o); if (bb.max.y - bb.min.y > 0.08 || bb.max.y > 0.6) return; bb.getCenter(c);
      const px = c.x + CX, py = CY - c.z;
      const z = zones.find(z => (z.p || []).some(poly => pointIn([px, py], poly)));
      if (!z) return;
      const m = new THREE.MeshStandardMaterial({ color: z.c, roughness: 0.95, transparent: true, opacity: 0.18, depthWrite: false }); m.userData.zone = z.id;
      o.material = m; o.renderOrder = 2; this.zoneMeshes[z.id].push(o); (this.zoneMats[z.id] = this.zoneMats[z.id] || []).push(m);
    });
    this.zoneC = {}; zones.forEach(z => { if (z.p && z.p.length) { const big = z.p.map(p => [p, Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0))]).sort((a, b) => b[1] - a[1])[0][0]; this.zoneC[z.id] = centroid(big); } });
  }
  setZoneFocus(id, k) { for (const [zid, mats] of Object.entries(this.zoneMats)) { const on = zid === id ? k : 0; mats.forEach(m => { m.opacity = 0.16 + 0.5 * on; m.emissive.set(m.color); m.emissiveIntensity = 0.25 * on; }); } }

  buildFloor() {
    // one clean concrete slab under the whole hall, plus a soft ground plane far out
    const s = new THREE.Shape(this.data.pand.map(([x, y]) => new THREE.Vector2(x - CX, -(CY - y))));
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.translate(0, 0.012, 0); // after rotate, shape y -> -z, so we pre-negated
    const floor = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#e6e8ea', roughness: 0.92, metalness: 0 })); floor.receiveShadow = true; floor.renderOrder = 1; this.scene.add(floor); this.floor = floor;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: '#cfd6c9', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.3; ground.receiveShadow = true; this.scene.add(ground);
  }

  // the production route through the departments, drawn on the floor; progress 0..1 reveals it
  buildRoute() {
    const d = this.data; const zc = this.zoneC;
    const M = n => { const m = d.machines.find(m => String(m.n) === String(n)); return [m.x, m.y]; };
    const ZS = n => { const z = d.zetm.find(z => String(z[0]) === String(n)); return [z[1], z[2]]; };
    this.stations = {
      plmag: zc.plmag, laser: M(7), zett: ZS(29), lasse: M(12), inper: [zc.inper[0], zc.inper[1]], kwali: M(64), monta: [168, 126], verze: [138, 20], dock: [153.3, -4],
    };
    const pts = ['plmag', 'laser', 'zett', 'lasse', 'inper', 'kwali', 'monta', 'verze', 'dock'].map(k => W(this.stations[k][0], this.stations[k][1], 0.08));
    // smooth the path a little, keep it on the floor
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35); this.routeCurve = curve;
    const N = 400; const ribbon = []; const uvs = []; const idx = [];
    const w = 0.55;
    for (let i = 0; i <= N; i++) { const u = i / N; const p = curve.getPointAt(u); const tg = curve.getTangentAt(u); const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(w); ribbon.push(p.x - n.x, 0.09, p.z - n.z, p.x + n.x, 0.09, p.z + n.z); uvs.push(u, 0, u, 1); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ribbon, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
    this.routeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { progress: { value: 0 }, time: { value: 0 }, color: { value: new THREE.Color('#e0262e') } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float progress; uniform float time; uniform vec3 color; varying vec2 vUv;
        void main(){ if (vUv.x > progress) discard; float edge = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y); float head = smoothstep(progress - 0.03, progress, vUv.x); float dash = 0.75 + 0.25 * sin((vUv.x * 240.0) - time * 6.0); float a = (0.55 * edge * dash + head * 0.9); gl_FragColor = vec4(color * (1.0 + head * 2.5), a); }` });
    this.routeMat.toneMapped = false;
    this.route = new THREE.Mesh(g, this.routeMat); this.route.renderOrder = 3; this.scene.add(this.route);
    // station markers (rings) that light up when reached
    this.markers = {};
    for (const [k, p] of Object.entries(this.stations)) { const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 40), new THREE.MeshBasicMaterial({ color: '#e0262e', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.position.copy(W(p[0], p[1], 0.1)); ring.renderOrder = 4; this.scene.add(ring); this.markers[k] = ring; }
  }
  // u of a station along the route (by nearest sample)
  stationU(k) { if (!this._su) { this._su = {}; const keys = Object.keys(this.stations); const pts = keys.map(q => W(this.stations[q][0], this.stations[q][1], 0.08)); for (const key of keys) { let best = 0, bd = 1e9; for (let i = 0; i <= 400; i++) { const d = this.routeCurve.getPointAt(i / 400).distanceTo(pts[keys.indexOf(key)]); if (d < bd) { bd = d; best = i / 400; } } this._su[key] = best; } } return this._su[k]; }

  buildPallet() {
    const g = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#c8a471', roughness: 0.9 });
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.1), wood); b.position.set(0, 0.1, -0.35 + i * 0.35); g.add(b); }
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.8), wood); b.position.set(-0.55 + i * 0.275, 0.17, 0); g.add(b); }
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.75), new THREE.MeshStandardMaterial({ color: '#4f6d8f', roughness: 0.6 })); crate.position.y = 0.46; g.add(crate);
    const part = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.34), new THREE.MeshStandardMaterial({ color: '#b9bec3', metalness: 0.8, roughness: 0.4 })); part.position.y = 0.76; g.add(part);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.pallet = g; g.visible = false; this.scene.add(g);
  }
  setPallet(u, visible = true) { this.pallet.visible = visible; if (!visible) return; const p = this.routeCurve.getPointAt(clamp(u)); const tg = this.routeCurve.getTangentAt(clamp(u)); this.pallet.position.set(p.x, 0, p.z); this.pallet.rotation.y = Math.atan2(tg.x, tg.z); }

  buildTruck() {
    const g = new THREE.Group(); const white = new THREE.MeshStandardMaterial({ color: '#f2f3f4', roughness: 0.45, metalness: 0.1 }); const red = new THREE.MeshStandardMaterial({ color: '#e0262e', roughness: 0.4, metalness: 0.2 }); const dark = new THREE.MeshStandardMaterial({ color: '#2a2f34', roughness: 0.7 });
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(13.6, 2.7, 2.55), white); trailer.position.set(-7.5, 2.45, 0); g.add(trailer);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(13.62, 0.35, 2.57), red); stripe.position.set(-7.5, 1.5, 0); g.add(stripe);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.9, 2.5), red); cab.position.set(1.0, 2.2, 0); g.add(cab);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 2.2), new THREE.MeshStandardMaterial({ color: '#8fc0d8', roughness: 0.1, metalness: 0.6 })); glass.position.set(2.2, 2.6, 0); g.add(glass);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 1.2), dark); chassis.position.set(-6, 0.85, 0); g.add(chassis);
    for (const [x, z] of [[1.2, 1.1], [1.2, -1.1], [-1.2, 1.1], [-1.2, -1.1], [-10, 1.1], [-10, -1.1], [-11.4, 1.1], [-11.4, -1.1], [-12.8, 1.1], [-12.8, -1.1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.35, 18), dark); w.rotation.x = Math.PI / 2; w.position.set(x, 0.52, z); g.add(w); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.truck = g; g.visible = false; this.scene.add(g);
  }
  // k 0..1: truck backs out of the dock (plan 153.3,-4 facing south) then drives east along the Melkweg
  setTruck(k, visible = true) {
    this.truck.visible = visible; if (!visible) return;
    const a = clamp(k / 0.35), b = clamp((k - 0.35) / 0.65);
    if (b <= 0) { const y = lerp(-4, -22, ease.io(a)); this.truck.position.copy(W(153.3, y, 0)); this.truck.rotation.y = Math.PI / 2; }
    else { const turn = clamp(b / 0.25); const x = 153.3 + ease.in(b) * 220 + b * 60; const y = -22 - 2 * (1 - turn); this.truck.position.copy(W(x, y, 0)); this.truck.rotation.y = lerp(Math.PI / 2, 0, ease.io(turn)); }
  }

  setRoof(lift, fade) { this.roof.position.y = lift; this.roofMats.forEach(m => { m.opacity = 1 - fade; m.transparent = true; }); this.roof.visible = fade < 0.999; }
  update(t) { this.routeMat.uniforms.time.value = t; }
}
