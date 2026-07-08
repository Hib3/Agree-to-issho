const CACHE_NAME = "with-aguri-mvp-v5";
const scopeUrl = new URL(self.registration.scope);
const BASE_PATH = scopeUrl.pathname.endsWith("/") ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
const APP_SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/characters/main/fullbody/approved/aguri_normal.png",
  "assets/backgrounds/aguri_room_desk.webp",
  "assets/backgrounds/aguri_room_desk.png"
].map((path) => new URL(path, self.registration.scope).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith(BASE_PATH)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL("index.html", self.registration.scope).toString())));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
