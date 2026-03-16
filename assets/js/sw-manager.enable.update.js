const UPDATE_STATE_ATTR = 'data-site-update';
const UPDATE_STATE_READY = 'ready';
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

const root = document.documentElement;

let waitingWorker = null;
let reloadOnControllerChange = false;
let updateCheckTimer = null;
let warmedCurrentUrl = '';
let updatePopover = null;
let updatePopoverAnchor = null;
let updateCopyPromise = null;
let updateCopyCache = null;
let updateFallbackPrompted = false;
let enableModeStarted = false;
let activeRuntime = null;

function setUpdateReadyState(ready) {
    if (ready) {
        root.setAttribute(UPDATE_STATE_ATTR, UPDATE_STATE_READY);
        void maybePromptUpdateFallback();
        return;
    }

    root.removeAttribute(UPDATE_STATE_ATTR);
    updateFallbackPrompted = false;
    hideUpdatePopover();
}

function getBreadcrumbCurrentLink() {
    return document.querySelector('[data-site-update-anchor]');
}

function isUsableUpdateAnchor(anchor) {
    if (!(anchor instanceof HTMLElement)) return false;

    const style = window.getComputedStyle(anchor);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return anchor.getClientRects().length > 0;
}

function getFallbackUpdateCopy() {
    return {
        message: 'A new version is ready. Refresh now?',
        confirm: 'Refresh',
        later: 'Later'
    };
}

function readRuntimeManifestUrl() {
    return document.body?.dataset.assetManifestUrl || '';
}

async function getRuntimeManifest() {
    const manifestUrl = readRuntimeManifestUrl();
    if (!manifestUrl) return {};

    try {
        const response = await fetch(manifestUrl, {
            credentials: 'same-origin'
        });
        return response && response.ok ? await response.json() : {};
    } catch (error) {
        return {};
    }
}

function getRuntimeI18nUrl(manifest, lang) {
    const normalized = typeof lang === 'string' ? lang.toLowerCase() : '';
    const i18nMap = manifest && typeof manifest.i18n === 'object' ? manifest.i18n : null;
    const fallbackMap = manifest && typeof manifest.i18nFallbacks === 'object' ? manifest.i18nFallbacks : null;
    if (!i18nMap) return '';

    if (typeof i18nMap[normalized] === 'string' && i18nMap[normalized]) return i18nMap[normalized];

    let current = normalized;
    const visited = new Set();
    while (fallbackMap && typeof fallbackMap[current] === 'string' && fallbackMap[current] && !visited.has(current)) {
        visited.add(current);
        current = fallbackMap[current].toLowerCase();
        if (typeof i18nMap[current] === 'string' && i18nMap[current]) return i18nMap[current];
    }

    return '';
}

function normalizeUpdateCopy(messages) {
    const fallback = getFallbackUpdateCopy();
    if (!messages || typeof messages !== 'object') return fallback;

    return {
        message: typeof messages.site_update_prompt === 'string' && messages.site_update_prompt ? messages.site_update_prompt : fallback.message,
        confirm: typeof messages.site_update_confirm === 'string' && messages.site_update_confirm ? messages.site_update_confirm : fallback.confirm,
        later: typeof messages.site_update_later === 'string' && messages.site_update_later ? messages.site_update_later : fallback.later
    };
}

async function hydrateUpdateCopy() {
    if (updateCopyCache) return updateCopyCache;
    if (!updateCopyPromise) {
        updateCopyPromise = (async () => {
            const fallback = getFallbackUpdateCopy();
            const manifest = await getRuntimeManifest();
            const url = getRuntimeI18nUrl(manifest, document.documentElement.lang || '');
            if (!url) {
                updateCopyCache = fallback;
                return updateCopyCache;
            }

            try {
                const response = await fetch(url, {
                    credentials: 'same-origin'
                });
                const data = response && response.ok ? await response.json() : {};
                updateCopyCache = normalizeUpdateCopy(data);
                return updateCopyCache;
            } catch (error) {
                updateCopyCache = fallback;
                return updateCopyCache;
            }
        })();
    }

    return updateCopyPromise;
}

async function maybePromptUpdateFallback() {
    if (updateFallbackPrompted) return;

    const anchor = getBreadcrumbCurrentLink();
    if (isUsableUpdateAnchor(anchor)) return;

    updateFallbackPrompted = true;
    const copy = await hydrateUpdateCopy();
    if (window.confirm(copy.message)) {
        if (activeRuntime) {
            void applyWaitingWorker(activeRuntime);
        }
    }
}

async function ensureUpdatePopover() {
    if (updatePopover) return updatePopover;
    if (activeRuntime?.ensureUpdateStyle) {
        await activeRuntime.ensureUpdateStyle();
    }

    const copy = await hydrateUpdateCopy();
    const popover = document.createElement('div');
    popover.className = 'site-update-popover';
    popover.setAttribute('hidden', '');
    popover.innerHTML = [
        '<p class="site-update-popover__text"></p>',
        '<div class="site-update-popover__actions">',
        '<button type="button" class="site-update-popover__confirm"></button>',
        '<button type="button" class="site-update-popover__later"></button>',
        '</div>'
    ].join('');

    popover.querySelector('.site-update-popover__text').textContent = copy.message;
    popover.querySelector('.site-update-popover__confirm').textContent = copy.confirm;
    popover.querySelector('.site-update-popover__later').textContent = copy.later;
    popover.querySelector('.site-update-popover__confirm').addEventListener('click', () => {
        hideUpdatePopover();
        if (activeRuntime) {
            void applyWaitingWorker(activeRuntime);
        }
    });
    popover.querySelector('.site-update-popover__later').addEventListener('click', () => {
        hideUpdatePopover();
    });

    document.body.appendChild(popover);
    updatePopover = popover;
    return updatePopover;
}

function positionUpdatePopover(anchor) {
    if (!updatePopover || !anchor) return;

    const rect = anchor.getBoundingClientRect();
    const popoverRect = updatePopover.getBoundingClientRect();
    const gap = 10;
    const viewportWidth = document.documentElement.clientWidth;
    const maxLeft = Math.max(8, viewportWidth - popoverRect.width - 8);
    const desiredLeft = rect.left + window.scrollX;
    const left = Math.min(Math.max(8, desiredLeft), maxLeft + window.scrollX);
    const top = rect.bottom + window.scrollY + gap;

    updatePopover.style.left = `${left}px`;
    updatePopover.style.top = `${top}px`;
}

async function showUpdatePopover(anchor) {
    const popover = await ensureUpdatePopover();
    updatePopoverAnchor = anchor;
    popover.hidden = false;
    popover.setAttribute('data-open', 'true');
    positionUpdatePopover(anchor);
}

function hideUpdatePopover() {
    if (!updatePopover) return;

    updatePopover.hidden = true;
    updatePopover.removeAttribute('data-open');
    updatePopoverAnchor = null;
}

function isReloadNavigation() {
    try {
        const entry = performance.getEntriesByType('navigation')[0];
        if (entry && entry.type) return entry.type === 'reload';
    } catch (error) { }

    try {
        return performance.navigation && performance.navigation.type === 1;
    } catch (error) {
        return false;
    }
}

async function warmCurrentPage() {
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = '';
    const href = currentUrl.toString();
    if (warmedCurrentUrl === href) return;

    warmedCurrentUrl = href;
    try {
        await fetch(href, {
            credentials: 'same-origin',
            cache: 'reload'
        });
    } catch (error) { }
}

function bindWaitingWorker(runtime, registration) {
    if (!registration?.waiting) return false;

    runtime.setActiveRegistration(registration);
    waitingWorker = registration.waiting;
    setUpdateReadyState(true);
    void warmCurrentPage();
    return true;
}

function watchInstallingWorker(runtime, registration) {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            bindWaitingWorker(runtime, registration);
        }
    });
}

function scheduleRegistrationUpdates(registration) {
    if (updateCheckTimer) return;

    updateCheckTimer = window.setInterval(() => {
        registration.update().catch(() => { });
    }, UPDATE_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            registration.update().catch(() => { });
        }
    });
}

async function applyWaitingWorker(runtime) {
    const activeRegistration = runtime.getActiveRegistration();
    if (!activeRegistration) return;

    if (!waitingWorker) {
        await activeRegistration.update().catch(() => { });
        if (!bindWaitingWorker(runtime, activeRegistration)) {
            window.location.reload();
            return;
        }
    }

    reloadOnControllerChange = true;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

async function handleEnableMode(runtime) {
    try {
        // updateViaCache=none 让浏览器检查 /sw.js 时绕过 HTTP 缓存，尽快发现新 worker。
        const registration = await navigator.serviceWorker.register(runtime.swUrl, {
            scope: runtime.swScope,
            updateViaCache: 'none'
        });
        runtime.setActiveRegistration(registration);

        const hasWaitingWorker = bindWaitingWorker(runtime, registration);
        if (hasWaitingWorker && isReloadNavigation()) {
            void applyWaitingWorker(runtime);
            return;
        }

        watchInstallingWorker(runtime, registration);
        registration.addEventListener('updatefound', () => {
            watchInstallingWorker(runtime, registration);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloadOnControllerChange) {
                window.location.reload();
            }
        });

        scheduleRegistrationUpdates(registration);
        navigator.serviceWorker.ready.then((readyRegistration) => {
            if (readyRegistration?.active) {
                runtime.setActiveRegistration(readyRegistration);
            }
        }).catch(() => { });
    } catch (error) { }
}

function bindUpdateUi(runtime) {
    document.addEventListener('click', (event) => {
        if (root.getAttribute(UPDATE_STATE_ATTR) !== UPDATE_STATE_READY) return;

        const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
        const breadcrumbLink = getBreadcrumbCurrentLink();
        if (!isUsableUpdateAnchor(breadcrumbLink)) return;

        if (anchor === breadcrumbLink) {
            event.preventDefault();
            void showUpdatePopover(breadcrumbLink);
            return;
        }

        if (updatePopover && !updatePopover.hidden) {
            const clickTarget = event.target instanceof Element ? event.target : null;
            if (clickTarget && !updatePopover.contains(clickTarget)) {
                hideUpdatePopover();
            }
        }
    }, true);

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideUpdatePopover();
        }
    });

    window.addEventListener('resize', () => {
        if (updatePopover && !updatePopover.hidden && updatePopoverAnchor) {
            positionUpdatePopover(updatePopoverAnchor);
        }
    });

    window.addEventListener('scroll', () => {
        if (updatePopover && !updatePopover.hidden && updatePopoverAnchor) {
            positionUpdatePopover(updatePopoverAnchor);
        }
    }, true);
}

export function startEnableMode(runtime) {
    if (!runtime?.supportsServiceWorker()) return;
    if (enableModeStarted) return;

    enableModeStarted = true;
    activeRuntime = runtime;
    bindUpdateUi(runtime);

    if (document.readyState === 'complete') {
        void handleEnableMode(runtime);
        return;
    }

    window.addEventListener('load', () => {
        void handleEnableMode(runtime);
    }, { once: true });
}
