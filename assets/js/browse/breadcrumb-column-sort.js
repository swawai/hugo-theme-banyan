import {
    buildPathColumnItems,
    buildCollectionSortToggleHref,
} from './breadcrumb-items.js';
import {
    parseCollectionSourceIndex,
    pickCollectionItemsByHref,
    pickCollectionSourceByHref,
} from './breadcrumb-source.js';
import { renderPathColumn } from './path-render.js';
import { refreshMainCollectionNavigation } from './collection-navigation.js';
import {
    getLogicalPathDepth,
    normalizePathname,
    readCurrentFromPath,
} from './navigation-state.js';
let cachedCollectionSourceIndex = null;

function readCollectionSourceIndex() {
    if (cachedCollectionSourceIndex instanceof Map) {
        return cachedCollectionSourceIndex;
    }

    cachedCollectionSourceIndex = parseCollectionSourceIndex(
        document.body?.dataset.entryBreadcrumbSources || ''
    );
    return cachedCollectionSourceIndex;
}

function readWrapperCollectionSource(wrapper, sourceIndex = readCollectionSourceIndex()) {
    if (!(wrapper instanceof HTMLElement)) {
        return null;
    }

    return pickCollectionSourceByHref(
        sourceIndex,
        wrapper.dataset.breadcrumbCollectionHref || ''
    );
}

function readWrapperCollectionItems(wrapper, sourceIndex = readCollectionSourceIndex()) {
    if (!(wrapper instanceof HTMLElement)) {
        return null;
    }

    return pickCollectionItemsByHref(
        sourceIndex,
        wrapper.dataset.breadcrumbCollectionHref || ''
    );
}

function readVisibleLineageLogicalPath(sourceIndex = readCollectionSourceIndex()) {
    const currentFromPath = readCurrentFromPath();
    if (currentFromPath) {
        return currentFromPath;
    }

    return Array.from(document.querySelectorAll('.slot-breadcrumb [data-collection-column]'))
        .map((wrapper) => readWrapperCollectionSource(wrapper, sourceIndex)?.logicalPath || '')
        .reduce((deepest, logicalPath) => (
            getLogicalPathDepth(logicalPath) > getLogicalPathDepth(deepest)
                ? logicalPath
                : deepest
        ), '');
}

function isPlainPrimaryClick(event, link) {
    return !event.defaultPrevented
        && event.button === 0
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.shiftKey
        && !link.hasAttribute('download')
        && (!link.target || link.target === '_self');
}

function refreshBreadcrumbCollectionColumns(changedLogicalPath = '') {
    const wrappers = Array.from(document.querySelectorAll(
        '.slot-breadcrumb [data-collection-column]'
    ));
    if (wrappers.length === 0) {
        return;
    }

    const sourceIndex = readCollectionSourceIndex();
    const lineageLogicalPath = readVisibleLineageLogicalPath(sourceIndex);
    wrappers.forEach((wrapper) => {
        const collectionSource = readWrapperCollectionSource(wrapper, sourceIndex);
        if (!collectionSource?.logicalPath) {
            return;
        }
        if (changedLogicalPath && !collectionSource.logicalPath.startsWith(changedLogicalPath)) {
            return;
        }

        const link = wrapper.querySelector('a[data-collection-entry][aria-current="page"][href]');
        if (!(link instanceof HTMLAnchorElement)) {
            return;
        }

        const selectedPathname = normalizePathname(
            new URL(link.href, window.location.origin).pathname
        );
        const columnItems = buildPathColumnItems(
            readWrapperCollectionItems(wrapper, sourceIndex),
            collectionSource,
            { selectedPathname }
        );
        if (columnItems.length === 0) {
            return;
        }

        if (!columnItems.some((columnItem) => columnItem.current)) {
            return;
        }

        renderPathColumn(
            wrapper,
            columnItems,
            collectionSource,
            { lineageLogicalPath }
        );
    });
}

export function initBreadcrumbColumnSort() {
    document.addEventListener('click', (event) => {
        const toggle = event.target instanceof Element
            ? event.target.closest(
                'a[data-collection-sort-toggle="true"]'
            )
            : null;
        if (!(toggle instanceof HTMLAnchorElement) || !isPlainPrimaryClick(event, toggle)) {
            return;
        }

        const wrapper = toggle.closest('[data-collection-column]');
        const sourceIndex = readCollectionSourceIndex();
        const collectionSource = readWrapperCollectionSource(wrapper, sourceIndex);
        if (!collectionSource?.logicalPath) {
            return;
        }

        const lineageLogicalPath = readVisibleLineageLogicalPath(sourceIndex)
            || collectionSource.logicalPath;
        const nextHref = buildCollectionSortToggleHref(
            collectionSource,
            window.location.href,
            lineageLogicalPath
        );
        if (!nextHref) {
            return;
        }

        event.preventDefault();
        const restoreFocus = document.activeElement === toggle;
        window.history.replaceState(window.history.state, '', nextHref);
        refreshBreadcrumbCollectionColumns(collectionSource.logicalPath);
        refreshMainCollectionNavigation();
        if (restoreFocus) {
            const nextToggle = wrapper.querySelector('a[data-collection-sort-toggle="true"]');
            if (nextToggle instanceof HTMLElement) nextToggle.focus({ preventScroll: true });
        }
    });
}
