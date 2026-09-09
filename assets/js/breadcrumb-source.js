import { normalizeBreadcrumbCollectionSource } from './breadcrumb-items.js';
import { normalizeFromPath, normalizePathname } from './nav-state.js';
import { normalizeIcon } from './icon-value.js';

function normalizeItemsPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const fields = Array.isArray(payload.f)
        ? payload.f.filter((field) => typeof field === 'string' && field.trim() !== '')
        : [];
    const rowVector = Array.isArray(payload.rv) ? payload.rv : [];
    if (fields.length === 0 || rowVector.length % fields.length !== 0) {
        return null;
    }

    return payload;
}

function normalizeLinkItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const text = typeof item.text === 'string' ? item.text.trim() : '';
    const href = typeof item.href === 'string' ? item.href.trim() : '';
    if (!text || !href) {
        return null;
    }

    const normalized = { text, href };
    if (typeof item.title === 'string' && item.title.trim() !== '') {
        normalized.title = item.title.trim();
    }
    if (typeof item.current === 'boolean') {
        normalized.current = item.current;
    }
    if (typeof item.selected === 'boolean') {
        normalized.selected = item.selected;
    }
    if (typeof item.highlighted === 'boolean') {
        normalized.highlighted = item.highlighted;
    }
    const icon = normalizeIcon(item.icon);
    if (icon) normalized.icon = icon;
    for (const field of ['kind', 'collection_href', 'collection_label']) {
        if (typeof item[field] === 'string' && item[field].trim() !== '') {
            normalized[field] = item[field].trim();
        }
    }
    if (Array.isArray(item.column_items)) {
        const columnItems = item.column_items.map(normalizeLinkItem).filter(Boolean);
        if (columnItems.length > 0) {
            normalized.column_items = columnItems;
        }
    }

    return normalized;
}

export function parseEntryBreadcrumbSources(rawValue) {
    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((source) => {
                if (!source || typeof source !== 'object') {
                    return null;
                }

                const logicalPath = normalizeFromPath(source.logical_path || source.logicalPath || '');
                const rootItem = normalizeLinkItem(source.root_item || source.rootItem);
                if (!logicalPath || !rootItem) {
                    return null;
                }

                const tailItemsRaw = Array.isArray(source.tail_items || source.tailItems)
                    ? (source.tail_items || source.tailItems)
                    : [];
                const levelsRaw = Array.isArray(source.levels) ? source.levels : [];

                return {
                    provider: typeof source.provider === 'string' ? source.provider.trim().toLowerCase() : '',
                    logicalPath,
                    rootItem,
                    tailItems: tailItemsRaw.map(normalizeLinkItem).filter(Boolean),
                    levels: levelsRaw
                        .map((level) => {
                            if (!level || typeof level !== 'object') {
                                return null;
                            }

                            const item = normalizeLinkItem(level.item);
                            if (!item) {
                                return null;
                            }

                            const normalized = { item };
                            const collectionSource = normalizeBreadcrumbCollectionSource(
                                level.collection_source || level.collectionSource
                            );
                            if (collectionSource) {
                                normalized.collectionSource = collectionSource;
                            }

                            const collectionItems = normalizeItemsPayload(
                                level.collection_items || level.collectionItems
                            );
                            if (collectionItems) {
                                normalized.collectionItems = collectionItems;
                            }

                            return normalized;
                        })
                        .filter(Boolean),
                    currentCollectionSource: normalizeBreadcrumbCollectionSource(
                        source.current_collection_source || source.currentCollectionSource
                    ),
                    currentCollectionItems: normalizeItemsPayload(
                        source.current_collection_items || source.currentCollectionItems
                    ),
                };
            })
            .filter(Boolean);
    } catch (error) {
        return [];
    }
}

export function parseEntrySelection(sources, fromPath) {
    const normalized = normalizeFromPath(fromPath);
    if (!normalized || !Array.isArray(sources) || sources.length === 0) {
        return null;
    }

    const source = sources.find((item) => normalizeFromPath(item?.logical_path || item?.logicalPath || '') === normalized) || null;
    return source ? { source } : null;
}

export function pickSourceByLogicalPath(sources, logicalPath) {
    const normalized = normalizeFromPath(logicalPath);
    if (!normalized || !Array.isArray(sources)) {
        return null;
    }

    for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        if (source?.logicalPath === normalized) {
            return source;
        }
    }

    return null;
}

function normalizeCollectionHref(href) {
    const rawHref = typeof href === 'string' ? href.trim() : '';
    if (!rawHref) {
        return '';
    }

    try {
        return normalizePathname(new URL(rawHref, window.location.origin).pathname);
    } catch (error) {
        return '';
    }
}

function addCollectionSourceToIndex(index, source) {
    const collectionSource = normalizeBreadcrumbCollectionSource(source);
    const hrefKey = normalizeCollectionHref(collectionSource?.href || '');
    if (hrefKey) {
        index.set(hrefKey, collectionSource);
    }
}

function buildCollectionSourceIndex(sources, extraSources = []) {
    const index = new Map();

    (Array.isArray(sources) ? sources : []).forEach((source) => {
        addCollectionSourceToIndex(
            index,
            source?.current_collection_source || source?.currentCollectionSource
        );
        (Array.isArray(source?.levels) ? source.levels : []).forEach((level) => {
            addCollectionSourceToIndex(
                index,
                level?.collection_source || level?.collectionSource
            );
        });
    });

    (Array.isArray(extraSources) ? extraSources : []).forEach((source) => {
        addCollectionSourceToIndex(index, source);
    });

    return index;
}

export function parseCollectionSourceIndex(rawValue, extraSources = []) {
    try {
        const sources = JSON.parse(rawValue);
        return buildCollectionSourceIndex(
            Array.isArray(sources) ? sources : [],
            extraSources
        );
    } catch (error) {
        return buildCollectionSourceIndex([], extraSources);
    }
}

export function pickCollectionSourceByHref(index, href) {
    if (!(index instanceof Map)) {
        return null;
    }

    const hrefKey = normalizeCollectionHref(href);
    return hrefKey ? index.get(hrefKey) || null : null;
}
