// The real product: WILVO draaiplateau (DRAAIPLATEAU.STP, HiCAD): two aluminium plates 600 × 600 × 6, a sawn
// middenas Ø20 × 27 welded a1 to the bottom plate, 16 nokjes (20 × 8 × 31) welded in slots, 8 bearings Ø22 × 7 on
// M8 × 30 screws with nuts, and one countersunk M10 × 40 through the top plate. Geometry comes from the STEP
// (assets/draaiplateau.glb, millimetres, z up); the state object drives every step of the production.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, lerp, ease, hash } from './util.js';
import { Sparks } from './product.js';

const MM = 0.001;
// STEP mm (x, y, z-up) -> scene metres (x, up, z), centred on the plate
export const P = (x, y, z) => new THREE.Vector3((x - 300) * MM, z * MM, -(y - 300) * MM);

export class Draaiplateau {
  constructor(env) {
    this.env = env; this.group = new THREE.Group(); this.root = new THREE.Group(); this.group.add(this.root);
    this.alu = new THREE.MeshPhysicalMaterial({ color: '#c6c9cd', metalness: 0.55, roughness: 0.6, envMap: env, envMapIntensity: 0.7 });
    this.dark = new THREE.MeshPhysicalMaterial({ color: '#2d3236', metalness: 0.9, roughness: 0.4, envMap: env });
    this.blue = new THREE.MeshPhysicalMaterial({ color: '#1c3f80', metalness: 0.8, roughness: 0.4, envMap: env });
    this.wireMat = new THREE.LineBasicMaterial({ color: '#1f6fd6', transparent: true, opacity: 0 });
    this.state = { wire: 0, show: 1, sheet: 0, cut: 0, tube: 0, saw: 0, nok: 0, mid: 1, flip: 0, weldRing: 0, weldNok: 0, weldCool: 0, bearings: 0, screws: 0, nuts: 0, top: 1, topY: 0, bolt: 1, boltY: 0, carton: 0, cartonLid: 0, flaw: 0, scanY: -1 };
    this.parts = { bearings: [], screws: [], nuts: [], nokjes: [] };
    this.buildTools();
  }
  async load(url) {
    const g = await new GLTFLoader().loadAsync(url);
    const byIndex = {}; g.scene.traverse(o => { if (o.isMesh) { const m = o.name.match(/#(\d+)$/); if (m) byIndex[+m[1]] = o; } });
    const take = (i, mat) => { const o = byIndex[i]; o.material = mat; o.castShadow = o.receiveShadow = true; o.geometry.computeBoundingBox(); return o; };
    // convert mm z-up into metres y-up, centred
    const conv = new THREE.Group(); conv.scale.setScalar(MM); conv.rotation.x = -Math.PI / 2; conv.position.set(-0.3, 0, 0.3);
    const wrap = (o) => { const w = new THREE.Group(); w.add(o); conv.add(w); return w; };
    this.bottom = wrap(take(0, this.alu)); this.top = wrap(take(1, this.alu)); this.bolt10 = wrap(take(2, this.dark)); this.mid = wrap(take(3, this.alu));
    for (const i of [4, 5, 6, 7, 8, 9, 10, 18]) this.parts.bearings.push(wrap(take(i, this.alu)));
    for (let i = 19; i <= 26; i++) this.parts.screws.push(wrap(take(i, this.dark)));
    for (let i = 27; i <= 42; i++) this.parts.nokjes.push(wrap(take(i, this.alu)));
    for (let i = 44; i <= 51; i++) this.parts.nuts.push(wrap(take(i, this.blue)));
    for (const i of [11, 12, 13, 14, 15, 16, 17, 43]) byIndex[i].visible = false; // duplicates in the STEP
    this.rig = new THREE.Group(); this.rig.add(conv); this.root.add(this.rig);
    // the pivot for flipping the plate lies on the top face of the plate (z = 6 mm) in the centre
    this.rig.position.set(0, 0, 0);
    // wire outlines for the STEP look
    [this.bottom, this.top].forEach(w => { const m = w.children[0]; const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), this.wireMat); m.add(l); });
    this.parts.nokjes.forEach(w => { const m = w.children[0]; m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), this.wireMat)); });
    // rest positions in mm for the moving parts (bbox centres from the STEP)
    const centre = o => { const b = o.geometry.boundingBox; return b.getCenter(new THREE.Vector3()); };
    this.rest = { bearings: this.parts.bearings.map(w => centre(w.children[0])), screws: this.parts.screws.map(w => centre(w.children[0])), nuts: this.parts.nuts.map(w => centre(w.children[0])), nokjes: this.parts.nokjes.map(w => centre(w.children[0])) };
    // screw axis per screw: along x if the bbox is long in x
    this.screwAxis = this.parts.screws.map(w => { const b = w.children[0].geometry.boundingBox; const s = b.getSize(new THREE.Vector3()); return s.x > s.y ? new THREE.Vector3(Math.sign(300 - b.min.x) * -1 * (b.min.x < 300 ? -1 : 1), 0, 0) : new THREE.Vector3(0, b.min.y < 300 ? -1 : 1, 0); });
    // assembly order: start at the holder pair the camera looks at (nokje 0), then go round
    const c0 = this.rest.nokjes[0]; const rank = list => { const d = list.map((c, i) => [Math.hypot(c.x - c0.x, c.y - c0.y), i]).sort((a, b) => a[0] - b[0]); const o = []; d.forEach(([, i], r) => { o[i] = r; }); return o; };
    this.order = { bearings: rank(this.rest.bearings), screws: rank(this.rest.screws), nuts: rank(this.rest.nuts) };
    this.buildEffects();
    return this;
  }
  buildEffects() {
    // weld beads: ring around the middenas (a1) and 16 small rings around the nok slots on the underside
    this.weldMat = new THREE.MeshBasicMaterial({ color: '#ff6a3c', toneMapped: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.0112, 0.0014, 8, 48, 0), this.weldMat); this.ring.rotation.x = Math.PI / 2; this.ring.position.set(0, 0.0062, 0); this.ring.visible = false; this.root.add(this.ring);
    this.nokWelds = this.rest.nokjes.map(c => { const g = new THREE.Group(); const long = Math.abs(c.x - 300) > Math.abs(c.y - 300) ? 'x' : 'y'; // slot orientation
      const bead = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0012, 6, 24), this.weldMat); bead.rotation.x = Math.PI / 2; bead.scale.set(1.2, 0.55, 1); const diag = Math.abs(Math.abs(c.x - 300) - Math.abs(c.y - 300)) < 60; bead.rotation.z = diag ? (c.x - 300) * (c.y - 300) > 0 ? -Math.PI / 4 : Math.PI / 4 : (long === 'x' ? Math.PI / 2 : 0); g.add(bead);
      g.position.copy(P(c.x, c.y, -0.3)); g.visible = false; this.root.add(g); return g; });
    this.sparks = new Sparks(220, 0.4, '#ffb347', 0.02); this.root.add(this.sparks.points);
    this.weldSparks = new Sparks(160, 0.3, '#ffe9b0', 0.014); this.weldSparks.spread = 0.5; this.weldSparks.up = 0.4; this.root.add(this.weldSparks.points);
    this.arc = new THREE.PointLight('#cfe8ff', 0, 0.3, 2); this.root.add(this.arc);
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshBasicMaterial({ color: '#4fb8ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); this.scan.rotation.x = -Math.PI / 2; this.root.add(this.scan);
    this.marks = this.rest.nokjes.slice(0, 4).map(c => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.002, 8, 32), new THREE.MeshBasicMaterial({ color: '#e0262e', transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.rotation.x = Math.PI / 2; m.position.copy(P(c.x, c.y, 34)); this.root.add(m); return m; });
    // ---- laser: the aluminium sheet with the two plates nested, kerf lines per contour
    this.sheet = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.006, 0.75), this.alu.clone()); this.sheet.material.color.set('#b9bdc1'); this.sheet.position.set(0, 0.003 - 0.0006, 0); this.sheet.receiveShadow = true; this.sheet.visible = false; this.root.add(this.sheet);
    const rr = (cx, cz, w, h, r, n = 8) => { const pts = []; const cs = [[cx + w / 2 - r, cz + h / 2 - r, 0], [cx - w / 2 + r, cz + h / 2 - r, Math.PI / 2], [cx - w / 2 + r, cz - h / 2 + r, Math.PI], [cx + w / 2 - r, cz - h / 2 + r, 3 * Math.PI / 2]]; for (const [x, z, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([x + r * Math.cos(a), z + r * Math.sin(a)]); } return pts; };
    const circ = (cx, cz, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cz + r * Math.sin(i / n * Math.PI * 2)]);
    const nest = []; const L = -0.36, R = 0.36; // plate centres on the sheet
    nest.push(circ(L, 0, 0.0042)); // tapgat M10 bottom plate
    this.rest.nokjes.forEach(c => { const dx = (c.x - 300) * MM, dz = -(c.y - 300) * MM; const b = this.parts.nokjes[0].children[0].geometry.boundingBox; nest.push(circ(L + dx, dz, 0.0045, 12)); });
    nest.push(rr(L, 0, 0.6, 0.6, 0.03));
    nest.push(circ(R, 0, 0.0053)); nest.push(rr(R, 0, 0.6, 0.6, 0.03));
    this.nest = nest; this.cutLen = []; this.cutGeo = []; let total = 0;
    for (const poly of nest) { const Pp = [...poly, poly[0]]; let len = 0; for (let i = 1; i < Pp.length; i++) len += Math.hypot(Pp[i][0] - Pp[i - 1][0], Pp[i][1] - Pp[i - 1][1]); this.cutLen.push(len); total += len; const curve = new THREE.CatmullRomCurve3(Pp.map(([x, z]) => new THREE.Vector3(x, 0.0064, z)), false, 'catmullrom', 0); const n = Math.max(8, Math.round(len / 0.006)); const tube = new THREE.TubeGeometry(curve, n, 0.0012, 6, false); const m = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: '#2a2d30' })); m.visible = false; this.root.add(m); this.cutGeo.push({ m, curve, count: tube.index.count }); }
    this.cutTotal = total;
    this.headGlow = new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff1c0', toneMapped: false })); this.headGlow.visible = false; this.root.add(this.headGlow);
    // ---- saw: a long Ø20 tube and the cut-off piece
    const tubeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.6, 32, 1, true); const tubeIn = new THREE.CylinderGeometry(0.0084, 0.0084, 0.6, 32, 1, true);
    this.tube = new THREE.Group(); const t1 = new THREE.Mesh(tubeGeo, this.alu); const t2 = new THREE.Mesh(tubeIn, new THREE.MeshStandardMaterial({ color: '#8a8f94', side: THREE.BackSide })); this.tube.add(t1, t2); this.tube.rotation.z = Math.PI / 2; this.tube.position.set(-0.3135, 0.05, 0); this.tube.visible = false; this.tube.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.root.add(this.tube);
    this.piece = new THREE.Group(); const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.027, 32, 1, true), this.alu); const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0084, 0.0084, 0.027, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#8a8f94', side: THREE.BackSide })); this.piece.add(p1, p2); this.piece.rotation.z = Math.PI / 2; this.piece.position.set(0.0135, 0.05, 0); this.piece.visible = false; this.piece.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.root.add(this.piece);
    this.sawSparks = new Sparks(180, 0.3, '#ffd080', 0.014); this.sawSparks.spread = 0.8; this.sawSparks.up = 0.3; this.root.add(this.sawSparks.points);
    // ---- carton
    this.carton = new THREE.Group(); const card = new THREE.MeshStandardMaterial({ color: '#c99d6b', roughness: 0.95, side: THREE.DoubleSide }); const cw = 0.7, ch = 0.12, cd = 0.7, ct = 0.005;
    [[0, ch / 2, cd / 2, new THREE.BoxGeometry(cw, ch, ct)], [0, ch / 2, -cd / 2, new THREE.BoxGeometry(cw, ch, ct)], [cw / 2, ch / 2, 0, new THREE.BoxGeometry(ct, ch, cd)], [-cw / 2, ch / 2, 0, new THREE.BoxGeometry(ct, ch, cd)], [0, ct / 2, 0, new THREE.BoxGeometry(cw, ct, cd)]].forEach(([x, y, z, geo]) => { const w = new THREE.Mesh(geo, card); w.position.set(x, y, z); w.castShadow = w.receiveShadow = true; this.carton.add(w); });
    this.cartonLids = [1, -1].map(s => { const pv = new THREE.Group(); pv.position.set(0, ch, s * cd / 2); const f = new THREE.Mesh(new THREE.BoxGeometry(cw, ct, cd / 2), card); f.position.z = -s * cd / 4; f.castShadow = true; pv.add(f); this.carton.add(pv); return [pv, s]; });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.09), new THREE.MeshBasicMaterial({ color: '#ffffff' })); label.position.set(0.18, 0.065, cd / 2 + ct); this.carton.add(label);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.014), new THREE.MeshBasicMaterial({ color: '#e0262e' })); stripe.position.set(0.18, 0.1, cd / 2 + ct + 0.0005); this.carton.add(stripe);
    this.carton.visible = false; this.group.add(this.carton);
  }
  buildTools() {
    const env = this.env; const steel = new THREE.MeshPhysicalMaterial({ color: '#9ea4aa', metalness: 0.7, roughness: 0.4, envMap: env });
    this.tools = new THREE.Group();
    // laser head
    this.head = new THREE.Group(); const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.007, 0.03, 20), new THREE.MeshPhysicalMaterial({ color: '#c58a4d', metalness: 1, roughness: 0.3, envMap: env })); noz.position.y = 0.015; this.head.add(noz);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.06, 24), new THREE.MeshPhysicalMaterial({ color: '#dfe2e4', metalness: 0.3, roughness: 0.35, envMap: env })); hb.position.y = 0.06; this.head.add(hb);
    const hb2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.036), new THREE.MeshPhysicalMaterial({ color: '#0d57a3', metalness: 0.2, roughness: 0.45, envMap: env })); hb2.position.y = 0.115; this.head.add(hb2);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.016, 8), new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false })); beam.position.y = -0.006; this.head.add(beam);
    this.head.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.head.visible = false; this.tools.add(this.head);
    // TIG torch
    this.torch = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#4a5056', roughness: 0.55 })); body.position.y = 0.075; this.torch.add(body);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.006, 0.025, 16), new THREE.MeshPhysicalMaterial({ color: '#e0b0a0', metalness: 0.1, roughness: 0.5, envMap: env })); cup.position.y = 0.012; this.torch.add(cup);
    const el = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.012, 8), new THREE.MeshStandardMaterial({ color: '#888' })); el.position.y = -0.002; this.torch.add(el); this.torch.visible = false; this.tools.add(this.torch);
    // circular saw blade
    this.blade = new THREE.Group(); const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.0025, 64), new THREE.MeshPhysicalMaterial({ color: '#d2d6da', metalness: 0.6, roughness: 0.45, envMap: env })); disc.rotation.z = Math.PI / 2; this.blade.add(disc);
    const teeth = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.0032, 4, 64), new THREE.MeshPhysicalMaterial({ color: '#8f959b', metalness: 0.7, roughness: 0.45, envMap: env })); teeth.rotation.y = Math.PI / 2; this.blade.add(teeth);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 32), new THREE.MeshPhysicalMaterial({ color: '#e0262e', metalness: 0.3, roughness: 0.5, envMap: env })); hub.rotation.z = Math.PI / 2; this.blade.add(hub);
    this.blade.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.blade.visible = false; this.tools.add(this.blade);
    // hex key
    this.key = new THREE.Group(); const k1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 6), steel); k1.position.y = 0.045; this.key.add(k1); const k2 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 6), steel); k2.rotation.z = Math.PI / 2; k2.position.set(0.02, 0.09, 0); this.key.add(k2); this.key.visible = false; this.tools.add(this.key);
    // wrench for the nuts: a simple open-end spanner
    this.spanner = new THREE.Group(); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.004, 0.014), steel); sp.position.x = 0.07; this.spanner.add(sp); const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.004, 8, 24, Math.PI * 1.4), steel); jaw.rotation.x = Math.PI / 2; jaw.rotation.z = Math.PI * 0.8; this.spanner.add(jaw); this.spanner.visible = false; this.tools.add(this.spanner);
  }
  cutPoint(k) { let d = clamp(k) * this.cutTotal; for (let i = 0; i < this.nest.length; i++) { if (d <= this.cutLen[i] || i === this.nest.length - 1) return this.cutGeo[i].curve.getPointAt(clamp(d / this.cutLen[i], 0, 0.9999)); d -= this.cutLen[i]; } return new THREE.Vector3(); }

  apply(t) {
    const s = this.state; const R = this.rest;
    this.rig.visible = s.show > 0.5 && s.sheet < 0.5 && s.tube < 0.5; this.rig.rotation.x = Math.PI * ease.io(clamp(s.flip)); this.rig.position.y = 0.037 * ease.io(clamp(s.flip)); // flipped: resting on the 31 mm nokjes
    this.wireMat.opacity = clamp(s.wire); const solid = s.wire < 0.999; [this.bottom, this.top].forEach(w => w.children[0].material.visible = solid); this.parts.nokjes.forEach(w => w.children[0].material.visible = solid);
    this.alu.visible = solid; this.dark.visible = solid; this.blue.visible = solid;
    // nokjes drop into their slots, middenas placed
    this.parts.nokjes.forEach((w, i) => { const k = clamp(s.nok * 1.6 - i * 0.04); w.visible = k > 0; w.position.set(0, 0, 50 * (1 - ease.in(k))); });
    this.mid.visible = s.mid > 0.001; this.mid.position.set(0, 0, 40 * (1 - ease.in(clamp(s.mid))));
    // welds
    const wr = clamp(s.weldRing); this.ring.visible = wr > 0.001; this.ring.geometry = this.ring.geometry; this.ring.scale.set(1, 1, 1); this.ring.rotation.z = 0; this.ring.geometry.dispose && null; if (!this._ringGeos) { this._ringGeos = Array.from({ length: 49 }, (_, i) => new THREE.TorusGeometry(0.0112, 0.0014, 8, 48, Math.PI * 2 * Math.max(0.02, i / 48))); } this.ring.geometry = this._ringGeos[Math.round(wr * 48)];
    this.ring.material.color.lerpColors(new THREE.Color('#ff6a3c'), new THREE.Color('#9aa0a5'), clamp(s.weldCool));
    this.nokWelds.forEach((g, i) => { g.visible = s.weldNok * 16 - i > 0.001; });
    this.marks.forEach(m => { m.material.opacity = clamp(s.flaw) * (0.65 + 0.35 * Math.sin(t * 14)); });
    // assembly
    this.parts.bearings.forEach((w, i) => { const k = clamp(s.bearings * 8 - this.order.bearings[i]); w.visible = k > 0; w.position.set(0, 0, 60 * (1 - ease.in(k))); });
    this.parts.screws.forEach((w, i) => { const k = clamp(s.screws * 8 - this.order.screws[i]); w.visible = k > 0; const a = this.screwAxis[i]; w.position.copy(a.clone().multiplyScalar(-70 * (1 - ease.io(k)))); });
    this.parts.nuts.forEach((w, i) => { const k = clamp(s.nuts * 8 - this.order.nuts[i]); w.visible = k > 0; const a = this.screwAxis[i]; w.position.copy(a.clone().multiplyScalar(40 * (1 - ease.io(k)))); });
    this.top.visible = s.top > 0.001; this.top.position.set(0, 0, 180 * clamp(s.topY));
    this.bolt10.visible = s.bolt > 0.001; this.bolt10.position.set(0, 0, 80 * clamp(s.boltY));
    this.scan.material.opacity = s.scanY > -0.5 && s.scanY < 0.5 ? 0.3 : 0; this.scan.position.y = (s.scanY + 0.5) * 0.06;
    // laser
    this.sheet.visible = s.sheet > 0.5; const ck = clamp(s.cut); let d = ck * this.cutTotal;
    this.cutGeo.forEach((cg, i) => { const L = this.cutLen[i]; const k = clamp(d / L); cg.m.visible = s.sheet > 0.5 && k > 0; cg.m.geometry.setDrawRange(0, Math.floor(cg.count * k)); d -= L; });
    this.headGlow.visible = s.sheet > 0.5 && ck > 0 && ck < 1; if (this.headGlow.visible) this.headGlow.position.copy(this.cutPoint(ck));
    // saw
    this.tube.visible = s.tube > 0.5; this.piece.visible = s.tube > 0.5 && s.saw >= 1; this.piece.position.set(0.0135 + 0.03 * clamp(s.saw - 1), 0.05 - 0.02 * clamp(s.saw - 1), 0.02 * clamp(s.saw - 1));
    // carton
    this.carton.visible = s.carton > 0.001; this.carton.scale.setScalar(Math.max(0.001, ease.outBack(clamp(s.carton)))); this.cartonLids.forEach(([pv, sd]) => { pv.rotation.x = sd * (Math.PI / 2 + 0.3) * (1 - ease.io(clamp(s.cartonLid))); });
  }
  // world-space position (in root coordinates) of a nokje slot centre, honouring the flip
  nokPos(i, z = 0) { const c = this.rest.nokjes[i]; const p = P(c.x, c.y, z); if (this.state.flip > 0.5) { p.y = this.rig.position.y - p.y; p.z = -p.z; } return p; }
}
