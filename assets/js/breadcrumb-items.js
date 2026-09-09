import { normalizeIcon } from './icon-value.js';
import {
    SORT_VARIANTS,
    applySortTokenToUrl,
    getNormalizedSortToken,
    parseSortToken,
    toggleSortOrder,
} from './sort-shared.js';
import {
    decodeItemsPayload,
    getItemsPayload,
    isCollectionRowKind,
    readRequestedSortToken,
    sortItemsRows,
    supportsItemsPayloadProvider,
} from './collection-items.js';
import {
    applyFromPathToUrl,
    applySortsTokensToUrl,
    buildDefaultSortsTokens,
    buildCurrentPageSortsTokens,
    buildDescendantSortsTokens,
    buildLineageSortsTokensForPath,
    normalizeFromPath,
    normalizePathname,
    readCurrentFromPath,
} from './nav-state.js';

export function normalizeBreadcrumbCollectionSource(source) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    const logicalPath = normalizeFromPath(source.logical_path || source.logicalPath || '');
    const provider = typeof source.provider === 'string' ? source.provider.trim().toLowerCase() : '';
    const sortVariant = typeof (source.sort_variant || source.sortVariant) === 'string'
        ? (source.sort_variant || source.sortVariant).trim().toLowerCase()
        : '';
    const defaultSort = typeof (source.default_sort || source.defaultSort) === 'string'
        ? (source.default_sort || source.defaultSort).trim().toLowerCase()
        : '';
    const label = typeof source.label === 'string' ? source.label.trim() : '';
    const href = typeof source.href === 'string' ? source.href.trim() : '';

    if (!logicalPath && !provider && !sortVariant && !defaultSort && !label && !href) {
        return null;
    }

    const normalized = {};
    if (logicalPath) {
        normalized.logicalPath = logicalPath;
    }
    if (provider) {
        normalized.provider = provider;
    }
    if (sortVariant) {
        normalized.sortVariant = sortVariant;
    }
    if (defaultSort) {
        normalized.defaultSort = defaultSort;
    }
    if (label) {
        normalized.label = label;
    }
    if (href) {
        normalized.href = href;
    }

    return normalized;
}

export function getSourceSortVariant(source) {
    return source?.sortVariant || source?.sort_variant || source?.current_collection_source?.sort_variant || '';
}

function toRelativeHref(url) {
    if (!(url instanceof URL)) {
        return '';
    }

    return url.origin === window.location.origin
        ? `${url.pathname}${url.search}${url.hash}`
        : url.toString();
}

function normalizeBreadcrumbItemKind(kind) {
    return typeof kind === 'string' ? kind.trim().toLowerCase() : '';
}

function readRequestedSortState(source, sortVariant, defaultSort = '') {
    const fallbackToken = defaultSort || SORT_VARIANTS[sortVariant]?.defaultToken || '';
    const sortToken = sortVariant ? readRequestedSortToken(sortVariant, source?.logicalPath || '', fallbackToken) : '';
    const sortsTokens = source?.logicalPath
        ? buildCurrentPageSortsTokens(source.logicalPath, sortToken)
        : [];
    const defaultSortsTokens = source?.logicalPath
        ? buildDefaultSortsTokens(source.logicalPath, fallbackToken)
        : [];

    return {
        sortToken,
        defaultSort: fallbackToken,
        sortsTokens,
        defaultSortsTokens,
    };
}

export function getCollectionSortState(source) {
    const collectionSource = normalizeBreadcrumbCollectionSource(source);
    if (!collectionSource?.logicalPath) {
        return null;
    }

    const sortVariant = collectionSource.sortVariant || getSourceSortVariant(collectionSource);
    const defaultSort = collectionSource.defaultSort || SORT_VARIANTS[sortVariant]?.defaultToken || '';
    const requestedState = readRequestedSortState(collectionSource, sortVariant, defaultSort);
    const sortToken = getNormalizedSortToken(
        requestedState.sortToken,
        sortVariant,
        defaultSort
    );
    const current = parseSortToken(sortToken);
    if (!current.field || !current.order) {
        return null;
    }

    return {
        ...requestedState,
        collectionSource,
        sortVariant,
        sortToken,
        field: current.field,
        order: current.order,
        nextToken: `${current.field}-${toggleSortOrder(current.order)}`,
    };
}

export function buildCollectionSortToggleHref(
    source,
    baseHref = window.location.href,
    lineagePathOverride = ''
) {
    const state = getCollectionSortState(source);
    if (!state) {
        return '';
    }

    try {
        const url = new URL(baseHref, window.location.origin);
        const currentLineagePath = readCurrentFromPath();
        const targetLogicalPath = state.collectionSource.logicalPath;
        const lineageLogicalPath = normalizeFromPath(lineagePathOverride)
            || currentLineagePath
            || targetLogicalPath;

        if (!currentLineagePath) {
            applyFromPathToUrl(url, lineageLogicalPath);
        }
        applySortsTokensToUrl(
            url,
            buildLineageSortsTokensForPath(lineageLogicalPath, targetLogicalPath, state.nextToken),
            buildDefaultSortsTokens(lineageLogicalPath, state.defaultSort)
        );
        return toRelativeHref(url);
    } catch (error) {
        return '';
    }
}

export function buildCollectionPageHref(href, logicalPath, sortVariant, defaultSort = '') {
    const rawHref = typeof href === 'string' ? href.trim() : '';
    if (!rawHref || !logicalPath || !sortVariant) {
        return rawHref;
    }

    try {
        const url = new URL(rawHref, window.location.origin);
        const sortToken = readRequestedSortToken(sortVariant, logicalPath, defaultSort);
        const sortsTokens = buildCurrentPageSortsTokens(logicalPath, sortToken);
        applySortTokenToUrl(url, sortToken, defaultSort);
        applySortsTokensToUrl(url, sortsTokens, buildDefaultSortsTokens(logicalPath, defaultSort));
        return toRelativeHref(url);
    } catch (error) {
        return rawHref;
    }
}

function buildDescendantCollectionHref(href, collectionSource, sortToken = '', defaultSort = '') {
    const rawHref = typeof href === 'string' ? href.trim() : '';
    if (!rawHref || !collectionSource?.logicalPath) {
        return rawHref;
    }

    try {
        const url = new URL(rawHref, window.location.origin);
        applySortTokenToUrl(url, sortToken, defaultSort);
        applySortsTokensToUrl(
            url,
            buildDescendantSortsTokens(collectionSource.logicalPath, sortToken),
            buildDefaultSortsTokens(collectionSource.logicalPath, defaultSort, 1)
        );
        return toRelativeHref(url);
    } catch (error) {
        return rawHref;
    }
}

function buildEntrySourceHref(href, logicalPath, sortToken = '', defaultSort = '', sortsTokens = [], defaultSortsTokens = []) {
    const rawHref = typeof href === 'string' ? href.trim() : '';
    if (!rawHref) {
        return '';
    }

    try {
        const url = new URL(rawHref, window.location.origin);
        if (logicalPath) {
            applyFromPathToUrl(url, logicalPath);
        }
        applySortTokenToUrl(url, sortToken, defaultSort);
        applySortsTokensToUrl(
            url,
            sortsTokens,
            defaultSortsTokens.length > 0 ? defaultSortsTokens : buildDefaultSortsTokens(logicalPath, defaultSort)
        );
        return toRelativeHref(url);
    } catch (error) {
        return rawHref;
    }
}

export function buildBreadcrumbRowHref(row, collectionSource, sortState) {
    if (!row || typeof row.href !== 'string' || row.href.trim() === '' || !collectionSource?.logicalPath) {
        return '';
    }

    if (isCollectionRowKind(row.kind)) {
        return buildDescendantCollectionHref(
            row.href,
            collectionSource,
            sortState?.sortToken || '',
            sortState?.defaultSort || ''
        );
    }

    return buildEntrySourceHref(
        row.href,
        collectionSource.logicalPath,
        sortState?.sortToken || '',
        sortState?.defaultSort || '',
        sortState?.sortsTokens || [],
        sortState?.defaultSortsTokens || []
    );
}

export function buildBreadcrumbMenuItemsFromDecodedRows(decoded, collectionSource, { selectedKey = '', selectedPathname = '' } = {}) {
    if (!decoded || !collectionSource?.logicalPath) {
        return [];
    }

    const sortVariant = decoded.sortVariant || collectionSource.sortVariant || getSourceSortVariant(collectionSource);
    const defaultSort = decoded.defaultSort || collectionSource.defaultSort || SORT_VARIANTS[sortVariant]?.defaultToken || '';
    const sortState = readRequestedSortState(collectionSource, sortVariant, defaultSort);
    const { rows } = sortItemsRows(
        decoded.rows,
        sortVariant,
        collectionSource.logicalPath,
        sortState.defaultSort
    );

    return rows
        .map((row) => {
            const href = buildBreadcrumbRowHref(row, collectionSource, sortState);
            if (!href) {
                return null;
            }

            let current = false;
            if (selectedKey && row?.key === selectedKey) {
                current = true;
            } else if (selectedPathname) {
                try {
                    current = normalizePathname(new URL(row.href, window.location.origin).pathname) === selectedPathname;
                } catch (error) {
                    current = false;
                }
            }

            const item = {
                text: typeof row.text === 'string' && row.text !== '' ? row.text : row.key,
                href,
                current,
            };
            const icon = normalizeIcon(row.icon);
            if (icon) item.icon = icon;
            const kind = normalizeBreadcrumbItemKind(row.kind);
            if (kind) {
                item.kind = kind;
            }

            return item;
        })
        .filter(Boolean);
}

export async function buildBreadcrumbMenuItems(fragmentRoot, collectionSource, selection = {}) {
    if (!fragmentRoot || !collectionSource?.logicalPath || !supportsItemsPayloadProvider(collectionSource.provider)) {
        return [];
    }

    const payload = await getItemsPayload(fragmentRoot, collectionSource.logicalPath);
    const decoded = decodeItemsPayload(payload);
    return buildBreadcrumbMenuItemsFromDecodedRows(decoded, collectionSource, selection);
}

function findSelectedRow(rows, selectedPathname = '') {
    if (!Array.isArray(rows) || rows.length === 0) {
        return null;
    }

    const rawSelectedPathname = typeof selectedPathname === 'string' ? selectedPathname.trim() : '';
    if (!rawSelectedPathname) {
        return null;
    }
    const normalizedSelectedPathname = normalizePathname(rawSelectedPathname);

    return rows.find((row) => {
        if (!row?.href) {
            return false;
        }

        try {
            return normalizePathname(new URL(row.href, window.location.origin).pathname) === normalizedSelectedPathname;
        } catch (error) {
            return false;
        }
    }) || null;
}

export async function buildSelectedBreadcrumbItem(fragmentRoot, source, selectedPathname = '', selectedTitle = '') {
    const normalizedSelectedPathname = typeof selectedPathname === 'string' ? selectedPathname.trim() : '';
    const normalizedSelectedTitle = typeof selectedTitle === 'string' ? selectedTitle.trim() : '';
    if (!fragmentRoot || !source?.logicalPath || !normalizedSelectedPathname) {
        return null;
    }

    const collectionSource = normalizeBreadcrumbCollectionSource(source?.currentCollectionSource)
        || normalizeBreadcrumbCollectionSource(source);
    if (!collectionSource || !supportsItemsPayloadProvider(collectionSource.provider)) {
        return null;
    }

    const payload = await getItemsPayload(fragmentRoot, source.logicalPath);
    const decoded = decodeItemsPayload(payload);
    if (!decoded) {
        return null;
    }

    const selectedRow = findSelectedRow(decoded.rows, normalizedSelectedPathname);
    if (!selectedRow) {
        return null;
    }

    const selectedKey = selectedRow.key || '';
    const menu = buildBreadcrumbMenuItemsFromDecodedRows(decoded, collectionSource, {
        selectedKey,
        selectedPathname: normalizedSelectedPathname,
    });
    if (normalizedSelectedTitle) {
        const selectedMenuItem = menu.find((menuItem) => menuItem.current === true);
        if (selectedMenuItem) {
            selectedMenuItem.title = normalizedSelectedTitle;
        }
    }
    const sortState = readRequestedSortState(collectionSource, decoded.sortVariant, decoded.defaultSort);
    const href = buildBreadcrumbRowHref(selectedRow, collectionSource, sortState);
    if (!href) {
        return null;
    }

    const item = {
        text: typeof selectedRow.text === 'string' && selectedRow.text !== '' ? selectedRow.text : selectedKey,
        href,
        current: true,
        menu,
        collection_source: collectionSource,
    };
    const icon = normalizeIcon(selectedRow.icon);
    if (icon) item.icon = icon;
    if (normalizedSelectedTitle) {
        item.title = normalizedSelectedTitle;
    }
    const kind = normalizeBreadcrumbItemKind(selectedRow.kind);
    if (kind) {
        item.kind = kind;
    }

    return item;
}
