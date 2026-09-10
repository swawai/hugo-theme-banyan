export function createServiceWorkerManagerRuntime(options = {}) {
    const swUrl = typeof options.swUrl === 'string' && options.swUrl ? options.swUrl : '/sw.js';
    const swScope = typeof options.swScope === 'string' && options.swScope ? options.swScope : '/';
    const updateCheckInterval = Number.isFinite(options.updateCheckInterval) && options.updateCheckInterval > 0
        ? options.updateCheckInterval
        : 15 * 60 * 1000;
    const updateVisibilityThrottle = Number.isFinite(options.updateVisibilityThrottle) && options.updateVisibilityThrottle > 0
        ? options.updateVisibilityThrottle
        : 3 * 60 * 1000;
    const existingRuntime = window.BanyanServiceWorkerManagerRuntime;
    if (
        existingRuntime
        && existingRuntime.swUrl === swUrl
        && existingRuntime.swScope === swScope
        && existingRuntime.updateCheckInterval === updateCheckInterval
        && existingRuntime.updateVisibilityThrottle === updateVisibilityThrottle
    ) {
        return existingRuntime;
    }

    let currentRegistration = null;

    function supportsServiceWorker() {
        return 'serviceWorker' in navigator;
    }

    function getActiveRegistration() {
        return currentRegistration;
    }

    function setActiveRegistration(registration) {
        currentRegistration = registration || null;
        return currentRegistration;
    }

    async function getActiveWorkerRegistration() {
        if (currentRegistration?.active) return currentRegistration;

        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration?.active) {
                currentRegistration = registration;
                return registration;
            }
        } catch (error) { }

        return null;
    }

    const runtime = {
        getActiveRegistration,
        getActiveWorkerRegistration,
        setActiveRegistration,
        supportsServiceWorker,
        swScope,
        updateCheckInterval,
        updateVisibilityThrottle,
        swUrl
    };

    window.BanyanServiceWorkerManagerRuntime = runtime;
    return runtime;
}
