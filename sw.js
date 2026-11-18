// Service worker voor de Hub als app op de telefoon (zie assets/manifest.webmanifest).
// Altijd eerst het netwerk, zodat je de nieuwste versie krijgt; zonder verbinding de laatst geladen pagina,
// zodat de app niet leeg opent. De pagina's zijn versleuteld, dus de kopie is dat ook.
const CACHE = "wilvo-hub-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match(event.request, { ignoreSearch: true })));
});
