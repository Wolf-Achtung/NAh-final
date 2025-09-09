/*
 * Ein einfacher Service Worker zum Cachen statischer Assets und Offline‑Unterstützung.
 * Beim Installieren werden die wichtigsten Dateien in einen Cache geladen.
 * Bei Fetch‑Events wird zuerst versucht, die Antwort aus dem Cache zu holen.
 * Schlägt dies fehl, wird eine Netzwerkanfrage gestartet. Falls die Netzwerkanfrage
 * fehlschlägt (z. B. offline), wird versucht, eine passende gecachte Antwort zu liefern.
 */

const CACHE_NAME = 'nah-cache-v1';

// Liste der Ressourcen, die beim Installieren vorab in den Cache geladen werden.
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Beim Installieren werden nur die wichtigsten statischen Ressourcen vorgeladen.
// Entscheidungsbäume werden jetzt on-demand geladen und anschließend automatisch im Cache abgelegt.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Wir ignorieren Abfragen, die nicht mit GET erfolgen.
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Für API‑Anfragen: Netzwerk zuerst, bei Fehler Fallback auf Cache.  Wir
  // ignorieren jedoch Anfragen, die nicht über http(s) laufen, da das
  // Cache‑Interface z. B. bei chrome‑extension:// nicht funktioniert und
  // einen Fehler wirft (siehe DevTools‑Warnung). So werden nur echte
  // HTTP‑Anfragen gecacht.
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Nur http(s)‑Requests in den Cache schreiben
          if (event.request.url.startsWith('http')) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
              return response;
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Für alle anderen GET‑Anfragen: Cache‑first mit Fallback auf Netzwerk. Bei
  // Dokumenten wird bei fehlendem Cache die Startseite ausgegeben.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((response) => {
            // Erfolgreiche Antworten in den Cache legen.
            if (
              response &&
              response.status === 200 &&
              response.type === 'basic' &&
              event.request.url.startsWith('http')
            ) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      });
    })
  );
});