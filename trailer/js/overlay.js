// DOM overlay driven purely by time t (no CSS animations), so a seek to any t gives the same picture.
import { clamp, seg, ease, lerp } from './util.js';

const anims = {
  // each returns a style patch for progress k in [0,1] of the enter (k rising) / exit (k falling to 0)
  fade: k => ({ opacity: k }),
  up: (k, d = 40) => ({ opacity: k, transform: `translateY(${(1 - k) * d}px)` }),
  down: (k, d = 40) => ({ opacity: k, transform: `translateY(${-(1 - k) * d}px)` }),
  left: (k, d = 60) => ({ opacity: k, transform: `translateX(${(1 - k) * d}px)` }),
  right: (k, d = 60) => ({ opacity: k, transform: `translateX(${-(1 - k) * d}px)` }),
  slam: k => ({ opacity: Math.min(1, k * 3), transform: `scale(${1 + (1 - k) * 0.35})` }),
  pop: k => ({ opacity: Math.min(1, k * 4), transform: `scale(${0.6 + 0.4 * k})` }),
  none: () => ({ opacity: 1 }),
};

export class Overlay {
  constructor(root) { this.root = root; this.items = []; }
  // add an element that lives in [t0, t1]; enter/exit animations are (name, duration, easing)
  add(el, t0, t1, o = {}) {
    const it = { el, t0, t1, inA: o.in || 'up', inD: o.inD ?? 0.35, inE: o.inE || ease.outQuint, outA: o.out || 'fade', outD: o.outD ?? 0.25, outE: o.outE || ease.in, update: o.update || null, dist: o.dist };
    el.style.opacity = '0'; el.style.visibility = 'hidden'; this.root.appendChild(el); this.items.push(it); return it;
  }
  update(t) {
    for (const it of this.items) {
      const on = t >= it.t0 && t < it.t1;
      if (!on) { if (it.el.style.visibility !== 'hidden') { it.el.style.visibility = 'hidden'; it.el.style.opacity = '0'; } continue; }
      it.el.style.visibility = 'visible';
      const kin = it.inE(seg(t, it.t0, it.t0 + it.inD)), kout = 1 - it.outE(seg(t, it.t1 - it.outD, it.t1));
      let patch;
      if (kin < 1) patch = anims[it.inA](kin, it.dist); else patch = anims[it.outA](kout, it.dist);
      if (kin < 1 && kout < 1) patch = anims.fade(Math.min(kin, kout));
      it.el.style.opacity = String(patch.opacity ?? 1); it.el.style.transform = patch.transform || '';
      if (it.update) it.update(t, t - it.t0, it.el);
    }
  }
}

// helpers that build the recurring pieces of the trailer's visual language
export const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// typewriter: reveals text over `dur` seconds from local time lt
export function typer(el, text, dur, lt0 = 0) {
  return (t, lt) => { const n = Math.floor(clamp((lt - lt0) / dur) * text.length); el.textContent = text.slice(0, n) + (n < text.length ? '▍' : ''); };
}
// counts a number up from 0 to n over dur seconds
export function counter(el, n, dur, suffix = '', lt0 = 0) {
  return (t, lt) => { const k = ease.outExpo(clamp((lt - lt0) / dur)); el.textContent = Math.round(n * k).toLocaleString('nl-NL') + suffix; };
}
// staggered children: child i gets opacity/transform from its own enter time
export function stagger(el, every = 0.12, lt0 = 0, d = 18) {
  const kids = [...el.children];
  return (t, lt) => kids.forEach((c, i) => { const k = ease.outQuint(seg(lt, lt0 + i * every, lt0 + i * every + 0.3)); c.style.opacity = String(k); c.style.transform = `translateY(${(1 - k) * d}px)`; });
}
