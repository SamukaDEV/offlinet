// OffliNet Service Worker for PWA installation & protocol handlers
const CACHE_NAME = "offlinet-pwa-v1";
const STATIC_ASSETS = [
  "/",
  "/favicon.svg",
  "/index.css",
  "/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Best effort caching of shell assets
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Network-first strategy for dynamic media and API, fallback to cache for shell
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Do not intercept streaming, thumbnails, APIs or partial ranges in SW
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/monaco/") ||
    event.request.headers.has("range") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((res) => res || fetch(event.request)))
  );
});
