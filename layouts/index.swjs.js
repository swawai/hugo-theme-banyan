const LEGACY_CACHE_PREFIXES = ['nav-html-', 'asset-static-'];

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
                .map((key) => caches.delete(key))
        );

        await self.clients.claim();
        await self.registration.unregister();

        const clients = await self.clients.matchAll({ type: 'window' });
        await Promise.all(
            clients.map((client) => ('navigate' in client ? client.navigate(client.url) : Promise.resolve()))
        );
    })());
});
