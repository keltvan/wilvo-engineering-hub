// The location as a flat map: the PDOK aerial photo (CC BY 4.0) drawn straight down on a 2D canvas, with the
// building outline, department pins and the production route. No perspective, so no texture shimmer.
import { clamp, lerp, ease } from './util.js';

export class Map2D {
  constructor(canvas, site) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.site = site; this.ready = false;
    const [ox, oy] = site.origin_rd;
    this.layers = ['wide', 'close'].map(k => { const b = site[k].bbox_rd; const img = new Image(); img.src = `./assets/aerial-${k}.jpg`; return { k, img, x0: b[0] - ox, y0: b[1] - oy, w: b[2] - b[0], h: b[3] - b[1] }; });
    this.load = Promise.all(this.layers.map(l => new Promise(r => { l.img.onload = r; l.img.onerror = r; }))).then(() => { this.ready = true; });
    this.cam = { cx: 105, cy: 72, scale: 1, rot: 0 }; // scale = px per metre
    const order = ['laser', 'zett', 'lasse', 'monta', 'verze', 'dock']; this.order = order;
    this.routePts = this.smooth(order.map(k => site.stations[k]), 24); this.routeU = {}; order.forEach((k, i) => { this.routeU[k] = i / (order.length - 1); });
  }
  smooth(P, n) { // Catmull-Rom through the stations, n samples per segment
    const out = []; for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)]; for (let j = 0; j < n; j++) { const t = j / n, t2 = t * t, t3 = t2 * t; out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } } out.push(P[P.length - 1]); return out;
  }
  // local metres -> screen px
  project(x, y) { const { cx, cy, scale, rot } = this.cam; const dx = (x - cx) * scale, dy = -(y - cy) * scale; const c = Math.cos(rot), s = Math.sin(rot); return [960 + dx * c - dy * s, 540 + dx * s + dy * c]; }
  setCam(cx, cy, scale, rot = 0) { this.cam = { cx, cy, scale, rot }; }
  camT(k, A, B, e = ease.io) { const s = e(k); this.setCam(lerp(A[0], B[0], s), lerp(A[1], B[1], s), Math.exp(lerp(Math.log(A[2]), Math.log(B[2]), s)), lerp(A[3] || 0, B[3] || 0, s)); }

  draw(t, st) { // st: { outline, pins: {k: alpha}, route: progress, pulse }
    const ctx = this.ctx; const { cx, cy, scale, rot } = this.cam;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0a0d10'; ctx.fillRect(0, 0, 1920, 1080);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.translate(960, 540); ctx.rotate(rot); ctx.scale(scale, -scale); ctx.translate(-cx, -cy);
    // wide always, close fades in from 1.2 px/m
    const closeA = clamp((scale - 1.2) / 1.6);
    for (const l of this.layers) { if (!l.img.width) continue; const a = l.k === 'close' ? closeA : 1; if (a <= 0) continue; ctx.globalAlpha = a; ctx.save(); ctx.translate(l.x0, l.y0 + l.h); ctx.scale(l.w / l.img.width, -l.h / l.img.height); ctx.drawImage(l.img, 0, 0); ctx.restore(); }
    ctx.globalAlpha = 1;
    // metres -> px line widths
    const px = v => v / scale;
    // building outline
    if (st.outline > 0.001) { ctx.beginPath(); this.site.pand.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.lineJoin = 'round'; ctx.strokeStyle = `rgba(255,80,90,${0.35 * st.outline})`; ctx.lineWidth = px(14); ctx.stroke(); ctx.strokeStyle = `rgba(224,38,46,${st.outline})`; ctx.lineWidth = px(4); ctx.stroke(); ctx.fillStyle = `rgba(224,38,46,${0.08 * st.outline})`; ctx.fill(); }
    // route
    if (st.route > 0.001) { const n = Math.max(2, Math.floor(this.routePts.length * clamp(st.route))); ctx.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = this.routePts[i]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,90,98,0.35)'; ctx.lineWidth = px(16); ctx.stroke(); ctx.strokeStyle = '#e0262e'; ctx.lineWidth = px(5); ctx.setLineDash([px(14), px(9)]); ctx.lineDashOffset = -st.pulse * px(40); ctx.stroke(); ctx.setLineDash([]); const [hx, hy] = this.routePts[n - 1]; ctx.beginPath(); ctx.arc(hx, hy, px(7), 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }
    // pins
    for (const [k, a] of Object.entries(st.pins || {})) { if (a <= 0.001) continue; const [x, y] = this.site.stations[k]; const pulse = 0.5 + 0.5 * Math.sin(st.pulse * 6 + k.length); ctx.beginPath(); ctx.arc(x, y, px(26 + 10 * pulse), 0, Math.PI * 2); ctx.fillStyle = `rgba(224,38,46,${0.18 * a * (1 - pulse * 0.5)})`; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, px(14), 0, Math.PI * 2); ctx.lineWidth = px(3.5); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, px(14), 0, Math.PI * 2); ctx.lineWidth = px(2); ctx.strokeStyle = `rgba(224,38,46,${a})`; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, px(5), 0, Math.PI * 2); ctx.fillStyle = `rgba(224,38,46,${a})`; ctx.fill(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // vignette
    const g = ctx.createRadialGradient(960, 540, 500, 960, 540, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  }
}
