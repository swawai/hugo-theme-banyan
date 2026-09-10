function readJsonObjectScript(id) {
    const node = document.getElementById(id);
    if (!node) return null;

    try {
        const parsed = JSON.parse(node.textContent || '{}');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        return null;
    }
}

export function readPrefetchPayload() {
    return readJsonObjectScript('site-prefetch-data');
}

export function readPrefetchRuntimeMeta() {
    return readJsonObjectScript('site-prefetch-runtime-meta');
}

export function supportsLinkPrefetch() {
    try {
        const link = document.createElement('link');
        return Boolean(
            link.relList
            && typeof link.relList.supports === 'function'
            && link.relList.supports('prefetch')
        );
    } catch (error) {
        return false;
    }
}

export function supportsServiceWorkerApi() {
    return 'serviceWorker' in navigator;
}

export function supportsSpeculationRules() {
    try {
        return typeof HTMLScriptElement !== 'undefined'
            && typeof HTMLScriptElement.supports === 'function'
            && HTMLScriptElement.supports('speculationrules');
    } catch (error) {
        return false;
    }
}

export function isWarmablePrefetchAnchor(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    if (anchor.target && anchor.target.toLowerCase() !== '_self') return false;
    return !anchor.hasAttribute('download');
}

export function readPrefetchAnchorCandidates() {
    const candidates = [];
    const anchors = document.querySelectorAll('a[href][data-prefetch-slot]');

    for (let index = 0; index < anchors.length; index += 1) {
        const anchor = anchors[index];
        if (!isWarmablePrefetchAnchor(anchor)) continue;
        candidates.push({
            href: anchor.href,
            slot: anchor.getAttribute('data-prefetch-slot') || ''
        });
    }

    return candidates;
}
