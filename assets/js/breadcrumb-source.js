import { normalizeBreadcrumbCollectionSource } from './breadcrumb-items.js';
import { normalizeFromPath } from './nav-state.js';

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
    if (typeof item.redundant_with_root_menu === 'boolean') {
        normalized.redundant_with_root_menu = item.redundant_with_root_menu;
    }
    if (typeof item.redundantWithRootMenu === 'boolean') {
        normalized.redundant_with_root_menu = item.redundantWithRootMenu;
    }
    if (typeof item.menu_button_label === 'string' && item.menu_button_label.trim() !== '') {
        normalized.menu_button_label = item.menu_button_label.trim();
    }
    if (Array.isArray(item.menu)) {
        const menuItems = item.menu.map(normalizeLinkItem).filter(Boolean);
        if (menuItems.length > 0) {
            normalized.menu = menuItems;
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

                const rootMenuRaw = Array.isArray(source.root_menu || source.rootMenu)
                    ? (source.root_menu || source.rootMenu)
                    : [];
                const tailItemsRaw = Array.isArray(source.tail_items || source.tailItems)
                    ? (source.tail_items || source.tailItems)
                    : [];
                const levelsRaw = Array.isArray(source.levels) ? source.levels : [];

                return {
                    provider: typeof source.provider === 'string' ? source.provider.trim().toLowerCase() : '',
                    logicalPath,
                    rootItem,
                    rootMenuItems: rootMenuRaw.map(normalizeLinkItem).filter(Boolean),
                    rootMenuLabel: typeof (source.root_menu_label || source.rootMenuLabel) === 'string'
                        ? (source.root_menu_label || source.rootMenuLabel).trim()
                        : '',
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

function isEntryKeySafe(value) {
    return typeof value === 'string' && value !== '' && value !== '.' && value !== '..' && !/[/?#]/.test(value);
}

export function parseEntrySelection(sources, fromPath) {
    const normalized = normalizeFromPath(fromPath);
    if (!normalized || !Array.isArray(sources) || sources.length === 0) {
        return null;
    }

    const sortedSources = sources
        .slice()
        .sort((left, right) => right.logicalPath.length - left.logicalPath.length);

    for (let index = 0; index < sortedSources.length; index += 1) {
        const source = sortedSources[index];
        if (!source || !normalized.startsWith(source.logicalPath)) {
            continue;
        }

        const remainder = normalized.slice(source.logicalPath.length);
        const parts = remainder.split('/').filter(Boolean);
        if (parts.length !== 1) {
            continue;
        }

        const entryKey = parts[0];
        if (!isEntryKeySafe(entryKey)) {
            return null;
        }

        return {
            source,
            entryKey,
        };
    }

    return null;
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
