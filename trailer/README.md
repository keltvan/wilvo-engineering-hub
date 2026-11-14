# WILVO Engineering · trailer “Van order tot levering”

Een promo van 45 seconden, volledig als JavaScript-animatie (three.js + DOM), die één product volgt van order tot
levering: de klant stuurt het TPD, engineering zet de AI-skills en de Engineering Hub in (snelle tekstmontage), en de
productie loopt in vijf stappen (lasersnijden, zetten, lassen, montage, expeditie) door Melkweg 1, gevolgd op de
echte luchtfoto van het terrein.

## Afspelen

Open `trailer/index.html` in een browser (Chrome/Edge). Klik of druk op spatie om af te spelen; `←`/`→` springen 5 s.
`?t=18` start op 18 s, `?autoplay` start direct. Geluid (muziek en effecten) wordt live gesynthetiseerd met de Web Audio API.

De pagina werkt offline: three.js r161 (MIT) staat in `vendor/`, de fonts in `fonts/` (Bitter en Roboto uit de Hub,
JetBrains Mono en Archivo (OFL) van Google Fonts) en de luchtfoto’s in `assets/`.

## Beeldmateriaal

- `assets/aerial-close.jpg` en `assets/aerial-wide.jpg`: Luchtfoto Actueel Ortho (8 cm en 25 cm) van PDOK,
  Beeldmateriaal Nederland, licentie CC BY 4.0. De gebouwcontour (BGT) en de afdelingsposities komen uit `site.json`,
  afgeleid van de digital twin; de twin zelf en de Hub zijn niet aangepast en worden niet meer gebruikt in de video.
- Het product is het echte **draaiplateau** uit `DRAAIPLATEAU.STP` (HiCAD): `assets/draaiplateau.glb` is die STEP,
  ingelezen met occt-import-js (dezelfde engine als de 3D-viewer van de Hub) en ongewijzigd omgezet. Twee aluminium
  platen 600 × 600 × 6, een gezaagde middenas Ø20 × 27 (hoeklas a1 rondom), 16 nokjes 20 × 8 × 31 in sleuven
  (I-naad), 8 lagers Ø22 × 7 op M8 × 30 met moer, en een verzonken M10 × 40. De stappen volgen de las- en
  montage-instructies die met de AI-skills voor dit product zijn gemaakt. `js/draaiplateau.js` stuurt de onderdelen
  aan; de gereedschappen (snijkop, zaagblad, TIG-toorts, steeksleutel, inbussleutel, doos) zijn procedureel.

## Opbouw

| Bestand | Inhoud |
|---|---|
| `index.html` | het podium (1920 × 1080, geschaald naar het venster), typografie en overlay-stijlen |
| `js/main.js` | tijdlijn: shots en camera’s, toestand van het product per moment, overlays, afspelen |
| `js/map2d.js` | de locatie: luchtfoto’s als platte kaart op een 2D-canvas, gebouwcontour, pins en de route |
| `js/draaiplateau.js` | het draaiplateau (uit de STEP), de gereedschappen en de lassen; `js/product.js` levert de vonken |
| `js/overlay.js` | tijdgestuurde DOM-overlays (geen CSS-animaties, dus elke `seek(t)` geeft hetzelfde beeld) |
| `js/audio.js` | de score (128 bpm) en de effecten; `js/cues.js` de effecten op de tijdlijn |
| `js/util.js` | easing, tracks, deterministische ruis |

De hele animatie is een functie van de tijd `t` (`window.__trailer.seek(t)`), zodat het beeld frame voor frame
exact gerenderd kan worden voor de MP4: headless Chromium (Playwright) per frame op 1920 × 1080, samengevoegd met
ffmpeg en de offline gerenderde soundtrack (`renderOffline` in `js/audio.js`).
