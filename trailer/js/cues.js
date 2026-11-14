// Sound effects that belong to the pictures (times in seconds) · 45 s version.
export const DURATION = 45;
export function sfxCues(s) {
  // hook: a whoosh per cut, the laser and the arc briefly
  s.whoosh(0.0, 0.7, 0.2); [0.6, 1.55, 2.5, 3.45].forEach(t => s.whoosh(t, 0.22, 0.2));
  s.laser(2.5, 0.9, 0.25); s.weld(3.45, 0.85, 0.22);
  // the dive: a long descending whoosh, a ping when the order lands, a soft ping for the pin
  s.whoosh(6.5, 2.2, 0.3); s.ping(7.6, 1568, 0.35); s.tick(7.8); s.tick(7.95); s.ping(9.6, 1175, 0.25);
  // engineering montage: a tick per card, error, confirms
  [11.0, 12.4, 13.8, 15.4, 16.6].forEach(t => { s.whoosh(t, 0.25, 0.22); s.tick(t + 0.05, 0.2); });
  s.error(11.95); s.confirm(12.9); for (let i = 0; i < 5; i++) s.pluck(14.0 + i * 0.1, 660 + i * 110, 0.12, 0.2); s.confirm(15.9); s.whoosh(17.5, 0.4, 0.3);
  // production: a short whoosh on every map hop
  [18.0, 22.0, 26.0, 30.0, 34.0].forEach(t => s.whoosh(t, 0.7, 0.3));
  // laser: continuous cut with a pierce pop at the start of each contour
  s.laser(19.0, 2.7, 0.4); for (let i = 0; i < 12; i++) s.pneu(19.0 + i * 0.22, 0.12);
  // saw: blade spins up, cuts the tube, the piece drops
  s.hydraulic(22.9, 0.5, 0.12); s.saw && s.saw(23.4, 1.2, 0.35); s.press(25.0, 0.25);
  // welding: a1 ring around the middenas, then 16 short I-welds on the nokken
  s.weld(26.9, 0.9, 0.35); s.press(28.2, 0.3); for (let i = 0; i < 16; i++) s.weld(28.5 + i * 0.075, 0.07, 0.25);
  // assembly: bearings click, screws, nuts (ratchet), top plate lands, M10 with the hex key
  s.probe(30.95, 0.2); for (let i = 0; i < 5; i++) s.tick(31.2 + i * 0.05, 0.12); for (let i = 0; i < 8; i++) s.tick(31.45 + i * 0.05, 0.1); for (let i = 0; i < 7; i++) { s.probe(31.95 + i * 0.08, 0.14); s.tick(32.05 + i * 0.08, 0.1); } s.press(33.3, 0.35); for (let i = 0; i < 8; i++) s.tick(33.4 + i * 0.06, 0.12); s.confirm(33.9);
  // expedition: carton unfolds (rustle), product lands, flaps close, tape
  s.hydraulic(34.8, 0.4, 0.1); s.press(36.0, 0.3); s.hydraulic(36.1, 0.35, 0.1); s.whoosh(36.6, 0.6, 0.3); s.confirm(37.0);
  // finale
  s.whoosh(38.0, 1.4, 0.3); for (let i = 0; i < 4; i++) s.ping(38.6 + i * 0.12, 1320 + i * 220, 0.12);
  for (let i = 0; i < 30; i++) s.tick(42.0 + i * 0.04, 0.08);
}
