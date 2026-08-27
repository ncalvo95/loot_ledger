// Service worker mínimo, a propósito sin caché: Android/Chrome exige uno
// registrado con un handler de "fetch" para tratar el sitio como una PWA
// instalable de verdad (pantalla completa, sin barra del navegador) en vez
// de un simple acceso directo. No cachea nada para evitar quedarnos con
// una versión vieja pegada mientras la app sigue cambiando.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
