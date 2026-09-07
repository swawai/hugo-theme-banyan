import { NAVIGATION_STATE_CHANGE_EVENT } from '../navigation-events.js';

// A settings return address is separate from the article collection's `from` state.
export function localUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
        const url = new URL(value, window.location.href);
        return url.origin === window.location.origin && /^https?:$/.test(url.protocol)
            && !url.username && !url.password ? url : null;
    } catch { return null; }
}

export function settingsReturnUrl() {
    return localUrl(new URL(window.location.href).searchParams.get('return'));
}

export function initSettingsNavigation() {
    const isSettingsPage = Boolean(document.querySelector('[data-system-page]'));
    const source = isSettingsPage ? settingsReturnUrl() : new URL(window.location.href);
    const refreshLinks = () => {
        const returnTarget = isSettingsPage ? source : new URL(window.location.href);
        document.querySelectorAll('a[data-settings-link]').forEach((link) => {
            const url = localUrl(link.href);
            if (!url) return;
            url.searchParams.delete('return');
            if (returnTarget) url.searchParams.set('return', returnTarget.pathname + returnTarget.search + returnTarget.hash);
            link.href = url.pathname + url.search;
        });
        document.querySelectorAll('[data-settings-return]').forEach((link) => {
            link.hidden = !source;
            if (source) link.href = source.pathname + source.search + source.hash;
        });
    };
    refreshLinks();
    document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('[data-settings-link]')) refreshLinks();
    }, true);
    document.addEventListener(NAVIGATION_STATE_CHANGE_EVENT, refreshLinks);
    window.addEventListener('hashchange', refreshLinks);
    window.addEventListener('popstate', refreshLinks);
    window.addEventListener('pageshow', refreshLinks);
}
