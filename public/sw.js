const CACHE_NAME = 'throwin-cache-v1';

// Assets to cache for basic offline shell
const urlsToCache = [
  '/',
  '/manifest.webmanifest',
  '/icons/app-icon-192.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', function (event) {
  // Stale-while-revalidate strategy for same-origin GET requests
  // Exclude API and auth routes — always fetch live
  const url = event.request.url;
  if (
    event.request.method === 'GET' &&
    url.startsWith(self.location.origin) &&
    !url.includes('/api/') &&
    !url.includes('/auth/')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(event.request).then(function (response) {
          const fetchPromise = fetch(event.request).then(function (networkResponse) {
            // Update cache silently with newer versions
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(function () {
             // Fallback if offline and network request fails
             return response;
          });
          return response || fetchPromise;
        });
      })
    );
  }
});
