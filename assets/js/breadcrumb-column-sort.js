import {
    buildPathColumnItems,
    buildCollectionSortToggleHref,
    normalizeBreadcrumbCollectionSource,
} from './breadcrumb-items.js';
import {
    parseCollectionSourceIndex,
    pickCollectionSourceByHref,
} from './breadcrumb-source.js';
import { renderPathColumn } from './path-navigation-ui.js';
import {
    getLogicalPathDepth,
    normalizePathname,
    readCurrentFromPath,
} from './navigation-state.js';
import { getRuntimeFragmentRoot } from './runtime-manifest.js';
import { NAVIGATION_STATE_CHANGE_EVENT } from './navigation-events.js';

let collectionSourceIndex = null;
let renderId = 0;
let interactionId = 0;

function readPageCollectionSource() {
    const raw = document.body?.dataset.pageCollectionSource || '';
    if (!raw) {
        return null;
    }

    try {
        return normalizeBreadcrumbCollectionSource(JSON.parse(raw));
    } catch (error) {
        return null;
    }
}

function readCollectionSourceIndex() {
    if (collectionSourceIndex instanceof Map) {
        return collectionSourceIndex;
    }

    const pageCollectionSource = readPageCollectionSource();
    collectionSourceIndex = parseCollectionSourceIndex(
        document.body?.dataset.entryBreadcrumbSources || '',
        pageCollectionSource ? [pageCollectionSource] : []
    );
    return collectionSourceIndex;
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

export async function refreshBreadcrumbCollectionColumns() {
    const fragmentRoot = await getRuntimeFragmentRoot();
    if (!fragmentRoot) {
        return;
    }

    const wrappers = Array.from(document.querySelectorAll(
        '.slot-breadcrumb [data-collection-column]'
    ));
    if (wrappers.length === 0) {
        return;
    }

    const sourceIndex = readCollectionSourceIndex();
    const lineageLogicalPath = readVisibleLineageLogicalPath(sourceIndex);
    const currentRenderId = ++renderId;

    await Promise.all(wrappers.map(async (wrapper) => {
        const collectionSource = readWrapperCollectionSource(wrapper, sourceIndex);
        if (!collectionSource?.logicalPath) {
            return;
        }

        const link = wrapper.querySelector('a.path-column-link[aria-current="page"][href]');
        if (!(link instanceof HTMLAnchorElement)) {
            return;
        }

        const selectedPathname = normalizePathname(
            new URL(link.href, window.location.origin).pathname
        );
        const columnItems = await buildPathColumnItems(
            fragmentRoot,
            collectionSource,
            { selectedPathname }
        );
        if (currentRenderId !== renderId || columnItems.length === 0) {
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
    }));
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
        const currentInteractionId = ++interactionId;
        const shouldRestoreFocus = document.activeElement === toggle;
        window.history.replaceState(window.history.state, '', nextHref);
        document.dispatchEvent(new Event(NAVIGATION_STATE_CHANGE_EVENT));
        void refreshBreadcrumbCollectionColumns().then(() => {
            if (!shouldRestoreFocus || currentInteractionId !== interactionId) {
                return;
            }

            const nextToggle = wrapper.querySelector(
                'a[data-collection-sort-toggle="true"]'
            );
            if (nextToggle instanceof HTMLElement) {
                nextToggle.focus({ preventScroll: true });
            }
        });
    });
}
