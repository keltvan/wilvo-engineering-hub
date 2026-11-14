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
- Het product (U-beugel 3 mm S235 met ontlastingssneden, PEM-inserts, grondplaat en een tweede beugel) en alle
  gereedschappen (lasersnijkop, kantbank, lastoorts, doos) zijn procedureel gebouwd in `js/product.js`.

## Opbouw

| Bestand | Inhoud |
|---|---|
| `index.html` | het podium (1920 × 1080, geschaald naar het venster), typografie en overlay-stijlen |
| `js/main.js` | tijdlijn: shots en camera’s, toestand van het product per moment, overlays, afspelen |
| `js/aerial.js` | de locatie: luchtfoto’s op een grondvlak, gebouwcontour, pins en de route |
| `js/product.js` | het product, de gereedschappen en de vonken |
| `js/overlay.js` | tijdgestuurde DOM-overlays (geen CSS-animaties, dus elke `seek(t)` geeft hetzelfde beeld) |
| `js/audio.js` | de score (128 bpm) en de effecten; `js/cues.js` de effecten op de tijdlijn |
| `js/util.js` | easing, tracks, deterministische ruis |

De hele animatie is een functie van de tijd `t` (`window.__trailer.seek(t)`), zodat het beeld frame voor frame
exact gerenderd kan worden voor de MP4: headless Chromium (Playwright) per frame op 1920 × 1080, samengevoegd met
ffmpeg en de offline gerenderde soundtrack (`renderOffline` in `js/audio.js`).
