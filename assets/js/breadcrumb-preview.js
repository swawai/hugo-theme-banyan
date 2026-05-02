import {
    buildBreadcrumbMenuItemsFromDecodedRows,
    normalizeBreadcrumbCollectionSource,
} from './breadcrumb-items.js';
import { decodeItemsPayload } from './collection-items.js';
import { normalizePathname, readCurrentFromPath } from './nav-state.js';
import {
    parseEntryBreadcrumbSources,
    parseEntrySelection,
    pickSourceByLogicalPath,
} from './breadcrumb-source.js';
import { renderRootSelection, renderTopBreadcrumb } from './breadcrumb-ui.js';

const ENTRY_BREADCRUMB_PREVIEW_PENDING_ATTR = 'data-entry-breadcrumb-preview-pending';
const BREADCRUMB_SORT_PENDING_ATTR = 'data-breadcrumb-sort-pending';

function clearPreviewPending(previewPending, sortPending) {
    const html = document.documentElement;
    if (previewPending) {
        html.removeAttribute(ENTRY_BREADCRUMB_PREVIEW_PENDING_ATTR);
    }
    if (sortPending) {
        html.removeAttribute(BREADCRUMB_SORT_PENDING_ATTR);
    }
}

function buildMenuItemsFromPayload(payload, collectionSource, selection = {}) {
    const decoded = decodeItemsPayload(payload);
    if (!decoded || !collectionSource?.logicalPath) {
        return [];
    }

    return buildBreadcrumbMenuItemsFromDecodedRows(decoded, collectionSource, selection);
}

function buildPreviewLevelItems(source) {
    const levels = Array.isArray(source?.levels) ? source.levels : [];
    return levels
        .map((level) => {
            const item = level?.item && typeof level.item === 'object'
                ? { ...level.item }
                : null;
            if (!item) {
                return null;
            }

            if (level.collectionItems && level.collectionSource) {
                item.collection_source = level.collectionSource;
                item.collection_href = item.href;

                let selectedPathname = '';
                try {
                    selectedPathname = normalizePathname(new URL(item.href, window.location.origin).pathname);
                } catch (error) {
                    selectedPathname = '';
                }

                const menu = buildMenuItemsFromPayload(level.collectionItems, level.collectionSource, {
                    selectedPathname,
                });
                if (menu.length > 0) {
                    item.menu = menu;
                }
            }

            return item;
        })
        .filter(Boolean);
}

function buildPreviewCurrentItem(source, currentText, currentHref, entryKey) {
    const currentCollectionSource = normalizeBreadcrumbCollectionSource(source?.currentCollectionSource)
        || normalizeBreadcrumbCollectionSource(source);
    const currentCollectionItems = source?.currentCollectionItems;
    if (currentCollectionSource && currentCollectionItems && entryKey) {
        const menu = buildMenuItemsFromPayload(currentCollectionItems, currentCollectionSource, {
            selectedKey: entryKey,
        });
        if (menu.length > 0) {
            const selectedItem = menu.find((item) => item.current === true) || null;
            if (selectedItem) {
                return {
                    text: selectedItem.text,
                    href: currentHref,
                    current: true,
                    menu,
                    collection_source: currentCollectionSource,
                    collection_href: currentHref,
                };
            }
        }
    }

    if (!currentText || !currentHref) {
        return null;
    }

    return {
        text: currentText,
        href: currentHref,
        current: true,
    };
}

function readPageCollectionSource(rawValue) {
    if (!rawValue) {
        return null;
    }

    try {
        return normalizeBreadcrumbCollectionSource(JSON.parse(rawValue));
    } catch (error) {
        return null;
    }
}

export function runBreadcrumbPreview() {
    const html = document.documentElement;
    const previewPending = html.getAttribute(ENTRY_BREADCRUMB_PREVIEW_PENDING_ATTR) === 'true';
    const sortPending = html.getAttribute(BREADCRUMB_SORT_PENDING_ATTR) === 'true';
    if (!previewPending && !sortPending) {
        return;
    }

    try {
        const body = document.body;
        if (!body) {
            clearPreviewPending(previewPending, sortPending);
            return;
        }

        const rawSources = body.dataset.entryBreadcrumbSources || '';
        if (!rawSources) {
            clearPreviewPending(previewPending, sortPending);
            return;
        }

        const sources = parseEntryBreadcrumbSources(rawSources);

        if (previewPending) {
            const selection = parseEntrySelection(
                sources,
                readCurrentFromPath()
            );
            if (selection) {
                const entrySource = selection.source;
                let prefixItems = buildPreviewLevelItems(entrySource);
                if (prefixItems.length === 0) {
                    prefixItems = Array.isArray(entrySource.tailItems)
                        ? entrySource.tailItems.slice()
                        : [];
                }

                const currentText = body.dataset.currentPageTitle || document.title || '';
                const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                const currentItem = buildPreviewCurrentItem(
                    entrySource,
                    currentText,
                    currentHref,
                    selection.entryKey
                );
                if (currentItem) {
                    prefixItems.push(currentItem);
                }

                renderRootSelection(entrySource.rootItem, entrySource.rootMenuItems, entrySource.rootMenuLabel);
                renderTopBreadcrumb(prefixItems);
            }

            html.removeAttribute(ENTRY_BREADCRUMB_PREVIEW_PENDING_ATTR);
        }

        if (sortPending) {
            const pageCollectionSource = readPageCollectionSource(body.dataset.pageCollectionSource || '');
            if (pageCollectionSource) {
                const collectionSource = pickSourceByLogicalPath(sources, pageCollectionSource.logicalPath);
                if (collectionSource) {
                    const collectionItems = buildPreviewLevelItems(collectionSource);
                    if (collectionItems.length > 0) {
                        renderTopBreadcrumb(collectionItems);
                    }
                }
            }

            html.removeAttribute(BREADCRUMB_SORT_PENDING_ATTR);
        }
    } catch (error) {
        clearPreviewPending(previewPending, sortPending);
    }
}
