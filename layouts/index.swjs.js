{{- $swConfig := site.Params.service_worker | default dict -}}
{{- $mode := lower (printf "%v" (index $swConfig "mode" | default "off")) -}}
{{- $cacheFirstExtensions := slice -}}
{{- with index $swConfig "cache_first_extensions" -}}
  {{- range . -}}
    {{- $ext := lower (printf "%v" .) | replaceRE "^\\." "" -}}
    {{- if $ext -}}
      {{- $cacheFirstExtensions = $cacheFirstExtensions | append $ext -}}
    {{- end -}}
  {{- end -}}
{{- end -}}
{{- $cacheFirstExtensions = $cacheFirstExtensions | uniq -}}
{{- $buildVersion := printf "%v" (index $swConfig "version" | default (now.Format "20060102150405")) -}}
const SW_MODE = '{{ $mode }}';
const NAVIGATION_CACHE_PREFIX = 'nav-html-';
const ASSET_CACHE_PREFIX = 'asset-static-';
const NAVIGATION_CACHE = NAVIGATION_CACHE_PREFIX + '{{ $buildVersion }}';
const ASSET_CACHE = ASSET_CACHE_PREFIX + '{{ $buildVersion }}';
const CACHE_FIRST_EXTENSIONS = {{ $cacheFirstExtensions | jsonify }};

function isNavigationRequest(request) {
    return request.method === 'GET' && request.mode === 'navigate';
}

function isSameOriginRequest(request) {
    try {
        return new URL(request.url).origin === self.location.origin;
    } catch (error) {
        return false;
    }
}

function isCacheableHtmlResponse(response) {
    return response && response.ok && response.headers.get('content-type')?.includes('text/html');
}

function isCacheableAssetResponse(response) {
    return response && response.ok;
}

function getRequestExtension(request) {
    try {
        const pathname = new URL(request.url).pathname.toLowerCase();
        const match = pathname.match(/\.([a-z0-9]+)$/);
        return match ? match[1] : '';
    } catch (error) {
        return '';
    }
}

function shouldHandleAssetRequest(request) {
    if (SW_MODE !== 'enable' || !CACHE_FIRST_EXTENSIONS.length) return false;
    if (request.method !== 'GET' || request.mode === 'navigate') return false;
    if (!isSameOriginRequest(request)) return false;

    return CACHE_FIRST_EXTENSIONS.includes(getRequestExtension(request));
}

function isManagedCacheKey(key) {
    return key.startsWith(NAVIGATION_CACHE_PREFIX) || key.startsWith(ASSET_CACHE_PREFIX);
}

async function updateNavigationCache(request, cache) {
    try {
        const response = await fetch(request);
        if (isCacheableHtmlResponse(response)) {
            await cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return null;
    }
}

async function handleNavigationRequest(request) {
    const cache = await caches.open(NAVIGATION_CACHE);
    const cachedResponse = await cache.match(request);
    const networkResponsePromise = updateNavigationCache(request, cache);

    if (cachedResponse) {
        return { response: cachedResponse, background: networkResponsePromise };
    }

    const networkResponse = await networkResponsePromise;
    if (networkResponse) {
        return { response: networkResponse, background: null };
    }

    throw new Error('Navigation request failed with no cached response.');
}

async function handleAssetRequest(request) {
    const cache = await caches.open(ASSET_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const networkResponse = await fetch(request);
    if (isCacheableAssetResponse(networkResponse)) {
        await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
}

self.addEventListener('install', () => {
    if (SW_MODE !== 'enable') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => {
                    if (!isManagedCacheKey(key)) return false;
                    if (SW_MODE !== 'enable') return true;
                    return key !== NAVIGATION_CACHE && key !== ASSET_CACHE;
                })
                .map((key) => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    if (SW_MODE !== 'enable') return;

    const { request } = event;
    if (isNavigationRequest(request) && isSameOriginRequest(request)) {
        event.respondWith((async () => {
            const result = await handleNavigationRequest(request);
            if (result.background) {
                event.waitUntil(result.background);
            }
            return result.response;
        })());
        return;
    }

    if (shouldHandleAssetRequest(request)) {
        event.respondWith(handleAssetRequest(request));
    }
});
