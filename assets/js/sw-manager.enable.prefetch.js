const HOVER_WARM_DELAY_MS = 65;
const WARM_ACTION_NONE = 0;
const WARM_ACTION_HOVER_DELAYED = 1;
const WARM_ACTION_HOVER_IMMEDIATE = 2;
const WARM_ACTION_STATIC = 3;

let navigationWarmupFallbackInstalled = false;
let hoverWarmTimer = null;
let hoverWarmAnchor = null;
const warmedNavigationUrls = new Set();
let fallbackHoverActions = new Map();

function getWarmActionPriority(action) {
    switch (action) {
        case WARM_ACTION_STATIC:
            return 3;
        case WARM_ACTION_HOVER_IMMEDIATE:
            return 2;
        case WARM_ACTION_HOVER_DELAYED:
            return 1;
        default:
            return 0;
    }
}

function mergeWarmAction(actionMap, rawUrl, action) {
    const href = normalizeWarmNavigationUrl(rawUrl);
    if (!href || action === WARM_ACTION_NONE) return;

    const currentUrl = new URL(window.location.href);
    currentUrl.hash = '';
    if (href === currentUrl.toString()) return;

    const previous = actionMap.get(href) || WARM_ACTION_NONE;
    if (getWarmActionPriority(action) > getWarmActionPriority(previous)) {
        actionMap.set(href, action);
    }
}

function getWarmActionForPrefetchRule(rule) {
    const eagerness = typeof rule?.eagerness === 'string' ? rule.eagerness.toLowerCase() : 'conservative';
    if (eagerness === 'eager') return WARM_ACTION_STATIC;
    if (eagerness === 'moderate') return WARM_ACTION_HOVER_IMMEDIATE;
    return WARM_ACTION_HOVER_DELAYED;
}

function getWarmActionForPrerenderRule() {
    return WARM_ACTION_STATIC;
}

function readSpeculationRulesWarmPlan() {
    const actionMap = new Map();
    const scripts = document.querySelectorAll('script[type="speculationrules"]');
    for (const script of scripts) {
        let payload = null;
        try {
            payload = JSON.parse(script.textContent || '{}');
        } catch (error) {
            payload = null;
        }
        if (!payload || typeof payload !== 'object') continue;

        const prefetchRules = Array.isArray(payload.prefetch) ? payload.prefetch : [];
        for (const rule of prefetchRules) {
            const action = getWarmActionForPrefetchRule(rule);
            const urls = Array.isArray(rule?.urls) ? rule.urls : [];
            for (const rawUrl of urls) {
                mergeWarmAction(actionMap, rawUrl, action);
            }
        }

        const prerenderRules = Array.isArray(payload.prerender) ? payload.prerender : [];
        for (const rule of prerenderRules) {
            const action = getWarmActionForPrerenderRule(rule);
            const urls = Array.isArray(rule?.urls) ? rule.urls : [];
            for (const rawUrl of urls) {
                mergeWarmAction(actionMap, rawUrl, action);
            }
        }
    }

    const staticUrls = [];
    const hoverActions = new Map();
    for (const [href, action] of actionMap.entries()) {
        if (action === WARM_ACTION_STATIC) {
            staticUrls.push(href);
            continue;
        }

        if (action === WARM_ACTION_HOVER_IMMEDIATE || action === WARM_ACTION_HOVER_DELAYED) {
            hoverActions.set(href, action);
        }
    }

    return {
        staticUrls,
        hoverActions
    };
}

function getAnchorWarmAction(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return WARM_ACTION_NONE;
    if (anchor.target && anchor.target.toLowerCase() !== '_self') return WARM_ACTION_NONE;
    if (anchor.hasAttribute('download')) return WARM_ACTION_NONE;

    const href = normalizeWarmNavigationUrl(anchor.href);
    if (!href) return WARM_ACTION_NONE;
    return fallbackHoverActions.get(href) || WARM_ACTION_NONE;
}

async function warmNavigationUrls(urls) {
    const queuedUrls = [];
    for (const rawUrl of urls) {
        const href = normalizeWarmNavigationUrl(rawUrl);
        if (!href || warmedNavigationUrls.has(href)) continue;
        warmedNavigationUrls.add(href);
        queuedUrls.push(href);
    }
    if (!queuedUrls.length) return;

    try {
        const registration = await getActiveWorkerRegistration();
        const worker = registration?.active;
        if (!worker) {
            queuedUrls.forEach((href) => warmedNavigationUrls.delete(href));
            return;
        }

        worker.postMessage({
            type: 'WARM_NAV_BATCH',
            urls: queuedUrls
        });
    } catch (error) {
        queuedUrls.forEach((href) => warmedNavigationUrls.delete(href));
    }
}

function maybeWarmNavigationAnchor(anchor) {
    const action = getAnchorWarmAction(anchor);
    if (action === WARM_ACTION_NONE) return;
    void warmNavigationUrls([anchor.href]);
}

function clearHoverWarmTimer() {
    if (hoverWarmTimer) {
        window.clearTimeout(hoverWarmTimer);
        hoverWarmTimer = null;
    }
    hoverWarmAnchor = null;
}

function scheduleHoverWarm(anchor) {
    const action = getAnchorWarmAction(anchor);
    if (action === WARM_ACTION_NONE) {
        clearHoverWarmTimer();
        return;
    }

    if (action === WARM_ACTION_HOVER_IMMEDIATE) {
        clearHoverWarmTimer();
        maybeWarmNavigationAnchor(anchor);
        return;
    }

    if (hoverWarmAnchor === anchor && hoverWarmTimer) return;

    clearHoverWarmTimer();
    hoverWarmAnchor = anchor;
    hoverWarmTimer = window.setTimeout(() => {
        const target = hoverWarmAnchor;
        hoverWarmTimer = null;
        hoverWarmAnchor = null;
        if (target) {
            maybeWarmNavigationAnchor(target);
        }
    }, HOVER_WARM_DELAY_MS);
}

function installNavigationWarmupFallback() {
    if (navigationWarmupFallbackInstalled || supportsSpeculationRules()) return;
    const warmPlan = readSpeculationRulesWarmPlan();
    fallbackHoverActions = warmPlan.hoverActions;
    const hasStaticWarmups = warmPlan.staticUrls.length > 0;
    const hasHoverWarmups = fallbackHoverActions.size > 0;
    if (!hasStaticWarmups && !hasHoverWarmups) return;

    navigationWarmupFallbackInstalled = true;
    if (hasStaticWarmups) {
        void warmNavigationUrls(warmPlan.staticUrls);
    }

    if (!hasHoverWarmups) return;

    document.addEventListener('mouseover', (event) => {
        const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (anchor instanceof HTMLAnchorElement) {
            scheduleHoverWarm(anchor);
            return;
        }

        clearHoverWarmTimer();
    }, true);

    document.addEventListener('mouseout', (event) => {
        if (!hoverWarmAnchor) return;

        const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (anchor !== hoverWarmAnchor) return;

        const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (related && hoverWarmAnchor.contains(related)) return;
        clearHoverWarmTimer();
    }, true);

    document.addEventListener('focusin', (event) => {
        const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (anchor instanceof HTMLAnchorElement) {
            maybeWarmNavigationAnchor(anchor);
        }
    }, true);

    document.addEventListener('touchstart', (event) => {
        const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (anchor instanceof HTMLAnchorElement) {
            maybeWarmNavigationAnchor(anchor);
        }
    }, { capture: true, passive: true });
}
