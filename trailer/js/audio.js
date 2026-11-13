// Synthesised score and effects. Everything is scheduled from a fixed table, so the same
// program renders identically on an OfflineAudioContext (for the MP4) and live in the browser.
import { BEAT, BAR, bar, beat, hash } from './util.js';

const DROP = bar(22) + 0.75 * BAR;  // 42.0 s: production starts
const END = 90;

function env(p, t, a, d, s, r, peak = 1, sus = 0.6, len = 0.3) {
  p.cancelScheduledValues(t); p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.linearRampToValueAtTime(peak * sus, t + a + d); p.setValueAtTime(peak * sus, t + a + d + len); p.linearRampToValueAtTime(0, t + a + d + len + r);
}

export class Score {
  constructor(ctx, offset = 0) {
    this.ctx = ctx; this.o = offset; // offset: seconds subtracted from every event (live seek)
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    this.master.connect(this.comp); this.comp.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.noiseBuf = this.makeNoise();
    this.rev = this.makeReverb(); this.rev.connect(this.master);
  }
  makeNoise() { const n = this.ctx.sampleRate * 2; const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate); const d = b.getChannelData(0); let s = 1; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } return b; }
  makeReverb() { const sr = this.ctx.sampleRate, len = sr * 1.8; const b = this.ctx.createBuffer(2, len, sr); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let s = 7 + c; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 2.6) * 0.5; } } const cv = this.ctx.createConvolver(); cv.buffer = b; const g = this.ctx.createGain(); g.gain.value = 0.22; cv.connect(g); return g.connect ? (g.__cv = cv, g) : g; }
  reverbIn() { return this.rev.__cv; }
  T(t) { return Math.max(0, t - this.o + this.ctx.currentTime); }
  live(t) { return t - this.o >= -0.05; }

  // ---------- instruments
  kick(t, v = 1) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, T); o.frequency.exponentialRampToValueAtTime(42, T + 0.12); g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + 0.32); o.connect(g).connect(this.music); o.start(T); o.stop(T + 0.35); const cl = c.createOscillator(), cg = c.createGain(); cl.type = 'square'; cl.frequency.value = 900; cg.gain.setValueAtTime(0.12 * v, T); cg.gain.exponentialRampToValueAtTime(0.001, T + 0.02); cl.connect(cg).connect(this.music); cl.start(T); cl.stop(T + 0.03); }
  snare(t, v = 0.8) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; const g = c.createGain(); g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + 0.18); n.connect(f).connect(g).connect(this.music); g.connect(this.reverbIn()); n.start(T); n.stop(T + 0.2); const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(220, T); o.frequency.exponentialRampToValueAtTime(120, T + 0.08); og.gain.setValueAtTime(0.5 * v, T); og.gain.exponentialRampToValueAtTime(0.001, T + 0.1); o.connect(og).connect(this.music); o.start(T); o.stop(T + 0.12); }
  hat(t, v = 0.25, open = false) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.playbackRate.value = 1.7; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = c.createGain(); g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + (open ? 0.25 : 0.05)); n.connect(f).connect(g).connect(this.music); n.start(T); n.stop(T + 0.3); }
  bass(t, f, len, v = 0.5) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(), o2 = c.createOscillator(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f / 2; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(220, T); lp.frequency.exponentialRampToValueAtTime(1400, T + 0.03); lp.frequency.exponentialRampToValueAtTime(260, T + len); const g = c.createGain(); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v, T + 0.01); g.gain.setValueAtTime(v, T + len - 0.03); g.gain.linearRampToValueAtTime(0, T + len); o.connect(lp); o2.connect(lp); lp.connect(g).connect(this.music); o.start(T); o2.start(T); o.stop(T + len + 0.05); o2.stop(T + len + 0.05); }
  pad(t, freqs, len, v = 0.08, cutoff = 900) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff * 0.4, T); lp.frequency.linearRampToValueAtTime(cutoff, T + len * 0.5); const g = c.createGain(); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v, T + Math.min(1.2, len * 0.3)); g.gain.setValueAtTime(v, T + len - 0.6); g.gain.linearRampToValueAtTime(0, T + len); lp.connect(g).connect(this.music); g.connect(this.reverbIn()); freqs.forEach((f, i) => { for (const det of [-6, 5]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + i; o.connect(lp); o.start(T); o.stop(T + len + 0.1); } }); }
  pluck(t, f, v = 0.2, len = 0.25) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + len); o.connect(g).connect(this.music); g.connect(this.reverbIn()); o.start(T); o.stop(T + len + 0.02); }
  riser(t, len, v = 0.3) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(200, T); f.frequency.exponentialRampToValueAtTime(6000, T + len); const g = c.createGain(); g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(v, T + len); g.gain.setValueAtTime(0, T + len + 0.01); n.connect(f).connect(g).connect(this.music); n.start(T); n.stop(T + len + 0.05); }
  impact(t, v = 1) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(90, T); o.frequency.exponentialRampToValueAtTime(30, T + 0.6); g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + 1.4); o.connect(g).connect(this.music); g.connect(this.reverbIn()); o.start(T); o.stop(T + 1.5); const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, T); f.frequency.exponentialRampToValueAtTime(100, T + 0.5); const ng = c.createGain(); ng.gain.setValueAtTime(0.6 * v, T); ng.gain.exponentialRampToValueAtTime(0.001, T + 0.6); n.connect(f).connect(ng).connect(this.music); n.start(T); n.stop(T + 0.7); }

  // ---------- effects
  whoosh(t, len = 0.6, v = 0.35) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, T); f.frequency.exponentialRampToValueAtTime(2500, T + len * 0.4); f.frequency.exponentialRampToValueAtTime(400, T + len); const g = c.createGain(); g.gain.setValueAtTime(0.001, T); g.gain.exponentialRampToValueAtTime(v, T + len * 0.4); g.gain.exponentialRampToValueAtTime(0.001, T + len); n.connect(f).connect(g).connect(this.sfx); n.start(T); n.stop(T + len + 0.05); }
  ping(t, f = 1760, v = 0.25) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); for (const [m, vv] of [[1, 1], [2.01, 0.4], [3.2, 0.15]]) { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f * m; g.gain.setValueAtTime(v * vv, T); g.gain.exponentialRampToValueAtTime(0.001, T + 0.9); o.connect(g).connect(this.sfx); g.connect(this.reverbIn()); o.start(T); o.stop(T + 1); } }
  tick(t, v = 0.18) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = 2400 + hash(Math.round(t * 1000)) * 800; g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + 0.03); o.connect(g).connect(this.sfx); o.start(T); o.stop(T + 0.04); }
  confirm(t, v = 0.25) { this.pluck(t, 880, v, 0.18); this.pluck(t + 0.09, 1320, v, 0.3); }
  error(t, v = 0.3) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(180, T); o.frequency.setValueAtTime(140, T + 0.1); g.gain.setValueAtTime(v, T); g.gain.setValueAtTime(v, T + 0.18); g.gain.linearRampToValueAtTime(0, T + 0.22); o.connect(g).connect(this.sfx); o.start(T); o.stop(T + 0.25); }
  laser(t, len, v = 0.35) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 2.5; const g = c.createGain(); g.gain.setValueAtTime(0.001, T); g.gain.exponentialRampToValueAtTime(v, T + 0.08); g.gain.setValueAtTime(v, T + len - 0.1); g.gain.exponentialRampToValueAtTime(0.001, T + len); n.connect(f).connect(g).connect(this.sfx); n.start(T); n.stop(T + len + 0.05); const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 95; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; og.gain.setValueAtTime(0.001, T); og.gain.exponentialRampToValueAtTime(v * 0.5, T + 0.1); og.gain.setValueAtTime(v * 0.5, T + len - 0.1); og.gain.exponentialRampToValueAtTime(0.001, T + len); o.connect(lp).connect(og).connect(this.sfx); o.start(T); o.stop(T + len + 0.05); for (let i = 0; i < len * 40; i++) { const tt = t + i / 40 + hash(i, 3) * 0.02; const s = c.createBufferSource(); s.buffer = this.noiseBuf; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000; const sg = c.createGain(); const TT = this.T(tt); sg.gain.setValueAtTime(v * 0.6 * hash(i, 4), TT); sg.gain.exponentialRampToValueAtTime(0.001, TT + 0.015); s.connect(hp).connect(sg).connect(this.sfx); s.start(TT); s.stop(TT + 0.02); } }
  press(t, v = 0.9) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(120, T); o.frequency.exponentialRampToValueAtTime(35, T + 0.25); g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + 0.5); o.connect(g).connect(this.sfx); g.connect(this.reverbIn()); o.start(T); o.stop(T + 0.55); const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const ng = c.createGain(); ng.gain.setValueAtTime(0.5 * v, T); ng.gain.exponentialRampToValueAtTime(0.001, T + 0.2); n.connect(f).connect(ng).connect(this.sfx); n.start(T); n.stop(T + 0.25); }
  hydraulic(t, len = 0.5, v = 0.2) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(600, T); f.frequency.linearRampToValueAtTime(900, T + len); f.Q.value = 3; const g = c.createGain(); g.gain.setValueAtTime(v, T); g.gain.setValueAtTime(v, T + len - 0.05); g.gain.linearRampToValueAtTime(0, T + len); n.connect(f).connect(g).connect(this.sfx); n.start(T); n.stop(T + len + 0.02); }
  weld(t, len, v = 0.3) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100; const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 50; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; const g = c.createGain(); g.gain.setValueAtTime(0.001, T); g.gain.exponentialRampToValueAtTime(v, T + 0.05); g.gain.setValueAtTime(v, T + len - 0.08); g.gain.exponentialRampToValueAtTime(0.001, T + len); o.connect(lp); o2.connect(lp); lp.connect(g).connect(this.sfx); o.start(T); o2.start(T); o.stop(T + len + 0.05); o2.stop(T + len + 0.05); for (let i = 0; i < len * 60; i++) { const tt = t + i / 60 + hash(i, 9) * 0.015; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.5 + hash(i, 10); const sg = c.createGain(); const TT = this.T(tt); sg.gain.setValueAtTime(v * 1.2 * hash(i, 11), TT); sg.gain.exponentialRampToValueAtTime(0.001, TT + 0.012); s.connect(sg).connect(this.sfx); s.start(TT); s.stop(TT + 0.015); } }
  pneu(t, v = 0.4) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = c.createGain(); g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + 0.12); n.connect(f).connect(g).connect(this.sfx); n.start(T); n.stop(T + 0.15); this.press(t + 0.08, 0.5); }
  probe(t, v = 0.2) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 3200; g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.001, T + 0.05); o.connect(g).connect(this.sfx); o.start(T); o.stop(T + 0.06); }
  truck(t, len = 5, v = 0.25) { if (!this.live(t)) return; const c = this.ctx, T = this.T(t); const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(38, T); o.frequency.linearRampToValueAtTime(70, T + len * 0.6); o.frequency.linearRampToValueAtTime(55, T + len); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; const g = c.createGain(); g.gain.setValueAtTime(0.001, T); g.gain.exponentialRampToValueAtTime(v, T + 0.5); g.gain.setValueAtTime(v, T + len - 1); g.gain.exponentialRampToValueAtTime(0.001, T + len); o.connect(lp).connect(g).connect(this.sfx); o.start(T); o.stop(T + len + 0.05); const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 500; const ng = c.createGain(); ng.gain.setValueAtTime(0.001, T); ng.gain.exponentialRampToValueAtTime(v * 0.5, T + 0.5); ng.gain.exponentialRampToValueAtTime(0.001, T + len); n.connect(bp).connect(ng).connect(this.sfx); n.start(T); n.stop(T + len + 0.05); }

  // ---------- the arrangement
  schedule() {
    const K = (t, v) => this.kick(t, v), S = (t, v) => this.snare(t, v), H = (t, v, o) => this.hat(t, v, o);
    const root = 55; // A1
    const prog = [[1, 5 / 4 * 0 + 1], [1.5 / 1.5 * 1, 1]];
    // --- act 1: hook (0-7.5): pulse + hits on cuts
    this.pad(0, [root * 2, root * 3], 7.5, 0.05, 500);
    for (let i = 0; i < 4; i++) K(0.9 + i * 1.17, 0.9);
    this.riser(2.5, 3.1, 0.25);
    this.impact(5.6, 1.1);
    // --- act 2: order (7.5-15): groove in, half-time feel
    const b0 = 7.5;
    this.pad(b0, [root * 2, root * 3, root * 2 * 1.5], 7.5, 0.07, 1200);
    for (let b = 0; b < 4; b++) { const t = b0 + b * BAR; K(t); K(t + 2 * BEAT); S(t + 2 * BEAT, 0.5); for (let i = 0; i < 8; i++) H(t + i * BEAT / 2, i % 2 ? 0.12 : 0.2); this.bass(t, root, BEAT * 0.9, 0.35); this.bass(t + 1.5 * BEAT, root, BEAT * 0.45, 0.3); this.bass(t + 3 * BEAT, root * 1.5 / 2 * 1.3348, BEAT * 0.9, 0.3); }
    this.ping(9.4, 1568, 0.3); this.whoosh(12.0, 0.7, 0.3);
    // --- act 3: engineering (15-42): driving, more energy per card
    const b1 = 15;
    const chords = [[root * 2, root * 2 * 1.5, root * 4 * 1.1892], [root * 2 * 0.8909, root * 2 * 1.3348, root * 4 * 1.0595], [root * 2 * 1.1892, root * 2 * 1.7818, root * 4 * 1.4142], [root * 2 * 1.3348, root * 4, root * 4 * 1.1892]];
    for (let b = 0; b < 14; b++) {
      const t = b1 + b * BAR; const ch = chords[b % 4];
      this.pad(t, ch, BAR + 0.1, 0.07, 1500 + b * 60);
      K(t); K(t + 2 * BEAT); K(t + 3.5 * BEAT, 0.6); S(t + BEAT, 0.6); S(t + 3 * BEAT, 0.7);
      for (let i = 0; i < 8; i++) H(t + i * BEAT / 2, i % 2 ? 0.14 : 0.24, i === 7);
      for (let i = 0; i < 8; i++) this.bass(t + i * BEAT / 2, i % 4 === 3 ? ch[0] / 2 * 1.5 : ch[0] / 2, BEAT * 0.42, 0.33);
      for (let i = 0; i < 4; i++) this.pluck(t + i * BEAT + BEAT / 4, ch[(i + b) % 3] * 2, 0.08, 0.3);
    }
    this.riser(38.5, 3.5, 0.45);
    // --- act 4: production (42-76): the drop
    this.impact(DROP, 1.3);
    for (let b = 0; b < 18; b++) {
      const t = DROP + b * BAR; const ch = chords[b % 4];
      K(t); K(t + BEAT); K(t + 2 * BEAT); K(t + 3 * BEAT); S(t + BEAT, 0.8); S(t + 3 * BEAT, 0.9);
      for (let i = 0; i < 16; i++) H(t + i * BEAT / 4, i % 4 === 2 ? 0.26 : 0.1, i % 8 === 6);
      for (let i = 0; i < 8; i++) this.bass(t + i * BEAT / 2 + BEAT / 4, i % 3 === 2 ? ch[0] / 2 * 1.5 : ch[0] / 2, BEAT * 0.4, 0.38);
      this.pad(t, ch.map(f => f * 2), BAR + 0.1, 0.05, 3000);
      for (let i = 0; i < 8; i++) this.pluck(t + i * BEAT / 2, ch[[0, 2, 1, 2, 0, 1, 2, 1][i]] * 2, 0.07, 0.2);
    }
    // --- act 5: finale (76-90)
    const b4 = 76;
    this.impact(b4, 1.0);
    for (let b = 0; b < 3; b++) { const t = b4 + b * BAR; const ch = chords[(b + 1) % 4]; this.pad(t, [...ch, ch[0] * 2], BAR + 0.1, 0.09, 2600); K(t); K(t + 2 * BEAT); S(t + BEAT); S(t + 3 * BEAT); for (let i = 0; i < 8; i++) H(t + i * BEAT / 2, 0.18, i === 7); for (let i = 0; i < 4; i++) this.bass(t + i * BEAT, ch[0] / 2, BEAT * 0.8, 0.36); }
    this.riser(80.4, 1.6, 0.3);
    this.impact(82.0, 1.2);
    this.pad(82, [root, root * 2, root * 3, root * 4 * 1.1892], 8, 0.09, 2000);
    this.pluck(86.0, 880, 0.15, 1.2); this.pluck(86.12, 1320, 0.12, 1.2);
  }
}

export async function renderOffline(duration, sampleRate = 48000, scheduleSfx) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const s = new Score(ctx, 0); s.schedule(); if (scheduleSfx) scheduleSfx(s);
  const buf = await ctx.startRendering();
  return buf;
}

export function wavBlob(buf) {
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate; const out = new ArrayBuffer(44 + n * ch * 2); const v = new DataView(out);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true);
  let o = 44; const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const x = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, x < 0 ? x * 32768 : x * 32767, true); o += 2; }
  return new Blob([out], { type: 'audio/wav' });
}
