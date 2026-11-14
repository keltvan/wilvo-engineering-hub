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
  // press brake: hydraulic approach and a thud, four times
  [23.0, 23.75, 24.5, 25.25].forEach(t => { s.hydraulic(t, 0.35, 0.18); s.press(t + 0.36, 0.9); s.hydraulic(t + 0.5, 0.2, 0.12); });
  // welding: four bursts, one per corner
  [26.9, 27.6, 28.3, 29.0].forEach(t => s.weld(t, 0.6, 0.35));
  // assembly: lid lands, four screws
  s.press(32.0, 0.35); [32.2, 32.55, 32.9, 33.25].forEach(t => { for (let i = 0; i < 6; i++) s.tick(t + i * 0.045, 0.1); s.probe(t + 0.3, 0.15); });
  // expedition: carton unfolds (rustle), product lands, flaps close, tape
  s.hydraulic(34.8, 0.4, 0.1); s.press(36.0, 0.3); s.hydraulic(36.1, 0.35, 0.1); s.whoosh(36.6, 0.6, 0.3); s.confirm(37.0);
  // finale
  s.whoosh(38.0, 1.4, 0.3); for (let i = 0; i < 4; i++) s.ping(38.6 + i * 0.12, 1320 + i * 220, 0.12);
  for (let i = 0; i < 30; i++) s.tick(42.0 + i * 0.04, 0.08);
}
