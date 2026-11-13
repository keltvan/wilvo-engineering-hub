// Small deterministic helpers shared by every module of the trailer.
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (a, b, t) => Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], t)) : lerp(a, b, t);
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
// progress 0..1 of t inside [a, b]
export const seg = (t, a, b) => clamp((t - a) / (b - a));
// a bump that rises in [a, a+r], holds, and falls in [b-r, b]
export const hold = (t, a, b, r = 0.3) => Math.min(seg(t, a, a + r), 1 - seg(t, b - r, b));

export const ease = {
  lin: t => t,
  in: t => t * t * t,
  out: t => 1 - Math.pow(1 - clamp(t), 3),
  io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t))),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10)),
  outBack: t => { const c = 1.70158, k = c + 1; t = clamp(t) - 1; return 1 + k * t * t * t + c * t * t; },
  outQuint: t => 1 - Math.pow(1 - clamp(t), 5),
  inQuint: t => Math.pow(clamp(t), 5),
  outCirc: t => Math.sqrt(1 - Math.pow(clamp(t) - 1, 2)),
  snap: t => (t >= 1 ? 1 : 0),
};

// Mulberry32: a tiny seeded generator, so particles are identical frame after frame.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// deterministic hash noise in [0,1) for (i, j)
export const hash = (i, j = 0) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; h = (h ^ (h >>> 16)) >>> 0; return h / 4294967296; };

// Keyframe track: [[t, value(number|array)], ...] with an easing between neighbours.
export function track(keys, e = ease.io) {
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; const k = e(seg(t, t0, t1)); return mix(v0, v1, k); }
    }
    return keys[keys.length - 1][1];
  };
}

export const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
export const bar = n => n * BAR;        // seconds at the start of bar n (0-based)
export const beat = n => n * BEAT;
