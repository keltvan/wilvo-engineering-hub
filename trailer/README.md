# WILVO Engineering · trailer “Van order tot levering”

Een promotievideo van 90 seconden, volledig als JavaScript-animatie (three.js + DOM), die één product volgt van
order tot levering: de klant stuurt het TPD, engineering zet de AI-skills en de Engineering Hub in, en de productie
loopt door de echte afdelingen van Melkweg 1 (digital twin) tot het dock.

## Afspelen

Open `trailer/index.html` in een browser (Chrome/Edge). Klik of druk op spatie om af te spelen; `←`/`→` springen 5 s.
`?t=42` start op 42 s, `?autoplay` start direct. Geluid (muziek en effecten) wordt live gesynthetiseerd met de Web Audio API.

De pagina werkt offline: three.js r161 (MIT) staat in `vendor/`, de fonts in `fonts/` (Bitter en Roboto uit de Hub,
JetBrains Mono en Archivo (OFL) van Google Fonts) en de modellen in `models/`.

## Modellen

`models/*.glb` zijn **ongewijzigd geëxporteerd** uit de digital twin (v14) en de machinepagina’s van de Hub:
het terrein, het gebouw met dak, de indeling (laag 2), de inrichting en werkplekken (laag 3 en 4) en zes machines
(Bystronic BySpeed en Xpert, OTC-lasrobot, Haeger 824-D, Brown & Sharpe-meetmachine, zwenkkraan). De code van de Hub
zelf is niet aangepast; de trailer leest alleen `data.json` (afdelingen, machines, kantbanken, contour) dat uit het
twin-bestand is gehaald.

Het product (een U-beugel van 3 mm S235, met ontlastingssneden, PEM-inserts en een grondplaat) is procedureel gebouwd
in `js/product.js` volgens de zetregels (R_in = T, flens ≥ 4T, gat–zetlijn ≥ 3T).

## Opbouw

| Bestand | Inhoud |
|---|---|
| `index.html` | het podium (1920 × 1080, geschaald naar het venster), typografie en alle overlay-stijlen |
| `js/main.js` | tijdlijn: shots en camera’s, toestand van het product per moment, overlays, afspelen |
| `js/world.js` | de fabriek: laadt de twin-modellen, maakt ze schoon voor film, dak, route, pallet, vrachtwagen |
| `js/product.js` | het product, gereedschappen (kantbank, lastoorts, inpersstempel, taster) en vonken |
| `js/overlay.js` | tijdgestuurde DOM-overlays (geen CSS-animaties, dus elke `seek(t)` geeft hetzelfde beeld) |
| `js/audio.js` | de score (128 bpm) en de effecten; `js/cues.js` de effecten op de tijdlijn |
| `js/util.js` | easing, tracks, deterministische ruis |

De hele animatie is een functie van de tijd `t` (`window.__trailer.seek(t)`), zodat het beeld frame voor frame
exact gerenderd kan worden voor de MP4.

## Video renderen

De MP4 is gemaakt door de pagina headless (Playwright, Chromium) per frame te renderen op 1920 × 1080 en de frames
met ffmpeg samen te voegen met de offline gerenderde soundtrack (`renderOffline` in `js/audio.js`).
