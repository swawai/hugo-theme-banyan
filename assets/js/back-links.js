export function initBackLinks() {
    // Retire old settings URLs without reading or retaining their return address.
    if (document.querySelector('[data-system-page]')) {
        const url = new URL(window.location.href);
        if (url.searchParams.has('return')) {
            url.searchParams.delete('return');
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
    }

    document.querySelectorAll('a[data-page-action="back"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (window.history.length > 1) {
                event.preventDefault();
                window.history.back();
            }
            // A new tab has no prior page; the link's normal href is its language home.
        });
    });
}
