import {
    SORT_VARIANTS,
    applySortTokenToUrl,
    compareSortRecords,
    parseSortToken,
    readCurrentSortToken,
    toggleSortOrder
} from './sort-policy.js';
import { readPageCollectionSource } from './collection-source.js';
import { refreshCollectionNavigation } from './collection-navigation.js';

function writeSortToken(token, defaultToken) {
    const url = new URL(window.location.href);
    applySortTokenToUrl(url, token, defaultToken);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
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
        ?.querySelector('[data-collection-entry][href]')
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

function collectSortableRows(grid, columnCount) {
    const rowCells = Array.from(grid.children).filter((child) => child.hasAttribute('data-collection-cell') && !child.hasAttribute('data-collection-header'));
    const rows = [];

    for (let index = 0, offset = 0; offset + columnCount <= rowCells.length; index += 1, offset += columnCount) {
        const cells = rowCells.slice(offset, offset + columnCount);
        const head = cells[0];
        rows.push({ index, head, cells });
    }

    return { rows, rowCells };
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
        refreshCollectionNavigation(grid, variantName, currentToken, pageCollectionSource);
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

    refreshCollectionNavigation(grid, variantName, currentToken, pageCollectionSource);
}

function applySortableGrids() {
    const grids = Array.from(document.querySelectorAll('[data-sortable="true"][data-sort-variant]'));
    grids.forEach((grid) => applySortableGrid(grid));
}

function initSortableGrids() {
    applySortableGrids();

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
        applySortableGrids();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSortableGrids();
});
