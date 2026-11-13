// Sound effects that belong to the pictures (times in seconds).
// ---------------------------------------------------------------- sound cues that belong to the pictures
export const DURATION = 90;
export function sfxCues(s) {
  s.whoosh(0.0, 0.9, 0.2); [0.9, 2.07, 3.24, 4.41].forEach(t => s.whoosh(t, 0.25, 0.2));
  s.laser(3.24, 1.1, 0.25); s.weld(4.41, 1.1, 0.22);
  s.whoosh(7.5, 1.2, 0.25);
  s.ping(9.4, 1568, 0.35); s.tick(9.6); s.tick(9.75);
  s.whoosh(12.4, 0.8, 0.35);
  // engineering: ticks for lines, error, confirm
  for (let i = 0; i < 6; i++) s.tick(15.65 + i * 0.42); s.error(17.75 + 2 * 0.42 + 0.0); s.confirm(21.0);
  for (let i = 0; i < 4; i++) s.tick(23.15 + i * 0.42); s.whoosh(24.4, 0.8, 0.25); s.confirm(26.4);
  for (let i = 0; i < 6; i++) s.tick(28.65 + i * 0.42); for (let i = 0; i < 7; i++) s.pluck(30.6 + i * 0.16, 660 + i * 110, 0.12, 0.2); s.confirm(33.2);
  for (let i = 0; i < 8; i++) s.tick(34.9 + i * 0.11, 0.14); s.whoosh(40.5, 0.5, 0.3);
  // production
  s.whoosh(42.0, 1.6, 0.4);
  s.laser(45.3, 2.4, 0.4); s.whoosh(47.2, 0.5, 0.3);
  s.hydraulic(49.6, 0.7); s.press(50.3, 1); s.hydraulic(51.1, 0.7); s.press(51.8, 1); s.whoosh(52.2, 0.5, 0.3);
  s.weld(55.0, 2.0, 0.35); s.whoosh(57.0, 0.5, 0.3);
  [59.2, 59.6, 60.0, 60.4].forEach(t => s.pneu(t)); s.whoosh(60.8, 0.5, 0.3);
  [62.8, 63.3, 63.8, 64.2].forEach(t => s.probe(t)); for (let i = 0; i < 7; i++) s.tick(63.1 + i * 0.32, 0.12); s.confirm(65.0); s.whoosh(64.6, 0.5, 0.3);
  s.whoosh(66.2, 0.6, 0.3); s.press(68.6, 0.5); s.confirm(68.9); s.whoosh(69.4, 0.5, 0.3);
  s.press(72.2, 0.4); s.whoosh(73.0, 0.5, 0.3); s.truck(73.2, 4.5, 0.3);
  s.whoosh(76.0, 1.0, 0.3); for (let i = 0; i < 5; i++) s.ping(76.6 + i * 0.12, 1320 + i * 220, 0.12);
  for (let i = 0; i < 30; i++) s.tick(82.6 + i * 0.043, 0.08);
}

