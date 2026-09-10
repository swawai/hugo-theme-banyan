export const NAVIGATION_CACHE_PREFIX = 'nav-html-';
export const VERSIONED_ASSET_CACHE_PREFIX = 'asset-versioned-';
export const LEGACY_VERSIONED_ASSET_CACHE_PREFIX = 'asset-static-';
export const FINGERPRINT_ASSET_CACHE = 'asset-fingerprint';

export function isManagedCacheKey(key) {
    return key === FINGERPRINT_ASSET_CACHE
        || key.startsWith(NAVIGATION_CACHE_PREFIX)
        || key.startsWith(VERSIONED_ASSET_CACHE_PREFIX)
        || key.startsWith(LEGACY_VERSIONED_ASSET_CACHE_PREFIX);
}

export function shouldDeleteVersionedCache(key, currentNavigationCache, currentAssetCache) {
    if (key.startsWith(NAVIGATION_CACHE_PREFIX)) return key !== currentNavigationCache;
    if (key.startsWith(VERSIONED_ASSET_CACHE_PREFIX)) return key !== currentAssetCache;
    return key.startsWith(LEGACY_VERSIONED_ASSET_CACHE_PREFIX);
}
