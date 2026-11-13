// The product that travels through the factory: a 3 mm S235 U-bracket, built to the plaatwerk rules.
// Everything is driven by a state object, so one call to apply() sets the geometry for any moment in time.
import * as THREE from 'three';
import { clamp, lerp, ease, hash } from './util.js';

export const T = 0.003;                       // plaatdikte (m)
export const BL = 0.240, BW = 0.160, FH = 0.050; // blank length, web width, flange height (m)
const R_IN = T, R_OUT = 2 * T;
const RELIEF_W = 1.5 * T;

export const PRODUCT = { T, BL, BW, FH, R_IN, uitslag: `${Math.round(BL * 1000)} × ${Math.round((BW + 2 * (FH + Math.PI / 2 * (R_IN + 0.44 * T))) * 1000)} mm` };

function steelMaterial(env) {
  return new THREE.MeshPhysicalMaterial({ color: '#c3c7cb', metalness: 0.9, roughness: 0.34, envMap: env, envMapIntensity: 1.2, clearcoat: 0.1, clearcoatRoughness: 0.4 });
}

// plate in the XZ plane (y up, thickness 0..T along +y) with round holes and rectangular notches
function plate(w, d, holes = [], notches = [], radius = 0.004) {
  const s = new THREE.Shape();
  const x0 = -w / 2, z0 = -d / 2, r = radius;
  s.moveTo(x0 + r, z0); s.lineTo(x0 + w - r, z0); s.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r);
  s.lineTo(x0 + w, z0 + d - r); s.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d);
  s.lineTo(x0 + r, z0 + d); s.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r);
  s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
  for (const [hx, hz, hr] of holes) { const p = new THREE.Path(); p.absarc(hx, hz, hr, 0, Math.PI * 2, false); s.holes.push(p); }
  for (const [nx, nz, nw, nd] of notches) { const p = new THREE.Path(); p.moveTo(nx - nw / 2, nz - nd / 2); p.lineTo(nx + nw / 2, nz - nd / 2); p.lineTo(nx + nw / 2, nz + nd / 2); p.lineTo(nx - nw / 2, nz + nd / 2); p.closePath(); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(Math.PI / 2); g.translate(0, T, 0);
  g.computeVertexNormals();
  return g;
}

// deterministic spark cloud: N points re-spawned every `life` seconds from an emitter position function
export class Sparks {
  constructor(n = 240, life = 0.45, color = '#ffb347', size = 0.012) {
    this.n = n; this.life = life; this.t0 = 0; this.emit = () => new THREE.Vector3(); this.spread = 0.6; this.up = 0.6; this.gravity = -2.5;
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(n * 3); this.alpha = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { color: { value: new THREE.Color(color) }, size: { value: size } },
      vertexShader: 'attribute float alpha; varying float vA; uniform float size; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 color; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = (1.0 - r * 2.0) * vA; gl_FragColor = vec4(color * (1.0 + vA * 2.0), a); }' });
    this.mat.toneMapped = false;
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.visible = false;
  }
  // t: absolute time; active window [a, b]; emitter(tt) gives the spawn position at time tt
  update(t, a, b, scale = 1) {
    const on = t >= a && t <= b + this.life; this.points.visible = on; if (!on) return;
    for (let i = 0; i < this.n; i++) {
      const ph = hash(i, 1) * this.life; const born = Math.floor((t - a - ph) / this.life) * this.life + ph + a; const age = t - born;
      if (born < a || born > b || age < 0) { this.alpha[i] = 0; continue; }
      const p = this.emit(born); const vx = (hash(i, 2) - 0.5) * this.spread, vz = (hash(i, 3) - 0.5) * this.spread, vy = hash(i, 4) * this.up + 0.15;
      const k = age; this.pos[i * 3] = p.x + vx * k * scale; this.pos[i * 3 + 1] = p.y + (vy * k + 0.5 * this.gravity * k * k) * scale; this.pos[i * 3 + 2] = p.z + vz * k * scale;
      this.alpha[i] = Math.pow(1 - age / this.life, 1.5) * (0.5 + 0.5 * hash(i, 5));
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.alpha.needsUpdate = true;
  }
}

export class Product {
  constructor(env) {
    this.group = new THREE.Group();
    this.mat = steelMaterial(env);
    this.darkMat = new THREE.MeshPhysicalMaterial({ color: '#7d848a', metalness: 0.9, roughness: 0.45, envMap: env });
    this.glowMat = new THREE.MeshBasicMaterial({ color: '#ff6a3c', transparent: true, opacity: 0.95, toneMapped: false });
    this.redMat = new THREE.MeshBasicMaterial({ color: '#e0262e', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    this.state = { bend1: 0, bend2: 0, relief: 1, flaw: 0, weld: 0, inserts: 0, assemble: 0, base: 0, scanY: -1, cut: 0, sheet: 0, box: 0, explode: 0, wire: 0 };
    this.build();
  }

  build() {
    const g = this.group; g.clear();
    const hx = BL / 2 - 0.035, hz = BW / 2 - 0.03;
    this.webHoles = [[-hx, -hz, 0.0033], [hx, -hz, 0.0033], [-hx, hz, 0.0033], [hx, hz, 0.0033]];
    this.web = new THREE.Mesh(plate(BL, BW, this.webHoles), this.mat); this.web.castShadow = true; this.web.receiveShadow = true; g.add(this.web);
    // wireframe twin for the "STEP" look in the hook and the engineering act
    this.wire = new THREE.LineSegments(new THREE.EdgesGeometry(this.web.geometry, 20), new THREE.LineBasicMaterial({ color: '#1f6fd6', transparent: true, opacity: 0 })); g.add(this.wire);
    this.flanges = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(0, 0, side * BW / 2); g.add(pivot);
      const fl = new THREE.Group(); pivot.add(fl);
      const fg = plate(BL - 2 * RELIEF_W, FH, [[-BL / 2 + 0.03, 0, 0.0035], [BL / 2 - 0.03, 0, 0.0035]]);
      const m = new THREE.Mesh(fg, this.mat); m.position.set(0, 0, side * FH / 2); m.castShadow = true; m.receiveShadow = true; fl.add(m);
      const fw = new THREE.LineSegments(new THREE.EdgesGeometry(fg, 20), this.wire.material); fw.position.copy(m.position); fl.add(fw);
      const tabs = [];
      for (const e of [-1, 1]) { const tab = new THREE.Mesh(new THREE.BoxGeometry(RELIEF_W, T, FH), this.mat); tab.position.set(e * (BL / 2 - RELIEF_W / 2), T / 2, side * FH / 2); fl.add(tab); tabs.push(tab); }
      const mark = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0015, 8, 32), this.redMat); mark.rotation.x = Math.PI / 2; mark.position.set(BL / 2 - 0.004, T, side * 0.004); pivot.add(mark);
      const mark2 = mark.clone(); mark2.position.x = -BL / 2 + 0.004; pivot.add(mark2);
      this.flanges.push({ side, pivot, fl, plate: m, tabs, mark, mark2 });
    }
    // weld seams: glowing bead along each inside corner, revealed with s.weld
    this.seams = [];
    for (const side of [-1, 1]) { const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, BL - 2 * RELIEF_W, 8, 1), this.glowMat.clone()); seam.rotation.z = Math.PI / 2; seam.position.set(0, T + 0.0022, side * (BW / 2 - 0.0022)); seam.visible = false; g.add(seam); this.seams.push(seam); }
    this.coolMat = new THREE.MeshStandardMaterial({ color: '#5f6a72', roughness: 0.6, metalness: 0.7 });
    // PEM inserts
    this.inserts = [];
    this.webHoles.forEach(([x, z]) => { const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0058, 0.006, 6), this.darkMat); nut.position.set(x, T + 0.003, z); nut.visible = false; nut.castShadow = true; g.add(nut); this.inserts.push(nut); });
    // assembly: base plate + mirrored second bracket + 4 bolts
    this.asm = new THREE.Group(); g.add(this.asm);
    const baseMat = this.mat.clone(); baseMat.color.set('#6e7a86');
    const base = new THREE.Mesh(plate(0.34, 0.26, [[-0.15, -0.11, 0.0045], [0.15, -0.11, 0.0045], [-0.15, 0.11, 0.0045], [0.15, 0.11, 0.0045]], [], 0.01), baseMat); base.castShadow = true; base.receiveShadow = true; this.asm.add(base); this.base = base;
    const twin = new THREE.Group(); this.asm.add(twin); this.twin = twin;
    const tw = new THREE.Mesh(plate(BL, BW, this.webHoles), this.mat); tw.castShadow = true; twin.add(tw);
    for (const side of [-1, 1]) { const f = new THREE.Mesh(plate(BL - 2 * RELIEF_W, FH), this.mat); f.rotation.x = -side * Math.PI / 2; f.position.set(0, FH / 2, side * BW / 2); f.castShadow = true; twin.add(f); }
    this.bolts = []; this.webHoles.forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 6), this.darkMat); b.position.set(x, T + 0.009, z); this.asm.add(b); this.bolts.push(b); });
    // scan plane (maakbaarheid)
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshBasicMaterial({ color: '#4fb8ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); this.scan.rotation.x = -Math.PI / 2; g.add(this.scan);
    // laser: the sheet the blank is cut from, plus the glowing contour that reveals with s.cut
    this.sheet = new THREE.Mesh(new THREE.BoxGeometry(0.62, T, 0.42), this.mat.clone()); this.sheet.material.color.set('#aeb3b8'); this.sheet.position.set(0.11, T / 2 - 0.0006, 0.06); this.sheet.receiveShadow = true; this.sheet.visible = false; g.add(this.sheet);
    const pathPts = []; const rx = BL / 2 + 0.0005, rz = BW / 2 + 0.0005; const corners = [[-rx, -rz], [rx, -rz], [rx, rz], [-rx, rz]];
    for (let i = 0; i < 4; i++) { const a = corners[i], b = corners[(i + 1) % 4]; for (let k = 0; k < 40; k++) { const u = k / 40; pathPts.push(new THREE.Vector3(lerp(a[0], b[0], u), T + 0.0008, lerp(a[1], b[1], u))); } }
    pathPts.push(pathPts[0].clone());
    this.cutPath = new THREE.CatmullRomCurve3(pathPts, false, 'catmullrom', 0);
    const tube = new THREE.TubeGeometry(this.cutPath, 320, 0.0012, 6, false); this.cutTube = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: '#ffb070', toneMapped: false, transparent: true, opacity: 0.95 })); this.cutTube.visible = false; g.add(this.cutTube);
    this.cutIndexCount = tube.index.count;
    this.sparks = new Sparks(220, 0.4, '#ffb347', 0.02); g.add(this.sparks.points);
    this.weldSparks = new Sparks(160, 0.3, '#ffe9b0', 0.014); this.weldSparks.spread = 0.5; this.weldSparks.up = 0.4; g.add(this.weldSparks.points);
    this.arc = new THREE.PointLight('#cfe8ff', 0, 0.5, 2); g.add(this.arc);
    // the cardboard box
    this.box = new THREE.Group(); const card = new THREE.MeshStandardMaterial({ color: '#c99d6b', roughness: 0.95 });
    const bb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.17, 0.3), card); bb.position.y = 0.085; bb.castShadow = true; this.box.add(bb);
    this.lids = []; for (const s of [-1, 1]) { const lid = new THREE.Group(); lid.position.set(0, 0.17, s * 0.15); const lm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.004, 0.15), card); lm.position.z = -s * 0.075; lid.add(lm); this.box.add(lid); this.lids.push([lid, s]); }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshBasicMaterial({ color: '#ffffff' })); label.position.set(0.1, 0.09, 0.151); this.box.add(label);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.012), new THREE.MeshBasicMaterial({ color: '#e0262e' })); stripe.position.set(0.1, 0.118, 0.1515); this.box.add(stripe);
    this.box.visible = false; g.add(this.box);
    this.apply(0);
  }

  // state -> geometry; t is used for subtle flicker
  apply(t = 0) {
    const s = this.state;
    const angs = [ease.io(clamp(s.bend1)) * Math.PI / 2, ease.io(clamp(s.bend2)) * Math.PI / 2];
    this.flanges.forEach((f, i) => {
      f.pivot.rotation.x = -f.side * angs[i];
      const relief = clamp(s.relief);
      f.tabs.forEach(tb => { tb.visible = relief < 0.999; tb.scale.x = Math.max(0.001, 1 - relief); });
      const fo = clamp(s.flaw) * (0.65 + 0.35 * Math.sin(t * 14)); f.mark.material.opacity = fo; f.mark.visible = f.mark2.visible = s.flaw > 0.01;
    });
    const wk = clamp(s.weld);
    this.seams.forEach(seam => { seam.visible = wk > 0.001; seam.scale.y = Math.max(0.001, wk); seam.position.x = -(BL - 2 * RELIEF_W) / 2 * (1 - wk); const cool = clamp(s.weldCool || 0); seam.material.color.lerpColors(new THREE.Color('#ff6a3c'), new THREE.Color('#6a737a'), cool); seam.material.opacity = 1; });
    this.inserts.forEach((n, i) => { const k = clamp(s.inserts * 4 - i); n.visible = k > 0; n.position.y = T + 0.003 + 0.05 * (1 - ease.in(k)); });
    const a = ease.io(clamp(s.assemble)), ex = clamp(s.explode);
    this.asm.visible = s.base > 0.001;
    this.base.position.y = -0.03 - 0.14 * (1 - a) - 0.06 * ex;
    this.twin.position.set(0, 0.18 * (1 - a) + 0.07 * ex, 0.0); this.twin.rotation.y = Math.PI;
    this.twin.position.z = 0.0; this.twin.position.x = 0; this.twin.position.y += 0.0;
    this.bolts.forEach((b, i) => { const k = clamp(a * 2 - 1); b.visible = k > 0; b.position.y = T + 0.009 + 0.05 * (1 - k) + 0.03 * ex; });
    this.scan.material.opacity = s.scanY > -0.5 && s.scanY < 0.5 ? 0.35 : 0; this.scan.position.y = (s.scanY + 0.5) * 0.09 - 0.01;
    this.sheet.visible = s.sheet > 0.5;
    const ck = clamp(s.cut); this.cutTube.visible = ck > 0.001 && ck < 1.2; this.cutTube.geometry.setDrawRange(0, Math.floor(this.cutIndexCount * ck));
    this.wire.material.opacity = clamp(s.wire);
    this.web.visible = s.wire < 0.999; this.flanges.forEach(f => { f.plate.visible = s.wire < 0.999; });
    this.box.visible = s.box > 0.001; const bk = ease.outBack(clamp(s.box)); this.box.scale.setScalar(Math.max(0.001, bk)); this.lids.forEach(([lid, sd]) => { lid.rotation.x = sd * (1 - ease.io(clamp(s.boxLid || 0))) * Math.PI / 2; });
  }
  cutPoint(k) { return this.cutPath.getPointAt(clamp(k, 0, 0.999)); }
}

// simple tools that act on the product in the close-ups
export class Tools {
  constructor(env) {
    this.group = new THREE.Group();
    const steel = new THREE.MeshPhysicalMaterial({ color: '#5a6168', metalness: 0.85, roughness: 0.35, envMap: env });
    const blue = new THREE.MeshPhysicalMaterial({ color: '#2d6db5', metalness: 0.2, roughness: 0.45, envMap: env });
    // press brake: V-die below the bend line (x axis), punch + beam above
    this.die = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.09), steel); this.die.position.set(0, -0.027, 0); this.die.castShadow = true; this.die.receiveShadow = true;
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: '#1a1e22', roughness: 0.8 })); groove.rotation.x = Math.PI / 4; groove.position.set(0, 0.025, 0); this.die.add(groove);
    this.punchGroup = new THREE.Group();
    this.punch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.018, 0.018), steel); this.punch.rotation.x = Math.PI / 4; this.punch.position.y = 0.012; this.punchGroup.add(this.punch);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.012), steel); neck.position.y = 0.05; this.punchGroup.add(neck);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.04), blue); beam.position.y = 0.115; this.punchGroup.add(beam);
    this.punchGroup.position.y = 0.2; this.punchGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.brake = new THREE.Group(); this.brake.add(this.die, this.punchGroup); this.brake.visible = false; this.group.add(this.brake);
    // welding torch
    this.torch = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#2a2f34', roughness: 0.6 })); body.position.y = 0.075; this.torch.add(body);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.03, 12), new THREE.MeshPhysicalMaterial({ color: '#c58a4d', metalness: 1, roughness: 0.3, envMap: env })); tip.position.y = 0.012; this.torch.add(tip); this.torch.rotation.z = -0.5; this.torch.visible = false; this.group.add(this.torch);
    // insert press ram
    this.ram = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 24), steel); this.ram.visible = false; this.group.add(this.ram);
    // CMM stylus
    this.stylus = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.08, 10), steel); shaft.position.y = 0.04; this.stylus.add(shaft); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.003, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#d84b3f', metalness: 0.1, roughness: 0.3, envMap: env })); this.stylus.add(ball); const head = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: '#e8e6e0' })); head.position.y = 0.095; this.stylus.add(head); this.stylus.visible = false; this.group.add(this.stylus);
  }
}
