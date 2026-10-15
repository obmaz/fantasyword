/* The build supplies a content-based version and the offline learning assets. */
const APP_VERSION = '__BUILD_VERSION__';
const PRECACHE_ASSETS = ['index.html'];
const CACHE_PREFIX = 'dokdok-app-';
const CACHE_NAME = CACHE_PREFIX + APP_VERSION;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) =>
                cache.addAll(
                    PRECACHE_ASSETS.map((asset) => new Request(asset, { cache: 'reload' }))
                )
            )
    );
});
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(async (keys) => {
            await Promise.all(
                keys
                    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
            await self.clients.claim();
        })
    );
});
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (
        request.method !== 'GET' ||
        url.origin !== self.location.origin ||
        !url.href.startsWith(self.registration.scope) ||
        request.headers.has('range')
    )
        return;
    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);
                try {
                    const response = await fetch(request);
                    if (response.ok) await cache.put('index.html', response.clone());
                    return response;
                } catch {
                    return (await cache.match('index.html')) || Response.error();
                }
            })()
        );
        return;
    }
    if (
        !/\.(?:js|css|webp|png|ico|webmanifest)$/.test(url.pathname) ||
        url.pathname.endsWith('/sw.js')
    )
        return;
    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            // Only unversioned dynamic image requests may match a precached version.
            const saved = await cache.match(request, { ignoreSearch: !url.search });
            if (saved) return saved;
            const response = await fetch(request);
            if (response.ok) await cache.put(request, response.clone());
            return response;
        })()
    );
});
