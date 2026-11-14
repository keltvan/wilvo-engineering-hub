// Sound effects that belong to the pictures (times in seconds) · 45 s version.
export const DURATION = 45;
export function sfxCues(s) {
  s.whoosh(0.0, 0.7, 0.2); [0.6, 1.55, 2.5, 3.45].forEach(t => s.whoosh(t, 0.22, 0.2));
  s.laser(2.5, 0.9, 0.25); s.weld(3.45, 0.9, 0.22);
  s.whoosh(6.5, 1.4, 0.3); s.ping(7.6, 1568, 0.35); s.tick(7.8); s.tick(7.95); s.ping(9.3, 1175, 0.25);
  // engineering montage: a tick per card, error, confirms
  [11.0, 12.4, 13.8, 15.4, 16.6].forEach(t => { s.whoosh(t, 0.25, 0.22); s.tick(t + 0.05, 0.2); });
  s.error(11.95); s.confirm(12.9); for (let i = 0; i < 5; i++) s.pluck(14.0 + i * 0.1, 660 + i * 110, 0.12, 0.2); s.confirm(15.9); s.whoosh(17.5, 0.4, 0.3);
  // production
  [18.0, 22.0, 26.0, 30.0, 34.0].forEach(t => s.whoosh(t, 0.8, 0.32));
  s.laser(19.0, 2.6, 0.4);
  s.hydraulic(23.1, 0.6); s.press(23.7, 1); s.hydraulic(24.6, 0.6); s.press(25.2, 1);
  s.weld(27.0, 2.2, 0.35);
  s.press(32.2, 0.5); s.confirm(32.8);
  s.press(35.6, 0.4); s.whoosh(36.6, 0.6, 0.3); s.confirm(37.0);
  s.whoosh(38.0, 1.0, 0.3); for (let i = 0; i < 4; i++) s.ping(38.6 + i * 0.12, 1320 + i * 220, 0.12);
  for (let i = 0; i < 30; i++) s.tick(42.0 + i * 0.04, 0.08);
}
