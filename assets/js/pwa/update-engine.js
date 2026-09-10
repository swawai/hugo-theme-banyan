import { isManagedCacheKey } from './cache-names.js';

const SW_ACTIVATION_TIMEOUT_MS = 4000;

let waitingWorker = null;
let reloadOnControllerChange = false;
let updateCheckTimer = null;
let warmedCurrentUrl = '';
let updateController = null;
const statusListeners = new Set();
let updateStatus = 'idle';
let updateLatencyMs = null;
let updateCheckPromise = null;
let activationFallbackTimer = null;

function publishUpdateStatus() {
    for (const listener of statusListeners) listener({ status: updateStatus, latencyMs: updateLatencyMs });
}

function setUpdateReadyState(ready) {
    if (ready) {
        updateStatus = 'ready';
    } else if (updateStatus === 'ready') {
        updateStatus = 'idle';
    }
    publishUpdateStatus();
}

async function checkForUpdates(runtime) {
    if (updateStatus === 'unavailable') return;
    if (updateStatus === 'ready') {
        await applyWaitingWorker(runtime);
        return;
    }

    if (updateCheckPromise) return updateCheckPromise;

    if (navigator.onLine === false) {
        updateLatencyMs = null;
        updateStatus = 'offline';
        publishUpdateStatus();
        return;
    }

    const checkStartedAt = performance.now();
    updateLatencyMs = null;
    updateStatus = 'checking';
    updateCheckPromise = (async () => {
        try {
            publishUpdateStatus();
            const registration = runtime.getActiveRegistration() || await navigator.serviceWorker.getRegistration(runtime.swScope);
            if (!registration) {
                updateLatencyMs = null;
                updateStatus = 'failed';
                publishUpdateStatus();
                return;
            }

            await registration.update();
            updateLatencyMs = Math.max(0, performance.now() - checkStartedAt);
            if (bindWaitingWorker(runtime, registration)) {
                updateStatus = 'ready';
                publishUpdateStatus();
                return;
            }

            updateStatus = 'current';
            publishUpdateStatus();
        } catch (error) {
            updateLatencyMs = null;
            updateStatus = navigator.onLine === false ? 'offline' : 'failed';
            publishUpdateStatus();
        } finally {
            updateCheckPromise = null;
        }
    })();

    return updateCheckPromise;
}

function clearActivationFallbackTimer() {
    if (!activationFallbackTimer) return;

    window.clearTimeout(activationFallbackTimer);
    activationFallbackTimer = null;
}

async function clearManagedCaches() {
    if (!('caches' in window)) return;

    try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(isManagedCacheKey).map((key) => caches.delete(key)));
    } catch (error) { }
}

function isReloadNavigation() {
    try {
        const entry = performance.getEntriesByType('navigation')[0];
        if (entry?.type) return entry.type === 'reload';
    } catch (error) { }

    try {
        return performance.navigation && performance.navigation.type === 1;
    } catch (error) {
        return false;
    }
}

async function warmCurrentPage(runtime) {
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = '';
    const href = currentUrl.toString();
    if (warmedCurrentUrl === href) return;

    warmedCurrentUrl = href;
    try {
        const registration = runtime ? await runtime.getActiveWorkerRegistration() : null;
        const worker = registration?.active || null;
        if (!worker) return;

        worker.postMessage({
            type: 'WARM_NAV_BATCH',
            urls: [href]
        });
    } catch (error) { }
}

function bindWaitingWorker(runtime, registration) {
    if (!registration?.waiting) return false;

    runtime.setActiveRegistration(registration);
    waitingWorker = registration.waiting;
    setUpdateReadyState(true);
    void warmCurrentPage(runtime);
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

function markBackgroundUpdateChecked(runtime, registration) {
    if (bindWaitingWorker(runtime, registration)) return;
    updateLatencyMs = null;
    if (updateStatus !== 'ready') updateStatus = 'current';
    publishUpdateStatus();
}

function scheduleRegistrationUpdates(runtime, registration) {
    if (updateCheckTimer) return;

    const intervalMs = runtime.updateCheckInterval || 15 * 60 * 1000;
    const throttleMs = runtime.updateVisibilityThrottle || 3 * 60 * 1000;

    updateCheckTimer = window.setInterval(() => {
        registration.update()
            .then(() => markBackgroundUpdateChecked(runtime, registration))
            .catch(() => { });
    }, intervalMs);

    let lastUpdateCheck = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;

        const now = Date.now();
        if (now - lastUpdateCheck <= throttleMs) return;

        lastUpdateCheck = now;
        registration.update()
            .then(() => markBackgroundUpdateChecked(runtime, registration))
            .catch(() => { });
    });
}

async function resolveWaitingWorker(runtime, registration) {
    if (registration?.waiting) {
        runtime.setActiveRegistration(registration);
        waitingWorker = registration.waiting;
        setUpdateReadyState(true);
        void warmCurrentPage(runtime);
    }

    if (waitingWorker && waitingWorker.state !== 'redundant') return waitingWorker;

    waitingWorker = null;
    await registration?.update().catch(() => { });
    if (bindWaitingWorker(runtime, registration)) return waitingWorker;
    return null;
}

async function recoverStuckWaitingWorker(registration) {
    clearActivationFallbackTimer();
    waitingWorker = null;
    reloadOnControllerChange = false;
    setUpdateReadyState(false);

    try {
        await registration?.unregister();
    } catch (error) { }

    await clearManagedCaches();
    window.location.reload();
}

function scheduleActivationFallback(runtime, registration, expectedWorker) {
    clearActivationFallbackTimer();

    activationFallbackTimer = window.setTimeout(() => {
        void (async () => {
            try {
                if (!reloadOnControllerChange) return;

                const currentRegistration = runtime.getActiveRegistration() || registration;
                if (!currentRegistration) {
                    window.location.reload();
                    return;
                }

                await currentRegistration.update().catch(() => { });
                if (currentRegistration.waiting === expectedWorker) {
                    await recoverStuckWaitingWorker(currentRegistration);
                    return;
                }

                window.location.reload();
            } catch (error) {
                window.location.reload();
            }
        })();
    }, SW_ACTIVATION_TIMEOUT_MS);
}

async function applyWaitingWorker(runtime) {
    const activeRegistration = runtime.getActiveRegistration();
    if (!activeRegistration) return;

    const targetWaitingWorker = await resolveWaitingWorker(runtime, activeRegistration);
    if (!targetWaitingWorker) {
        window.location.reload();
        return;
    }

    setUpdateReadyState(false);
    reloadOnControllerChange = true;
    scheduleActivationFallback(runtime, activeRegistration, targetWaitingWorker);

    try {
        targetWaitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
        await recoverStuckWaitingWorker(activeRegistration);
    }
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
            waitingWorker = null;
            clearActivationFallbackTimer();
            setUpdateReadyState(false);
            if (reloadOnControllerChange) window.location.reload();
        });

        scheduleRegistrationUpdates(runtime, registration);
        void warmCurrentPage(runtime);
        navigator.serviceWorker.ready.then((readyRegistration) => {
            if (readyRegistration?.active) runtime.setActiveRegistration(readyRegistration);
        }).catch(() => { });
    } catch (error) { }
}

// The engine owns SW state; the update page subscribes without loading its UI globally.
export function startEnableMode(runtime) {
    if (updateController) return updateController;
    updateController = {
        subscribe(listener) {
            statusListeners.add(listener);
            listener({ status: updateStatus, latencyMs: updateLatencyMs });
            return () => statusListeners.delete(listener);
        },
        check: () => checkForUpdates(runtime)
    };
    if (!runtime?.supportsServiceWorker()) {
        updateStatus = 'unavailable';
        return updateController;
    }
    if (document.readyState === 'complete') void handleEnableMode(runtime);
    else window.addEventListener('load', () => void handleEnableMode(runtime), { once: true });
    return updateController;
}
