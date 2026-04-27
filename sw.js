const CACHE_NAME = "pasteleria-v7";
const ASSETS = [
  "./Gestion-Pasteleria/",
  "./Gestion-Pasteleria/index.html",
  "./Gestion-Pasteleria/styles.css",
  "./Gestion-Pasteleria/app.js",
  "./Gestion-Pasteleria/manifest.json",
  "./Gestion-Pasteleria/icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200) return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return res;
      }).catch(() => caches.match('/Gestion-Pasteleria/'));
    })
  );
});
