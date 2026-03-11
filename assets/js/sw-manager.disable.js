const SW_SCOPE = '/';
const NAVIGATION_CACHE_PREFIX = 'nav-html-';
const ASSET_CACHE_PREFIX = 'asset-static-';

function supportsServiceWorker() {
    return 'serviceWorker' in navigator;
}

function isManagedCacheKey(key) {
    return key.startsWith(NAVIGATION_CACHE_PREFIX) || key.startsWith(ASSET_CACHE_PREFIX);
}

async function clearManagedCaches() {
    if (!('caches' in window)) return;

    try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(isManagedCacheKey).map((key) => caches.delete(key)));
    } catch (error) { }
}

function isRootScopedRegistration(registration) {
    try {
        const scope = new URL(registration.scope);
        return scope.origin === window.location.origin && scope.pathname === SW_SCOPE;
    } catch (error) {
        return false;
    }
}

async function unregisterManagedWorkers() {
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
            registrations
                .filter(isRootScopedRegistration)
                .map((registration) => registration.unregister())
        );
    } catch (error) { }
}

async function handleDisableMode() {
    await unregisterManagedWorkers();
    await clearManagedCaches();
}

if (supportsServiceWorker()) {
    void handleDisableMode();
}
