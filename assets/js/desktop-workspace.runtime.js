import { bindListSortRoots } from './list-sort.shared.js';

(function () {
    const AXIS_QUERY_KEY = 'axis';
    const CONTEXT_QUERY_KEY = 'context';
    const body = document.body;
    if (!body || readBodyValue('Enabled') !== 'true') {
        return;
    }

    const shell = document.querySelector('[data-desktop-workspace-shell]');
    const columnsSlot = document.querySelector('[data-desktop-workspace-columns]');
    const metaSlot = document.querySelector('[data-desktop-workspace-meta]');
    const desktopUrl = readBodyValue('Url');
    const cssUrl = readBodyValue('CssUrl');

    if (!shell || !columnsSlot || !metaSlot) {
        return;
    }

    ensureStylesheet(cssUrl);

    if (hydrateExistingContent()) {
        applyUrlArticleContext();
        return;
    }

    if (!desktopUrl) {
        return;
    }

    fetch(desktopUrl, { credentials: 'same-origin' })
        .then((res) => {
            if (!res || !res.ok) throw new Error('desktop fragment request failed');
            return res.text();
        })
        .then((html) => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const columns = doc.querySelector('[data-region="columns"]');
            const meta = doc.querySelector('[data-region="meta"]');

            const columnMarkup = columns?.innerHTML?.trim() || '';
            const metaMarkup = meta?.innerHTML?.trim() || '';

            columnsSlot.innerHTML = columnMarkup;
            metaSlot.innerHTML = metaMarkup;
            columnsSlot.hidden = !columnMarkup;
            metaSlot.hidden = !metaMarkup;
            hydrateExistingContent();
            applyUrlArticleContext();
        })
        .catch(() => {
            body.dataset.desktopWorkspaceHydrated = 'false';
        });

    function ensureStylesheet(href) {
        if (!href) return;
        if (document.querySelector(`link[data-desktop-workspace-css="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-desktop-workspace-css', href);
        document.head.appendChild(link);
    }

    function hydrateExistingContent() {
        const columnMarkup = columnsSlot.innerHTML.trim();
        const metaMarkup = metaSlot.innerHTML.trim();

        if (!columnMarkup && !metaMarkup) {
            return false;
        }

        columnsSlot.hidden = !columnMarkup;
        metaSlot.hidden = !metaMarkup;

        bindListSortRoots(columnsSlot);

        body.dataset.desktopWorkspaceHydrated = 'true';
        setActiveState(readBodyValue('Axis') || '', readBodyValue('Context') || '');
        updateAxisAwareLinks();
        return true;
    }

    function applyUrlArticleContext() {
        if ((readBodyValue('Kind') || '') !== 'leaf') {
            return false;
        }

        const requested = readRequestedAxisContext();
        if (!requested || (requested.axis !== 'tags' && requested.axis !== 'udc') || !requested.contextUrl) {
            setActiveState(readBodyValue('Axis') || '', readBodyValue('Context') || '');
            updateAxisAwareLinks();
            return false;
        }

        const templates = Array.from(document.querySelectorAll('template[data-desktop-workspace-axis][data-desktop-workspace-context]'));
        const match = templates.find((template) => (
            template.dataset.desktopWorkspaceAxis === requested.axis
            && template.dataset.desktopWorkspaceContext === requested.contextUrl
        ));

        if (!match) {
            setActiveState(readBodyValue('Axis') || '', readBodyValue('Context') || '');
            updateAxisAwareLinks();
            return false;
        }

        const markup = match.innerHTML.trim();
        if (!markup) {
            return false;
        }

        columnsSlot.innerHTML = markup;
        columnsSlot.hidden = false;
        bindListSortRoots(columnsSlot);
        setActiveState(requested.axis, requested.contextUrl);
        updateAxisAwareLinks();
        return true;
    }

    function readRequestedAxisContext() {
        try {
            const params = new URLSearchParams(window.location.search);
            const axis = (params.get(AXIS_QUERY_KEY) || '').toLowerCase();
            const contextUrl = normalizeContextUrl(params.get(CONTEXT_QUERY_KEY) || '');
            return { axis, contextUrl };
        } catch (error) {
            return null;
        }
    }

    function normalizeContextUrl(value) {
        if (!value) return '';
        try {
            const url = new URL(value, window.location.origin);
            if (url.origin !== window.location.origin) return '';
            let path = url.pathname || '';
            if (!path) return '';
            if (path !== '/' && !path.endsWith('/')) path += '/';
            return path;
        } catch (error) {
            return '';
        }
    }

    function updateAxisAwareLinks() {
        const axis = readActiveValue('Axis') || readBodyValue('Axis') || '';
        const contextUrl = normalizeContextUrl(readActiveValue('Context') || readBodyValue('Context') || '');
        const links = Array.from(document.querySelectorAll(
            '[data-desktop-workspace-columns] a[href][data-kind="page"], #main a[href][data-workspace-kind="page"]'
        ));

        links.forEach((link) => {
            const baseHref = link.dataset.workspaceBaseHref || link.getAttribute('href') || '';
            if (!baseHref) return;
            if (!link.dataset.workspaceBaseHref) {
                link.dataset.workspaceBaseHref = baseHref;
            }
            link.setAttribute('href', buildAxisAwareHref(baseHref, axis, contextUrl));
        });
    }

    function buildAxisAwareHref(href, axis, contextUrl) {
        let url;
        try {
            url = new URL(href, window.location.href);
        } catch (error) {
            return href;
        }

        if (url.origin !== window.location.origin) {
            return href;
        }

        if ((axis === 'tags' || axis === 'udc') && contextUrl) {
            url.searchParams.set(AXIS_QUERY_KEY, axis);
            url.searchParams.set(CONTEXT_QUERY_KEY, contextUrl);
        } else {
            url.searchParams.delete(AXIS_QUERY_KEY);
            url.searchParams.delete(CONTEXT_QUERY_KEY);
        }

        return `${url.pathname}${url.search}${url.hash}`;
    }

    function readBodyValue(name) {
        return body.dataset[`desktopWorkspace${name}`] || '';
    }

    function readActiveValue(name) {
        return body.dataset[`desktopWorkspaceActive${name}`] || '';
    }

    function setActiveState(axis, context) {
        body.dataset.desktopWorkspaceActiveAxis = axis;
        body.dataset.desktopWorkspaceActiveContext = context;
    }
})();
