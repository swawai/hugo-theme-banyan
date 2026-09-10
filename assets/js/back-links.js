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
