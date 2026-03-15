export function createServiceWorkerManagerRuntime(options = {}) {
    const swUrl = typeof options.swUrl === 'string' && options.swUrl ? options.swUrl : '/sw.js';
    const swScope = typeof options.swScope === 'string' && options.swScope ? options.swScope : '/';
    const updateStyleUrl = typeof options.updateStyleUrl === 'string' && options.updateStyleUrl ? options.updateStyleUrl : '';
    const existingRuntime = window.BanyanServiceWorkerManagerRuntime;
    if (
        existingRuntime
        && existingRuntime.swUrl === swUrl
        && existingRuntime.swScope === swScope
        && existingRuntime.updateStyleUrl === updateStyleUrl
    ) {
        return existingRuntime;
    }

    let activeRegistration = null;
    let updateStylePromise = null;

    function supportsServiceWorker() {
        return 'serviceWorker' in navigator;
    }

    function normalizeNavigationUrl(rawUrl) {
        try {
            const url = new URL(rawUrl, window.location.href);
            if (!/^https?:$/.test(url.protocol)) return '';
            if (url.origin !== window.location.origin) return '';
            url.hash = '';
            return url.toString();
        } catch (error) {
            return '';
        }
    }

    function getActiveRegistration() {
        return activeRegistration;
    }

    function setActiveRegistration(registration) {
        activeRegistration = registration || null;
        return activeRegistration;
    }

    function ensureUpdateStyle() {
        if (!updateStyleUrl) return Promise.resolve('');

        const existingLink = document.head.querySelector(`link[rel="stylesheet"][href="${updateStyleUrl}"]`);
        if (existingLink) return Promise.resolve(updateStyleUrl);
        if (updateStylePromise) return updateStylePromise;

        updateStylePromise = new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = updateStyleUrl;
            link.addEventListener('load', () => resolve(updateStyleUrl), { once: true });
            link.addEventListener('error', () => resolve(''), { once: true });
            document.head.appendChild(link);
        });

        return updateStylePromise;
    }

    async function getActiveWorkerRegistration() {
        if (activeRegistration?.active) return activeRegistration;

        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration?.active) {
                activeRegistration = registration;
                return registration;
            }
        } catch (error) { }

        return null;
    }

    const runtime = {
        ensureUpdateStyle,
        getActiveRegistration,
        getActiveWorkerRegistration,
        normalizeNavigationUrl,
        setActiveRegistration,
        supportsServiceWorker,
        swScope,
        updateStyleUrl,
        swUrl
    };

    window.BanyanServiceWorkerManagerRuntime = runtime;
    return runtime;
}
