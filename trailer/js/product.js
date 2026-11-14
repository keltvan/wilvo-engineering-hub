// The product: a sheet-metal box (bak) in 3 mm S235 — base plate with four bent flanges, four welded corners,
// and a lid with four screws. Built to the plaatwerk rules (R_in = T, corner openings for the welds).
// Everything is driven by a state object, so one call to apply() sets the geometry for any moment in time.
import * as THREE from 'three';
import { clamp, lerp, ease, hash } from './util.js';

export const T = 0.003;
export const BL = 0.240, BW = 0.160, FH = 0.050;   // base plate and flange height (m)
const GAP = 0.0015;                                  // corner opening per side, closed by the weld
const LIP = 0.012;                                   // lid flange
export const PRODUCT = { T, BL, BW, FH, uitslag: `${Math.round((BL + 2 * FH) * 1000)} × ${Math.round((BW + 2 * FH) * 1000)} mm` };

function steelMaterial(env) { return new THREE.MeshPhysicalMaterial({ color: '#c3c7cb', metalness: 0.9, roughness: 0.4, envMap: env, envMapIntensity: 0.85, clearcoat: 0.1, clearcoatRoughness: 0.4 }); }

// plate in the XZ plane (thickness 0..T along +y) with round holes
function plate(w, d, holes = [], radius = 0.003) {
  const s = new THREE.Shape(); const x0 = -w / 2, z0 = -d / 2, r = radius;
  s.moveTo(x0 + r, z0); s.lineTo(x0 + w - r, z0); s.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r); s.lineTo(x0 + w, z0 + d - r); s.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d); s.lineTo(x0 + r, z0 + d); s.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r); s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
  for (const [hx, hz, hr] of holes) { const p = new THREE.Path(); p.absarc(hx, hz, hr, 0, Math.PI * 2, false); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 24 }); g.rotateX(Math.PI / 2); g.translate(0, T, 0); g.computeVertexNormals(); return g;
}
// flat pattern of a box: a cross. returns closed polygon [[x,z],...] (metres)
export function crossOutline(L, Wd, F, inset = 0) { const a = L / 2, b = Wd / 2, f = F; const g = GAP + inset; return [[-a + g, -b - f], [a - g, -b - f], [a - g, -b], [a + f, -b + g], [a + f, b - g], [a, b - g], [a - g, b], [a - g, b + f], [-a + g, b + f], [-a + g, b], [-a, b - g], [-a - f, b - g], [-a - f, -b + g], [-a, -b + g], [-a + g, -b]]; }

// deterministic spark cloud
export class Sparks {
  constructor(n = 240, life = 0.45, color = '#ffb347', size = 0.012) {
    this.n = n; this.life = life; this.emit = () => new THREE.Vector3(); this.spread = 0.6; this.up = 0.6; this.gravity = -2.5;
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(n * 3); this.alpha = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { color: { value: new THREE.Color(color) }, size: { value: size } },
      vertexShader: 'attribute float alpha; varying float vA; uniform float size; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 color; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = (1.0 - r * 2.0) * vA; gl_FragColor = vec4(color * (1.0 + vA * 2.0), a); }' });
    this.mat.toneMapped = false; this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.visible = false;
  }
  update(t, a, b, scale = 1) {
    const on = t >= a && t <= b + this.life; this.points.visible = on; if (!on) return;
    for (let i = 0; i < this.n; i++) {
      const ph = hash(i, 1) * this.life; const born = Math.floor((t - a - ph) / this.life) * this.life + ph + a; const age = t - born;
      if (born < a || born > b || age < 0) { this.alpha[i] = 0; continue; }
      const p = this.emit(born); const vx = (hash(i, 2) - 0.5) * this.spread, vz = (hash(i, 3) - 0.5) * this.spread, vy = hash(i, 4) * this.up + 0.15;
      this.pos[i * 3] = p.x + vx * age * scale; this.pos[i * 3 + 1] = p.y + (vy * age + 0.5 * this.gravity * age * age) * scale; this.pos[i * 3 + 2] = p.z + vz * age * scale;
      this.alpha[i] = Math.pow(1 - age / this.life, 1.5) * (0.5 + 0.5 * hash(i, 5));
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.alpha.needsUpdate = true;
  }
}

export class Product {
  constructor(env) {
    this.group = new THREE.Group(); this.env = env;
    this.mat = steelMaterial(env);
    this.darkMat = new THREE.MeshPhysicalMaterial({ color: '#6f767c', metalness: 0.9, roughness: 0.45, envMap: env });
    this.redMat = new THREE.MeshBasicMaterial({ color: '#e0262e', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    this.state = { bend: [0, 0, 0, 0], weld: [0, 0, 0, 0], weldCool: 0, flaw: 0, lidY: -1, screws: 0, wire: 0, scanY: -1, cut: 0, sheet: 0, carton: 0, cartonLid: 0, cartonY: 0 };
    this.build();
  }
  build() {
    const g = this.group; g.clear();
    const hx = BL / 2 - 0.035, hz = BW / 2 - 0.03; this.holes = [[-hx, -hz, 0.0033], [hx, -hz, 0.0033], [-hx, hz, 0.0033], [hx, hz, 0.0033]];
    // ---- base plate and four flanges (0: +z long, 1: -z long, 2: +x short, 3: -x short)
    this.body = new THREE.Group(); g.add(this.body);
    this.base = new THREE.Mesh(plate(BL, BW, this.holes), this.mat); this.base.castShadow = this.base.receiveShadow = true; this.body.add(this.base);
    this.wireMat = new THREE.LineBasicMaterial({ color: '#1f6fd6', transparent: true, opacity: 0 });
    this.body.add(new THREE.LineSegments(new THREE.EdgesGeometry(this.base.geometry, 20), this.wireMat));
    this.flanges = [];
    const defs = [[0, 0, BW / 2, BL - 2 * GAP, 0], [0, 0, -BW / 2, BL - 2 * GAP, Math.PI], [BL / 2, 0, 0, BW - 2 * GAP, -Math.PI / 2], [-BL / 2, 0, 0, BW - 2 * GAP, Math.PI / 2]];
    for (const [x, y, z, len, ry] of defs) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0, z); pivot.rotation.y = ry; this.body.add(pivot); // local +z points outward
      const pg = plate(len, FH); const m = new THREE.Mesh(pg, this.mat); m.position.z = FH / 2; m.castShadow = m.receiveShadow = true; pivot.add(m);
      const wl = new THREE.LineSegments(new THREE.EdgesGeometry(pg, 20), this.wireMat); wl.position.z = FH / 2; pivot.add(wl);
      this.flanges.push({ pivot, m });
    }
    // corner weld seams: vertical beads at the four corners, revealed top->bottom
    this.seams = []; const cs = [[BL / 2, BW / 2], [BL / 2, -BW / 2], [-BL / 2, -BW / 2], [-BL / 2, BW / 2]]; this.corners = cs;
    for (const [x, z] of cs) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, FH, 10), new THREE.MeshBasicMaterial({ color: '#ff6a3c', toneMapped: false })); s.position.set(x + Math.sign(x) * T * 0.3, T + FH / 2, z + Math.sign(z) * T * 0.3); s.visible = false; this.body.add(s); this.seams.push(s); const mark = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0015, 8, 32), this.redMat); mark.rotation.x = Math.PI / 2; mark.position.set(x, T, z); this.body.add(mark); (this.marks = this.marks || []).push(mark); }
    // ---- lid: plate with a lip down and four screws
    this.lid = new THREE.Group(); g.add(this.lid);
    const LW = BL + 2 * T + 0.002, LD = BW + 2 * T + 0.002; const sh = [[-LW / 2 + 0.02, -LD / 2 + 0.018, 0.0028], [LW / 2 - 0.02, -LD / 2 + 0.018, 0.0028], [-LW / 2 + 0.02, LD / 2 - 0.018, 0.0028], [LW / 2 - 0.02, LD / 2 - 0.018, 0.0028]];
    const lp = new THREE.Mesh(plate(LW, LD, sh), this.mat); lp.castShadow = lp.receiveShadow = true; this.lid.add(lp);
    for (const [x, z, len, ry] of [[0, LD / 2, LW, 0], [0, -LD / 2, LW, Math.PI], [LW / 2, 0, LD, -Math.PI / 2], [-LW / 2, 0, LD, Math.PI / 2]]) { const pv = new THREE.Group(); pv.position.set(x, 0, z); pv.rotation.y = ry; pv.rotation.x = Math.PI / 2; const f = new THREE.Mesh(plate(len - 2 * T, LIP), this.mat); f.position.z = LIP / 2; f.castShadow = true; pv.add(f); this.lid.add(pv); }
    this.screws = sh.map(([x, z]) => { const s = new THREE.Group(); const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 24), this.darkMat); head.position.y = 0.0015; s.add(head); const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.0008, 0.0012), new THREE.MeshBasicMaterial({ color: '#2a2f33' })); slot.position.y = 0.003; s.add(slot); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.012, 12), this.darkMat); shaft.position.y = -0.006; s.add(shaft); s.position.set(x, T, z); this.lid.add(s); return s; });
    // ---- laser: the sheet with the nest, cut lines per contour
    this.sheet = new THREE.Mesh(new THREE.BoxGeometry(0.82, T, 0.56), this.mat.clone()); this.sheet.material.color.set('#b4b9be'); this.sheet.position.set(0, T / 2, 0); this.sheet.receiveShadow = true; this.sheet.visible = false; g.add(this.sheet);
    this.nest = []; // contours: [[x,z]...] closed, in sheet coordinates
    const cross = crossOutline(BL, BW, FH); const lidOut = crossOutline(LW, LD, LIP, 0);
    const place = (poly, dx, dz) => poly.map(([x, z]) => [x + dx, z + dz]);
    const circ = (cx, cz, r, n = 24) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cz + r * Math.sin(i / n * Math.PI * 2)]);
    for (const [dx, dz] of [[-0.21, -0.14], [-0.21, 0.14]]) { this.holes.forEach(([x, z, r]) => this.nest.push(circ(x + dx, z + dz, r))); this.nest.push(place(cross, dx, dz)); }
    for (const [dx, dz] of [[0.2, -0.14], [0.2, 0.14]]) { sh.forEach(([x, z, r]) => this.nest.push(circ(x + dx, z + dz, r))); this.nest.push(place(lidOut, dx, dz)); }
    this.cutLen = []; let total = 0; this.cutGeo = [];
    for (const poly of this.nest) { const P = [...poly, poly[0]]; let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); this.cutLen.push(L); total += L; const curve = new THREE.CatmullRomCurve3(P.map(([x, z]) => new THREE.Vector3(x, T + 0.0004, z)), false, 'catmullrom', 0); const n = Math.max(8, Math.round(L / 0.004)); const tube = new THREE.TubeGeometry(curve, n, 0.0007, 6, false); const m = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: '#2a2d30' })); m.visible = false; g.add(m); this.cutGeo.push({ m, curve, count: tube.index.count }); }
    this.cutTotal = total;
    this.headGlow = new THREE.Mesh(new THREE.SphereGeometry(0.003, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff1c0', toneMapped: false })); this.headGlow.visible = false; g.add(this.headGlow);
    this.sparks = new Sparks(220, 0.4, '#ffb347', 0.02); g.add(this.sparks.points);
    this.weldSparks = new Sparks(160, 0.3, '#ffe9b0', 0.014); this.weldSparks.spread = 0.5; this.weldSparks.up = 0.4; g.add(this.weldSparks.points);
    this.arc = new THREE.PointLight('#cfe8ff', 0, 0.3, 2); g.add(this.arc);
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshBasicMaterial({ color: '#4fb8ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); this.scan.rotation.x = -Math.PI / 2; g.add(this.scan);
    // ---- carton (expedition): open box the product is lowered into
    this.carton = new THREE.Group(); const card = new THREE.MeshStandardMaterial({ color: '#c99d6b', roughness: 0.95, side: THREE.DoubleSide }); const cw = 0.34, ch = 0.16, cd = 0.26, ct = 0.004;
    const wallZ = new THREE.BoxGeometry(cw, ch, ct), wallX = new THREE.BoxGeometry(ct, ch, cd);
    [[0, ch / 2, cd / 2, wallZ], [0, ch / 2, -cd / 2, wallZ], [cw / 2, ch / 2, 0, wallX], [-cw / 2, ch / 2, 0, wallX]].forEach(([x, y, z, geo]) => { const w = new THREE.Mesh(geo, card); w.position.set(x, y, z); w.castShadow = w.receiveShadow = true; this.carton.add(w); });
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(cw, ct, cd), card); bottom.position.y = ct / 2; this.carton.add(bottom);
    this.cartonLids = [[1, cd], [-1, cd]].map(([s]) => { const pv = new THREE.Group(); pv.position.set(0, ch, s * cd / 2); const f = new THREE.Mesh(new THREE.BoxGeometry(cw, ct, cd / 2), card); f.position.z = -s * cd / 4; f.castShadow = true; pv.add(f); this.carton.add(pv); return [pv, s]; });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.065), new THREE.MeshBasicMaterial({ color: '#ffffff' })); label.position.set(0.09, 0.085, cd / 2 + ct); this.carton.add(label);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.011), new THREE.MeshBasicMaterial({ color: '#e0262e' })); stripe.position.set(0.09, 0.111, cd / 2 + ct + 0.0005); this.carton.add(stripe);
    this.carton.visible = false; g.add(this.carton);
    this.apply(0);
  }
  cornerTop(i) { const [x, z] = this.corners[i]; return new THREE.Vector3(x, T + FH, z); }
  // position along the full nest at progress k (0..1): returns {p, contour}
  cutPoint(k) { let d = clamp(k) * this.cutTotal; for (let i = 0; i < this.nest.length; i++) { if (d <= this.cutLen[i] || i === this.nest.length - 1) { const u = clamp(d / this.cutLen[i], 0, 0.9999); return { p: this.cutGeo[i].curve.getPointAt(u), i, u }; } d -= this.cutLen[i]; } return { p: new THREE.Vector3(), i: 0, u: 0 }; }

  apply(t = 0) {
    const s = this.state;
    this.flanges.forEach((f, i) => { f.pivot.rotation.x = -ease.io(clamp(s.bend[i])) * Math.PI / 2; });
    this.seams.forEach((seam, i) => { const k = clamp(s.weld[i]); seam.visible = k > 0.001; seam.scale.y = Math.max(0.001, k); seam.position.y = T + FH - FH * k / 2; seam.material.color.lerpColors(new THREE.Color('#ff6a3c'), new THREE.Color('#5d666d'), clamp(s.weldCool)); });
    this.marks.forEach(m => { m.visible = s.flaw > 0.01; m.material.opacity = clamp(s.flaw) * (0.65 + 0.35 * Math.sin(t * 14)); });
    this.lid.visible = s.lidY > -0.5; this.lid.position.y = FH + T + Math.max(0, s.lidY);
    this.screws.forEach((sc, i) => { const k = clamp(s.screws * 4 - i); sc.visible = k > 0; sc.position.y = T + 0.03 * (1 - ease.in(k)); sc.rotation.y = k * Math.PI * 3; });
    this.wireMat.opacity = clamp(s.wire); this.base.visible = s.wire < 0.999; this.flanges.forEach(f => { f.m.visible = s.wire < 0.999; });
    this.scan.material.opacity = s.scanY > -0.5 && s.scanY < 0.5 ? 0.35 : 0; this.scan.position.y = (s.scanY + 0.5) * 0.09 - 0.01;
    this.body.visible = s.sheet < 0.5; this.sheet.visible = s.sheet > 0.5;
    const ck = clamp(s.cut); let d = ck * this.cutTotal;
    this.cutGeo.forEach((cg, i) => { const L = this.cutLen[i]; const k = clamp(d / L); cg.m.visible = s.sheet > 0.5 && k > 0; cg.m.geometry.setDrawRange(0, Math.floor(cg.count * k)); d -= L; });
    this.headGlow.visible = s.sheet > 0.5 && ck > 0 && ck < 1; if (this.headGlow.visible) this.headGlow.position.copy(this.cutPoint(ck).p);
    this.carton.visible = s.carton > 0.001; this.carton.scale.setScalar(Math.max(0.001, ease.outBack(clamp(s.carton)))); this.cartonLids.forEach(([pv, sd]) => { pv.rotation.x = sd * (Math.PI / 2 + 0.3) * (1 - ease.io(clamp(s.cartonLid))); });
  }
}

// tools that act on the product in the close-ups
export class Tools {
  constructor(env) {
    this.group = new THREE.Group();
    const steel = new THREE.MeshPhysicalMaterial({ color: '#9ea4aa', metalness: 0.7, roughness: 0.4, envMap: env });
    const toolSteel = new THREE.MeshPhysicalMaterial({ color: '#848b92', metalness: 0.75, roughness: 0.38, envMap: env });
    const blue = new THREE.MeshPhysicalMaterial({ color: '#2d6db5', metalness: 0.2, roughness: 0.45, envMap: env });
    const LEN = 0.3;
    // press brake: V-die as an extruded profile (real V notch), punch as an extruded blade with a 30° tip
    const dieShape = new THREE.Shape(); const V = 0.024, DH = 0.05, DW = 0.08, depth = V / 2 / Math.tan(Math.PI / 4 * 0.9);
    dieShape.moveTo(-DW / 2, -DH); dieShape.lineTo(DW / 2, -DH); dieShape.lineTo(DW / 2, 0); dieShape.lineTo(V / 2, 0); dieShape.lineTo(0, -depth); dieShape.lineTo(-V / 2, 0); dieShape.lineTo(-DW / 2, 0); dieShape.closePath();
    const dieGeo = new THREE.ExtrudeGeometry(dieShape, { depth: LEN, bevelEnabled: false }); dieGeo.rotateY(Math.PI / 2); dieGeo.translate(-LEN / 2, 0, 0); dieGeo.computeVertexNormals();
    this.die = new THREE.Mesh(dieGeo, toolSteel); this.die.position.y = -0.0005; this.die.castShadow = this.die.receiveShadow = true;
    const pShape = new THREE.Shape(); pShape.moveTo(0, 0); pShape.lineTo(0.009, 0.02); pShape.lineTo(0.009, 0.06); pShape.lineTo(-0.009, 0.06); pShape.lineTo(-0.009, 0.02); pShape.closePath();
    const pGeo = new THREE.ExtrudeGeometry(pShape, { depth: LEN, bevelEnabled: false }); pGeo.rotateY(Math.PI / 2); pGeo.translate(-LEN / 2, 0, 0); pGeo.computeVertexNormals();
    this.punch = new THREE.Mesh(pGeo, toolSteel); this.punch.castShadow = true;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.045, 0.03), blue); beam.position.y = 0.082; beam.castShadow = true;
    this.punchGroup = new THREE.Group(); this.punchGroup.add(this.punch, beam); this.punchGroup.position.y = 0.15;
    this.brake = new THREE.Group(); this.brake.add(this.die, this.punchGroup); this.brake.visible = false; this.group.add(this.brake);
    // welding torch
    this.torch = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#2a2f34', roughness: 0.6 })); body.position.y = 0.075; this.torch.add(body);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.03, 12), new THREE.MeshPhysicalMaterial({ color: '#c58a4d', metalness: 1, roughness: 0.3, envMap: env })); tip.position.y = 0.012; this.torch.add(tip); this.torch.visible = false; this.group.add(this.torch);
    // laser cutting head
    this.head = new THREE.Group();
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.007, 0.03, 20), new THREE.MeshPhysicalMaterial({ color: '#c58a4d', metalness: 1, roughness: 0.3, envMap: env })); noz.position.y = 0.015; this.head.add(noz);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 24), new THREE.MeshPhysicalMaterial({ color: '#dfe2e4', metalness: 0.3, roughness: 0.35, envMap: env })); hb.position.y = 0.055; this.head.add(hb);
    const hb2 = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.04, 0.03), new THREE.MeshPhysicalMaterial({ color: '#0d57a3', metalness: 0.2, roughness: 0.45, envMap: env })); hb2.position.y = 0.1; this.head.add(hb2);
    const lbeam = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.016, 8), new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false })); lbeam.position.y = -0.006; this.head.add(lbeam);
    this.head.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.head.visible = false; this.group.add(this.head);
    // screwdriver bit
    this.driver = new THREE.Group(); const dsh = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 12), steel); dsh.position.y = 0.03; this.driver.add(dsh); const dh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 24), new THREE.MeshStandardMaterial({ color: '#e0262e', roughness: 0.5 })); dh.position.y = 0.085; this.driver.add(dh); this.driver.visible = false; this.group.add(this.driver);
  }
}
