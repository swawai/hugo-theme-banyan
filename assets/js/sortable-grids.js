import {
    SORT_VARIANTS,
    applySortTokenToUrl,
    compareSortRecords,
    parseSortToken,
    readCurrentSortToken,
    toggleSortOrder
} from './sort-shared.js';
import {
    applySortsTokensToUrl,
    buildDefaultSortsTokens,
    buildCurrentPageSortsTokens,
    getLogicalPathDepth,
    normalizeFromPath,
    readCurrentFromPath,
    readEffectiveSortsTokens,
} from './nav-state.js';
import {
    BREADCRUMB_SORT_CHANGE_EVENT,
    refreshBreadcrumbCollectionColumns,
} from './breadcrumb-column-sort.js';
import {
    ENTRY_LINEAGE_FIELD,
    hasFieldValue,
} from './navigation-state.contract.js';

const BREADCRUMB_SORT_PENDING_ATTR = 'data-breadcrumb-sort-pending';

function clearBreadcrumbSortPending() {
    document.documentElement?.removeAttribute(BREADCRUMB_SORT_PENDING_ATTR);
}

function normalizePageCollectionSource(source) {
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

    if (!logicalPath || !provider || !sortVariant) {
        return null;
    }

    return { logicalPath, provider, sortVariant, defaultSort, label, href };
}

function readPageCollectionSource() {
    const raw = document.body?.dataset.pageCollectionSource || '';
    if (!raw) {
        return null;
    }

    try {
        return normalizePageCollectionSource(JSON.parse(raw));
    } catch (error) {
        return null;
    }
}

function buildSortHref(token, defaultToken) {
    const url = new URL(window.location.href);
    applySortTokenToUrl(url, token, defaultToken);
    return `${url.pathname}${url.search}${url.hash}`;
}

function writeSortToken(token, defaultToken) {
    const url = new URL(window.location.href);
    applySortTokenToUrl(url, token, defaultToken);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function buildRelativeHref(url) {
    if (!(url instanceof URL)) {
        return '';
    }

    return url.origin === window.location.origin
        ? `${url.pathname}${url.search}${url.hash}`
        : url.toString();
}

function updateGridTitleLinks(grid, variantName, currentToken, pageCollectionSource) {
    const variant = SORT_VARIANTS[variantName];
    if (!variant) return;

    const currentSorts = pageCollectionSource?.logicalPath
        ? buildProjectedCollectionSortsTokens(pageCollectionSource.logicalPath, currentToken)
        : [];
    const descendantSorts = pageCollectionSource?.logicalPath
        ? [...currentSorts, currentToken]
        : [];
    const currentDefaultSorts = pageCollectionSource?.logicalPath
        ? buildDefaultSortsTokens(pageCollectionSource.logicalPath, variant.defaultToken)
        : [];
    const descendantDefaultSorts = pageCollectionSource?.logicalPath
        ? buildDefaultSortsTokens(pageCollectionSource.logicalPath, variant.defaultToken, 1)
        : [];

    grid.querySelectorAll('.cell-title .collection-item-link[href]').forEach((link) => {
        const rawHref = link.getAttribute('href') || '';
        if (!rawHref) return;

        let url;
        try {
            url = new URL(rawHref, window.location.origin);
        } catch (error) {
            return;
        }

        if (url.origin !== window.location.origin) {
            return;
        }

        applySortTokenToUrl(url, currentToken, variant.defaultToken);
        if (pageCollectionSource?.logicalPath) {
            const isEntryLink = hasFieldValue(url.search, ENTRY_LINEAGE_FIELD);
            applySortsTokensToUrl(
                url,
                isEntryLink ? currentSorts : descendantSorts,
                isEntryLink ? currentDefaultSorts : descendantDefaultSorts
            );
        }
        link.href = buildRelativeHref(url);
    });
}

function isLogicalPathPrefix(prefixPath, logicalPath) {
    const prefixSegments = normalizeFromPath(prefixPath).split('/').filter(Boolean);
    const logicalSegments = normalizeFromPath(logicalPath).split('/').filter(Boolean);
    return prefixSegments.length > 0
        && prefixSegments.length < logicalSegments.length
        && prefixSegments.every((segment, index) => segment === logicalSegments[index]);
}

function buildProjectedCollectionSortsTokens(logicalPath, currentToken) {
    const fromPath = readCurrentFromPath();
    if (!isLogicalPathPrefix(fromPath, logicalPath)) {
        return buildCurrentPageSortsTokens(logicalPath, currentToken);
    }

    const fromDepth = getLogicalPathDepth(fromPath);
    const logicalDepth = getLogicalPathDepth(logicalPath);
    return [
        ...readEffectiveSortsTokens(fromPath),
        ...Array(Math.max(0, logicalDepth - fromDepth - 1)).fill(''),
        currentToken,
    ];
}

function readRowValue(rowHead, fieldConfig) {
    if (!rowHead || !fieldConfig) return '';
    return rowHead.dataset?.[fieldConfig.dataKey] ?? '';
}

function readRowGroup(row) {
    return row?.head?.dataset?.sortGroup ?? 0;
}

function readRowStableKey(row) {
    const href = row?.head
        ?.querySelector('.collection-item-link[href]')
        ?.getAttribute('href') || '';
    if (!href) {
        return row?.index ?? '';
    }

    try {
        return new URL(href, window.location.href).pathname;
    } catch (error) {
        return href.split(/[?#]/, 1)[0];
    }
}

function isGridCell(node) {
    return !!node && node.nodeType === 1 && Array.from(node.classList || []).some((className) => className.startsWith('cell-'));
}

function collectSortableRows(grid, columnCount) {
    const rowCells = Array.from(grid.children).filter((child) => isGridCell(child) && !child.classList.contains('header'));
    const rows = [];

    for (let index = 0, offset = 0; offset + columnCount <= rowCells.length; index += 1, offset += columnCount) {
        const cells = rowCells.slice(offset, offset + columnCount);
        const head = cells[0];
        rows.push({ index, head, cells });
    }

    return { rows, rowCells };
}

function updateSortControls(grid, variantName, currentToken, pageCollectionSource) {
    const variant = SORT_VARIANTS[variantName];
    const current = parseSortToken(currentToken);
    const controls = grid.querySelectorAll('a[data-sort-control="true"]');

    controls.forEach((control) => {
        const field = (control.dataset.sortField || '').toLowerCase();
        const defaultOrder = (control.dataset.sortDefaultOrder || 'asc').toLowerCase();
        const active = field === current.field;
        const nextOrder = active ? toggleSortOrder(current.order) : defaultOrder;
        const nextToken = `${field}-${nextOrder}`;
        const indicator = control.querySelector('.collection-sort-indicator');
        const titleAsc = control.dataset.sortTitleAsc || '';
        const titleDesc = control.dataset.sortTitleDesc || '';
        const actionLabel = nextOrder === 'asc' ? titleAsc : titleDesc;

        control.href = buildSortHref(nextToken, variant.defaultToken);
        control.dataset.sortActive = active ? 'true' : 'false';
        if (actionLabel) {
            control.title = actionLabel;
            control.setAttribute('aria-label', actionLabel);
        }

        if (indicator) {
            indicator.textContent = active ? (current.order === 'asc' ? '↑' : '↓') : '↨';
        }
    });
}

function applySortableGrid(grid) {
    const variantName = (grid.dataset.sortVariant || '').toLowerCase();
    const variant = SORT_VARIANTS[variantName];
    const columnCount = Number(grid.dataset.sortColumns || 0);
    if (!variant || !columnCount) return;

    const pageCollectionSource = readPageCollectionSource();
    const queryToken = readCurrentSortToken(variantName, variant.defaultToken);
    const currentToken = queryToken;
    const current = parseSortToken(currentToken);
    if (!variant.fields[current.field]) return;

    const { rows, rowCells } = collectSortableRows(grid, columnCount);
    if (!rows.length) {
        updateSortControls(grid, variantName, currentToken, pageCollectionSource);
        updateGridTitleLinks(grid, variantName, currentToken, pageCollectionSource);
        return;
    }

    const sortedRows = rows.slice().sort((left, right) => {
        return compareSortRecords(left, right, {
            variant,
            field: current.field,
            order: current.order,
            readValue: (row, fieldConfig) => readRowValue(row.head, fieldConfig),
            readGroup: readRowGroup,
            readStableKey: readRowStableKey,
        });
    });

    const nextCells = [];
    sortedRows.forEach((row) => {
        row.cells.forEach((cell) => nextCells.push(cell));
    });

    const orderChanged = nextCells.length !== rowCells.length || nextCells.some((cell, index) => cell !== rowCells[index]);
    if (orderChanged) {
        const fragment = document.createDocumentFragment();
        nextCells.forEach((cell) => fragment.appendChild(cell));
        grid.appendChild(fragment);
    }

    updateSortControls(grid, variantName, currentToken, pageCollectionSource);
    updateGridTitleLinks(grid, variantName, currentToken, pageCollectionSource);
}

async function applySortableGrids() {
    const grids = Array.from(document.querySelectorAll('[data-sortable="true"][data-sort-variant]'));
    if (grids.length === 0) {
        clearBreadcrumbSortPending();
        return;
    }

    grids.forEach((grid) => applySortableGrid(grid));
    await refreshBreadcrumbCollectionColumns();
    clearBreadcrumbSortPending();
}

function refreshSortableGridNavigation() {
    document.querySelectorAll('[data-sortable="true"][data-sort-variant]').forEach((grid) => {
        const variantName = (grid.dataset.sortVariant || '').toLowerCase();
        const variant = SORT_VARIANTS[variantName];
        if (!variant) {
            return;
        }

        const currentToken = readCurrentSortToken(variantName, variant.defaultToken);
        const pageCollectionSource = readPageCollectionSource();
        updateSortControls(grid, variantName, currentToken, pageCollectionSource);
        updateGridTitleLinks(grid, variantName, currentToken, pageCollectionSource);
    });
}

async function initSortableGrids() {
    await applySortableGrids();

    document.addEventListener('click', (event) => {
        const control = event.target.closest('a[data-sort-control="true"]');
        if (!control) return;

        const grid = control.closest('[data-sortable="true"][data-sort-variant]');
        if (!grid) return;

        const variantName = (grid.dataset.sortVariant || '').toLowerCase();
        const variant = SORT_VARIANTS[variantName];
        const field = (control.dataset.sortField || '').toLowerCase();
        const defaultOrder = (control.dataset.sortDefaultOrder || 'asc').toLowerCase();
        const queryToken = readCurrentSortToken(variantName, variant?.defaultToken || '');
        const currentToken = queryToken;
        const current = parseSortToken(currentToken);
        const nextOrder = current.field === field ? toggleSortOrder(current.order) : defaultOrder;
        const nextToken = `${field}-${nextOrder}`;

        if (!variant || !variant.fields[field]) return;

        event.preventDefault();
        writeSortToken(nextToken, variant.defaultToken);
        void applySortableGrids();
    });
}

document.addEventListener(BREADCRUMB_SORT_CHANGE_EVENT, refreshSortableGridNavigation);
document.addEventListener('DOMContentLoaded', () => {
    void initSortableGrids();
});
