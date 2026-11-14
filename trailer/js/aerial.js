// The location: the open-data aerial photo of Melkweg 1 (PDOK, Luchtfoto Actueel Ortho, CC BY 4.0) on a ground
// plane, with the building outline, department pins and the production route drawn on top.
import * as THREE from 'three';
import { clamp, lerp, ease } from './util.js';

// local metres (x east, y north, origin RD 151990/369456 like the twin) -> scene (x, up, z)
export const W = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

export class Aerial {
  constructor(renderer, site) {
    this.site = site; this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a0d10');
    this.scene.add(new THREE.AmbientLight('#ffffff', 2.4));
    const L = new THREE.TextureLoader(); const [ox, oy] = site.origin_rd;
    const plane = (file, bbox, y, aniso = 16) => { const tx = L.load(file); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = aniso; tx.minFilter = THREE.LinearMipmapLinearFilter; const w = bbox[2] - bbox[0], d = bbox[3] - bbox[1]; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tx })); m.rotation.x = -Math.PI / 2; m.position.set((bbox[0] + bbox[2]) / 2 - ox, y, -((bbox[1] + bbox[3]) / 2 - oy)); this.scene.add(m); return m; };
    this.wide = plane('./assets/aerial-wide.jpg', site.wide.bbox_rd, -0.6);
    this.close = plane('./assets/aerial-close.jpg', site.close.bbox_rd, 0);
    this.closeFade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0 }));
    // building outline (BGT footprint) as a glowing ribbon
    this.outlineMat = new THREE.MeshBasicMaterial({ color: '#e0262e', transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    this.outline = this.ribbon(site.pand.map(([x, y]) => W(x, y, 0.4)), 1.2, this.outlineMat, true); this.scene.add(this.outline);
    this.glowMat = new THREE.MeshBasicMaterial({ color: '#ff5a62', transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.outlineGlow = this.ribbon(site.pand.map(([x, y]) => W(x, y, 0.3)), 4.5, this.glowMat, true); this.scene.add(this.outlineGlow);
    // route through the departments
    const order = ['laser', 'zett', 'lasse', 'monta', 'verze', 'dock'];
    const pts = order.map(k => W(site.stations[k][0], site.stations[k][1], 0.5));
    this.routeCurve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3); this.routeU = {}; order.forEach((k, i) => { this.routeU[k] = i / (order.length - 1); });
    this.routeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { progress: { value: 0 }, time: { value: 0 }, color: { value: new THREE.Color('#e0262e') } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float progress; uniform float time; uniform vec3 color; varying vec2 vUv;
        void main(){ if (vUv.x > progress) discard; float edge = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y); float head = smoothstep(progress - 0.04, progress, vUv.x); float dash = 0.8 + 0.2 * sin(vUv.x * 160.0 - time * 5.0); gl_FragColor = vec4(color * (1.0 + head * 2.0), (0.85 * edge * dash + head)); }` });
    this.routeMat.toneMapped = false;
    this.route = this.curveRibbon(this.routeCurve, 2.2, this.routeMat); this.scene.add(this.route);
    // pins: a ring + dot per station
    this.pins = {};
    for (const [k, p] of Object.entries(site.stations)) {
      const g = new THREE.Group(); g.position.copy(W(p[0], p[1], 0.6));
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 48), new THREE.MeshBasicMaterial({ color: '#e0262e', transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })); ring.rotation.x = -Math.PI / 2; g.add(ring);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshBasicMaterial({ color: '#e0262e', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); dot.rotation.x = -Math.PI / 2; g.add(dot);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ color: '#ff5a62', transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.x = -Math.PI / 2; halo.position.y = -0.1; g.add(halo);
      this.scene.add(g); this.pins[k] = { g, ring, dot, halo, k: 0 };
    }
    // a soft dark vignette ring far out so the far ground does not read as flat paper
  }
  ribbon(pts, w, mat, closed) {
    const P = closed ? [...pts, pts[0]] : pts; const pos = [], uv = [], idx = [];
    for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; const t = new THREE.Vector3().subVectors(b, a).normalize(); const n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(w / 2); const p = P[i]; pos.push(p.x - n.x, p.y, p.z - n.z, p.x + n.x, p.y, p.z + n.z); uv.push(i / (P.length - 1), 0, i / (P.length - 1), 1); if (i < P.length - 1) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); const m = new THREE.Mesh(g, mat); m.renderOrder = 3; return m;
  }
  curveRibbon(curve, w, mat, N = 300) { const pts = []; for (let i = 0; i <= N; i++) pts.push(curve.getPointAt(i / N)); return this.ribbon(pts, w, mat, false); }
  setPin(k, a, pulse = 0) { const p = this.pins[k]; if (!p) return; p.ring.material.opacity = a; p.dot.material.opacity = a; p.halo.material.opacity = a * 0.35 * (0.6 + 0.4 * Math.sin(pulse * 6)); p.ring.scale.setScalar(1 + 0.12 * Math.sin(pulse * 6)); }
  setOutline(a) { this.outlineMat.opacity = a; this.glowMat.opacity = a * 0.5; }
  setRoute(p, t) { this.routeMat.uniforms.progress.value = p; this.routeMat.uniforms.time.value = t; }
  // camera over a point: height h, tilt (deg from vertical), heading (deg), fov
  cam(at, h, tilt = 0, heading = 0, fov = 30) { const tt = tilt * Math.PI / 180, hd = heading * Math.PI / 180; const back = h * Math.tan(tt); const pos = [at[0] - back * Math.sin(hd), h, -(at[1] - back * Math.cos(hd))]; return { pos, target: [at[0], 0, -at[1]], fov }; }
  camT(k, A, B, e = ease.io) { const s = e(k); return this.cam([lerp(A[0][0], B[0][0], s), lerp(A[0][1], B[0][1], s)], lerp(A[1], B[1], s), lerp(A[2], B[2], s), lerp(A[3], B[3], s), lerp(A[4] ?? 30, B[4] ?? 30, s)); }
  // screen position (0..1) of a local point for DOM labels
  project(camera, x, y) { const v = W(x, y, 0.6).project(camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; }
}
