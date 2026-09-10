const navigationKey = 'banyan:canvas-navigation';

// Carry only the horizontal position of one same-tab collection navigation.
// History traversal and reload keep the browser's own restoration on both axes.
export function initCanvasPosition() {
    let pending;
    try {
        const raw = sessionStorage[navigationKey];
        delete sessionStorage[navigationKey];
        pending = JSON.parse(raw);
    } catch { /* Navigation remains usable when storage is unavailable. */ }

    // Window bubbling runs after the collection's sorting/link handlers.
    window.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0
            || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest?.('[data-collection-entry][href], [data-slot="breadcrumb"] a[href]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        if (link.origin !== location.origin || link.hash || link.href === location.href) return;
        try {
            sessionStorage[navigationKey] = JSON.stringify({
                source: location.href.split('#')[0],
                target: link.href,
                x: window.visualViewport?.pageLeft ?? scrollX
            });
        } catch { /* Do not block the link if storage is unavailable. */ }
    });

    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation?.type !== 'navigate' || location.hash
        || pending?.target !== location.href || pending.source !== document.referrer
        || !Number.isFinite(pending.x) || pending.x <= 0) return;

    const lifecycle = new AbortController();
    const options = { capture: true, passive: true, signal: lifecycle.signal };
    function stop() {
        observer.disconnect();
        lifecycle.abort();
    }
    const observer = new MutationObserver(() => {
        const main = document.getElementById('main');
        if (!main) return;
        stop();
        // Early user input, an anchor or native restoration takes priority.
        if (location.hash || (window.visualViewport?.pageLeft ?? scrollX)
            || (window.visualViewport?.pageTop ?? scrollY)) return;

        // Use the existing main track as a native scroll target at the saved x.
        // scrollIntoView moves the visual viewport too, unlike scrollTo on mobile.
        main.style.scrollMarginInlineStart = `${main.getBoundingClientRect().left + scrollX - pending.x}px`;
        main.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'instant' });
        main.style.scrollMarginInlineStart = '';
    });
    for (const name of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
        window.addEventListener(name, stop, options);
    }
    window.addEventListener('pagehide', stop, options);
    observer.observe(document.documentElement, { childList: true, subtree: true });
}
