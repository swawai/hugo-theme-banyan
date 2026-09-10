import {
    parseEntrySelection,
    readEntryBreadcrumbSources,
} from './breadcrumb-source.js';
import { readCurrentFromPath } from './navigation-state.js';

export function renderRootSelection(rootItem) {
    const navigation = document.querySelector('[data-root-navigation]');
    if (!navigation) return;
    const href = rootItem?.href || navigation.dataset.defaultRootHref || '';
    navigation.querySelectorAll('[data-root-href]').forEach((link) => {
        const current = link.dataset.rootHref === href;
        link.classList.toggle('is-current', current);
        if (current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

export function refreshRootSelection() {
    const sources = readEntryBreadcrumbSources();
    const source = parseEntrySelection(sources, readCurrentFromPath())?.source;
    renderRootSelection(source?.rootItem);
}

export function initRootNavigation() {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) refreshRootSelection();
    });
    window.addEventListener('popstate', refreshRootSelection);
}
