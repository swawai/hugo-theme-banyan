const PREFETCH_HOVER_DELAY_MS = 65;
const PREFETCH_VIEWPORT_AREA_MAX = 450000;
const PREFETCH_IDLE_TIMEOUT_MS = 1500;
const PREFETCHED_URLS = new Set();

function shouldDisableAllPrefetch() {
    const connection = navigator.connection;
    if (!connection) return false;
    if (connection.saveData) return true;

    const effectiveType = (connection.effectiveType || '').toLowerCase();
    return effectiveType === '2g' || effectiveType === 'slow-2g';
}

function readPrefetchMode(key) {
    return (document.body?.dataset[key] || '').toLowerCase();
}

function modeForAnchor(anchor) {
    switch (anchor?.dataset.prefetchKind) {
        case 'sort':
            return readPrefetchMode('prefetchSort');
        case 'desc':
            return readPrefetchMode('prefetchDesc');
        case 'post':
            return readPrefetchMode('prefetchPost');
        case 'nav':
            return readPrefetchMode('prefetchNav');
        default:
            return '';
    }
}

function supportsDocumentPrefetch() {
    return !!document.createElement('link').relList?.supports?.('prefetch');
}

function shouldSkipViewportMode(mode) {
    if (!mode.startsWith('viewport')) return true;
    if (mode === 'viewport') {
        return document.documentElement.clientWidth * document.documentElement.clientHeight >= PREFETCH_VIEWPORT_AREA_MAX;
    }
    return false;
}

function canPrefetchAnchor(anchor) {
    if (!anchor?.href) return false;
    if (anchor.target && anchor.target.toLowerCase() !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;

    let targetUrl;
    try {
        targetUrl = new URL(anchor.href, window.location.href);
    } catch (e) {
        return false;
    }

    if (!/^https?:$/.test(targetUrl.protocol)) return false;
    if (targetUrl.origin !== window.location.origin) return false;

    const currentUrl = new URL(window.location.href);
    const sameDocument = targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search;
    if (sameDocument) return false;

    return true;
}

function hasPrefetchLink(href) {
    return Array.from(document.head.querySelectorAll('link[rel="prefetch"]')).some((el) => el.href === href);
}

function prefetchDocument(href, priority = 'auto') {
    if (!supportsDocumentPrefetch()) return;
    if (PREFETCHED_URLS.has(href) || hasPrefetchLink(href)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    link.as = 'document';
    link.fetchPriority = priority;
    document.head.appendChild(link);
    PREFETCHED_URLS.add(href);
}

function initHoverPrefetch() {
    let hoverTimer = null;
    let hoverAnchor = null;

    const clearHoverTimer = () => {
        if (!hoverTimer) return;
        window.clearTimeout(hoverTimer);
        hoverTimer = null;
        hoverAnchor = null;
    };

    document.addEventListener('touchstart', (event) => {
        const anchor = event.target instanceof Element ? event.target.closest('a[data-prefetch-kind]') : null;
        if (!anchor || modeForAnchor(anchor) !== 'hover' || !canPrefetchAnchor(anchor)) return;
        prefetchDocument(anchor.href, 'high');
    }, { capture: true, passive: true });

    document.addEventListener('mouseover', (event) => {
        const anchor = event.target instanceof Element ? event.target.closest('a[data-prefetch-kind]') : null;
        if (!anchor || modeForAnchor(anchor) !== 'hover' || !canPrefetchAnchor(anchor)) return;
        if (hoverAnchor === anchor) return;

        clearHoverTimer();
        hoverAnchor = anchor;
        hoverTimer = window.setTimeout(() => {
            prefetchDocument(anchor.href, 'high');
            clearHoverTimer();
        }, PREFETCH_HOVER_DELAY_MS);
    }, { capture: true, passive: true });

    document.addEventListener('mouseout', (event) => {
        if (!hoverAnchor) return;
        const currentAnchor = event.target instanceof Element ? event.target.closest('a[data-prefetch-kind]') : null;
        const relatedAnchor = event.relatedTarget instanceof Element ? event.relatedTarget.closest('a[data-prefetch-kind]') : null;
        if (currentAnchor && currentAnchor === hoverAnchor && currentAnchor !== relatedAnchor) {
            clearHoverTimer();
        }
    }, { capture: true, passive: true });
}

function initViewportPrefetch() {
    if (!('IntersectionObserver' in window) || !supportsDocumentPrefetch()) return;

    const viewportAnchors = Array.from(document.querySelectorAll('a[data-prefetch-kind]')).filter((anchor) => {
        const mode = modeForAnchor(anchor);
        return (mode === 'viewport' || mode === 'viewport-all') && !shouldSkipViewportMode(mode) && canPrefetchAnchor(anchor);
    });
    if (!viewportAnchors.length) return;

    const startObserving = () => {
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const anchor = entry.target;
                observer.unobserve(anchor);
                prefetchDocument(anchor.href);
            }
        });

        viewportAnchors.forEach((anchor) => observer.observe(anchor));
    };

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(startObserving, { timeout: PREFETCH_IDLE_TIMEOUT_MS });
        return;
    }

    window.setTimeout(startObserving, 0);
}

function initPrefetch() {
    if (shouldDisableAllPrefetch()) return;
    if (!document.querySelector('a[data-prefetch-kind]')) return;
    initHoverPrefetch();
    initViewportPrefetch();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrefetch, { once: true });
} else {
    initPrefetch();
}
