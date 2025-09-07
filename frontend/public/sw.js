// public/sw.js
//
// Service worker for the NAh‑final PWA. Provides offline caching of
// critical assets such as decision trees, hazard metadata, model
// manifest, audio prompts and the app shell. The worker uses two
// caches: one for static assets (versioned) and one for dynamic data.
//
// Bump the cache names to invalidate older versions when deploying new
// functionality. This ensures users get the latest training sets,
// multimedia assets and tips when they reload the app.
// Incremented cache versions to v4 to ensure users receive the latest
// multimedia assets, tips and training sets after deployment. Whenever
// you add new pre‑cached files, bump these version names.
const STATIC_CACHE = 'nah-static-v4';
const DATA_CACHE = 'nah-data-v4';

// Precache list. When adding new assets here, bump the version
// suffixes in STATIC_CACHE or DATA_CACHE to force an update.
const PRECACHE = [
  '/',
  '/index.html',
  // Core application shell files
  '/css/app.css',
  '/js/app.js',
  // Hazard metadata and decision tree indices
  '/data/hazards_meta.json',
  '/data/trees/de.json',
  '/data/trees/en.json',
  // Synonyms and step definitions used for offline classification and guidance.
  '/data/steps.json',
  '/data/hazard_synonyms.json',
  // Precache all available training sets so that quiz mode works offline.
  '/training/sets/de-basics.json',
  '/training/sets/en-basics.json',
  '/training/sets/de-cpr.json',
  '/training/sets/en-cpr.json',
  // Precache the full BlazeFace model manifest and weights for offline anonymisation.
  '/models/blazeface/assets.json',
  '/models/blazeface/model.json',
  '/models/blazeface/group1-shard1of1.bin',
  // Audio prompts for critical actions.
  '/audio/call-112.mp3',
  '/audio/cpr_beat_110.mp3'
  ,
  // Multimedia assets used in learning cards (images, animations)
  '/media/emergency_symbol.png',
  '/media/children_symbol.png',
  // User tips definitions for each hazard
  '/data/tips.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches when a new version is deployed
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, DATA_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Data assets (JSON, model manifest) use cache‑first strategy
  if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/training/') || url.pathname.startsWith('/models/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE);
        const cached = await cache.match(event.request);
        const network = fetch(event.request).then((resp) => {
          cache.put(event.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network || new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      })()
    );
    return;
  }
  // Default: network‑first for app shell; fallback to cache
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        return caches.match(event.request) || caches.match('/index.html');
      }
    })()
  );
});