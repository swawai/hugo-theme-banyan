const NAVIGATION_CACHE_PREFIX = 'nav-html-';
const ASSET_CACHE_PREFIX = 'asset-static-';
const FINGERPRINT_ASSET_CACHE = 'asset-fingerprint';

function isManagedCacheKey(key) {
    return key === FINGERPRINT_ASSET_CACHE || key.startsWith(NAVIGATION_CACHE_PREFIX) || key.startsWith(ASSET_CACHE_PREFIX);
}

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.disable();
        }
        const keys = await caches.keys();
        await Promise.all(keys.filter(isManagedCacheKey).map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
