import { renderRootSelection } from './root-navigation.js';
import {
    buildBreadcrumbColumnItems,
    buildCollectionPageHref,
    buildSelectedBreadcrumbItem,
    getSourceSortVariant,
    normalizeBreadcrumbCollectionSource as normalizeCollectionSource,
} from './breadcrumb-items.js';
import {
    parseEntryBreadcrumbSources,
    parseEntrySelection,
} from './breadcrumb-source.js';
import {
    renderTopBreadcrumb,
} from './breadcrumb-ui.js';
import {
    normalizeCollectionLogicalPathFromUrl as normalizeLogicalPathFromUrl,
    normalizePathname,
    readCurrentFromPath,
} from './nav-state.js';
import { getRuntimeFragmentRoot } from './runtime-manifest.js';

const ENTRY_BREADCRUMB_PREVIEW_PENDING_ATTR = 'data-entry-breadcrumb-preview-pending';
const ENTRY_BREADCRUMB_RUNTIME_PENDING_ATTR = 'data-entry-breadcrumb-runtime-pending';

function clearEntryBreadcrumbPending() {
    document.documentElement?.removeAttribute(ENTRY_BREADCRUMB_PREVIEW_PENDING_ATTR);
    document.documentElement?.removeAttribute(ENTRY_BREADCRUMB_RUNTIME_PENDING_ATTR);
}

async function buildPrefixLevelItem(fragmentRoot, source, level) {
    const baseItem = level?.item && typeof level.item === 'object'
        ? { ...level.item }
        : null;
    if (!baseItem) {
        return null;
    }

    const currentCollectionSource = normalizeCollectionSource(source?.currentCollectionSource) || null;
    const sortVariant = currentCollectionSource?.sortVariant || getSourceSortVariant(source);
    const defaultSort = currentCollectionSource?.defaultSort || '';
    const siteRoot = document.body?.dataset.siteRoot || '/';

    let targetLogicalPath = '';
    let targetPathname = '';
    try {
        const targetUrl = new URL(baseItem.href, window.location.origin);
        targetLogicalPath = normalizeLogicalPathFromUrl(targetUrl, siteRoot);
        targetPathname = normalizePathname(targetUrl.pathname);
    } catch (error) {
        targetLogicalPath = '';
        targetPathname = '';
    }

    const result = {
        ...baseItem,
        text: baseItem.text,
        href: targetLogicalPath
            ? buildCollectionPageHref(baseItem.href, targetLogicalPath, sortVariant, defaultSort)
            : baseItem.href,
        current: false,
    };
    if (baseItem.title) {
        result.title = baseItem.title;
    }

    const collectionSource = normalizeCollectionSource(level?.collectionSource) || null;
    if (collectionSource) {
        result.collection_source = collectionSource;
        result.collection_href = collectionSource.href || baseItem.href;
        const columnItems = await buildBreadcrumbColumnItems(fragmentRoot, collectionSource, {
            selectedPathname: targetPathname,
        });
        if (columnItems.length > 0) {
            result.column_items = columnItems;
        }
        return result;
    }

    if (Array.isArray(baseItem.column_items) && baseItem.column_items.length > 0) {
        result.column_items = baseItem.column_items;
    }

    return result;
}

async function buildPrefixItems(fragmentRoot, source) {
    const levels = Array.isArray(source?.levels) ? source.levels : [];
    if (levels.length > 0) {
        const items = (await Promise.all(levels.map((level) => buildPrefixLevelItem(fragmentRoot, source, level)))).filter(Boolean);
        if (items.length > 0) {
            return items;
        }
    }

    return Array.isArray(source?.tailItems)
        ? source.tailItems.map((item) => ({ ...item, current: false }))
        : [];
}

function buildBreadcrumbItems(prefixItems, currentItem) {
    const safePrefixItems = Array.isArray(prefixItems) ? prefixItems : [];
    return [...safePrefixItems, currentItem];
}

async function buildEntryState() {
    const fragmentRoot = await getRuntimeFragmentRoot();
    if (!fragmentRoot) {
        return null;
    }

    const rawSources = document.body?.dataset.entryBreadcrumbSources || '';
    const sources = parseEntryBreadcrumbSources(rawSources);
    const selection = parseEntrySelection(sources, readCurrentFromPath());
    if (!selection) {
        return null;
    }

    const prefixItemsPromise = buildPrefixItems(fragmentRoot, selection.source);
    const currentPathname = normalizePathname(window.location.pathname);
    const currentItem = await buildSelectedBreadcrumbItem(
        fragmentRoot,
        selection.source,
        currentPathname,
        document.body?.dataset.currentPageTitle || ''
    );
    if (!currentItem) {
        return null;
    }

    const resolvedPathname = normalizePathname(new URL(currentItem.href, window.location.origin).pathname);
    if (currentPathname !== resolvedPathname) {
        return null;
    }

    const prefixItems = await prefixItemsPromise;
    const breadcrumbItems = buildBreadcrumbItems(prefixItems, currentItem);
    return {
        rootItem: selection.source.rootItem,
        breadcrumbItems,
    };
}

export async function initEntryBreadcrumb() {
    try {
        const state = await buildEntryState();
        if (!state || !Array.isArray(state.breadcrumbItems) || state.breadcrumbItems.length === 0) {
            return;
        }

        renderRootSelection(state.rootItem);
        renderTopBreadcrumb(state.breadcrumbItems);
    } finally {
        clearEntryBreadcrumbPending();
    }
}
