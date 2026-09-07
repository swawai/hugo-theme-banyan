// Only a new document chooses an initial canvas position. Reload and history
// traversal retain the browser's own horizontal and vertical restoration.
export function initCanvasPosition() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation?.type !== 'navigate' || window.location.hash) return;

    const lifecycle = new AbortController();
    const options = { capture: true, passive: true, signal: lifecycle.signal };

    function stop() {
        observer.disconnect();
        lifecycle.abort();
    }

    function onInput(event) {
        if (event.isTrusted) stop();
    }

    const observer = new MutationObserver(() => {
        const main = document.getElementById('main');
        if (!main) return;
        stop();
        const scroller = document.scrollingElement;
        const viewport = window.visualViewport;
        // Input, an anchor, or another native scroll decision takes priority.
        if (!scroller || window.location.hash || scroller.scrollLeft || scroller.scrollTop
            || viewport?.pageLeft || viewport?.pageTop) return;

        // The rail and source-column skeleton precede main, whose width is
        // explicit. Position before the first frame that can show this column.
        const rect = main.getBoundingClientRect();
        const style = getComputedStyle(document.body);
        const viewportLeft = viewport?.offsetLeft || 0;
        const start = viewportLeft + (parseFloat(style.paddingLeft) || 0);
        const end = viewportLeft + (viewport?.width || document.documentElement.clientWidth) - (parseFloat(style.paddingRight) || 0);
        if (rect.right > end + 1 && rect.left > start + 1) {
            // The browser scrolls its layout or visual viewport as appropriate,
            // including the visual panning used by mobile browsers at 1x zoom.
            main.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'instant' });
        }
    });

    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach((name) => window.addEventListener(name, onInput, options));
    window.addEventListener('pagehide', stop, options);
    document.addEventListener('DOMContentLoaded', stop, options);
    observer.observe(document.documentElement, { childList: true, subtree: true });
}
