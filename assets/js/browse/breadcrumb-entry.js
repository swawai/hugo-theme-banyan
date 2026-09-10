import {
    buildPathColumnItems,
    buildSelectedBreadcrumbItem,
} from './breadcrumb-items.js';
import { normalizeFromPath, normalizePathname, readCurrentFromPath } from './navigation-state.js';
import {
    pickSourceByLogicalPath,
    readEntryBreadcrumbSources,
    parseEntrySelection,
} from './breadcrumb-source.js';
import { readPageCollectionSource } from './collection-source.js';
import { renderPathColumns } from './path-render.js';

const ENTRY_BREADCRUMB_PENDING_ATTR = 'data-entry-breadcrumb-pending';
const BREADCRUMB_SORT_PENDING_ATTR = 'data-breadcrumb-sort-pending';

function buildLevelItems(source) {
    const levels = Array.isArray(source?.levels) ? source.levels : [];
    return levels
        .map((level) => {
            const item = level?.item && typeof level.item === 'object'
                ? { ...level.item, current: false }
                : null;
            if (!item) {
                return null;
            }

            const collectionSource = level.collectionSource;
            if (collectionSource) {
                item.collection_source = collectionSource;
                item.collection_href = collectionSource.href || item.href;

                let selectedPathname = '';
                try {
                    selectedPathname = normalizePathname(new URL(item.href, window.location.origin).pathname);
                } catch (error) { }

                const columnItems = buildPathColumnItems(
                    level.collectionItems,
                    collectionSource,
                    { selectedPathname }
                );
                if (columnItems.length > 0) {
                    item.column_items = columnItems;
                }
            }

            return item;
        })
        .filter(Boolean);
}

export function buildCurrentPathItem(source, currentText, currentTitle, currentHref) {
    let selectedPathname = '';
    try {
        selectedPathname = normalizePathname(new URL(currentHref, window.location.origin).pathname);
    } catch (error) { }

    const selectedItem = buildSelectedBreadcrumbItem(source, selectedPathname, currentTitle);
    if (selectedItem) {
        return selectedItem;
    }
    if (!currentText || !currentHref) {
        return null;
    }

    return {
        text: currentText,
        title: currentTitle,
        href: currentHref,
        current: true,
    };
}

function buildEntryItems(source) {
    let items = buildLevelItems(source);
    if (items.length === 0) {
        items = Array.isArray(source?.tailItems)
            ? source.tailItems.map((item) => ({ ...item, current: false }))
            : [];
    }

    const body = document.body;
    const currentItem = buildCurrentPathItem(
        source,
        body?.dataset.currentPageText || document.title || '',
        body?.dataset.currentPageTitle || document.title || '',
        `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    if (currentItem) {
        items.push(currentItem);
    }
    return items;
}

function buildCollectionPathItems(sources, requiredAncestorPath = '') {
    const pageCollectionSource = readPageCollectionSource();
    const requiredAncestor = normalizeFromPath(requiredAncestorPath);
    if (
        requiredAncestor
        && !pageCollectionSource?.logicalPath?.startsWith(requiredAncestor)
    ) {
        return [];
    }
    const source = pageCollectionSource
        ? pickSourceByLogicalPath(sources, pageCollectionSource.logicalPath)
        : null;
    return source ? buildLevelItems(source) : [];
}

function clearPending(name) {
    document.documentElement?.removeAttribute(name);
}

export function initializeBreadcrumb() {
    const html = document.documentElement;
    const entryPending = html.getAttribute(ENTRY_BREADCRUMB_PENDING_ATTR) === 'true';
    const sortPending = html.getAttribute(BREADCRUMB_SORT_PENDING_ATTR) === 'true';
    const result = { entryRendered: false, sortRendered: false };
    if (!entryPending && !sortPending) {
        return result;
    }

    try {
        const sources = readEntryBreadcrumbSources();
        if (entryPending) {
            const fromPath = readCurrentFromPath();
            const selection = parseEntrySelection(sources, fromPath);
            // A collection URL may name its ancestor in `from` while its source model is
            // keyed by the current collection. In that case only its ancestor columns
            // belong in the path; the current collection is already the main column.
            const items = selection
                ? buildEntryItems(selection.source)
                : buildCollectionPathItems(sources, fromPath);
            result.entryRendered = renderPathColumns(items);
        }

        if (sortPending) {
            result.sortRendered = renderPathColumns(buildCollectionPathItems(sources));
        }
    } finally {
        if (entryPending) clearPending(ENTRY_BREADCRUMB_PENDING_ATTR);
        if (sortPending) clearPending(BREADCRUMB_SORT_PENDING_ATTR);
    }

    return result;
}
