/*
 * Dynamic Tintz OS service worker
 * Release: 7.0.0-native-app-ui
 */

const CACHE_PREFIX = "dynamic-tintz-v7.0.0-";
const CACHE_NAME = `${CACHE_PREFIX}native-app-ui`; 

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./logo.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" }))
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data === "CLEAR_DYNAMIC_TINTZ_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key))
        )
      )
    );
  }
});

function isSupabaseOrApiRequest(url) {
  return (
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/functions/v1/")
  );
}

function isNetworkFirstAsset(request, url) {
  if (request.mode === "navigate") return true;

  return (
    url.origin === self.location.origin &&
    (
      url.pathname.endsWith("/") ||
      url.pathname.endsWith("/index.html") ||
      url.pathname.endsWith("/app.js") ||
      url.pathname.endsWith("/styles.css") ||
      url.pathname.endsWith("/manifest.webmanifest")
    )
  );
}

async function networkFirst(request) {
  try {
    const response = await fetch(new Request(request, { cache: "no-store" }));

    if (response && response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });

    if (cached) return cached;

    if (request.mode === "navigate") {
      const fallback = await caches.match("./index.html", { ignoreSearch: true });
      if (fallback) return fallback;
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);

  if (response && response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isSupabaseOrApiRequest(url) || url.origin !== self.location.origin) {
    return;
  }

  if (isNetworkFirstAsset(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
