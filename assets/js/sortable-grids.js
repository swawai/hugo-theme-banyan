const SORT_PARAM_KEY = 'sort';
const SORT_VARIANTS = {
    section: {
        defaultToken: 'date-desc',
        grouped: true,
        fields: {
            name: { dataKey: 'sortName', type: 'string', defaultOrder: 'asc' },
            date: { dataKey: 'sortDate', type: 'number', defaultOrder: 'desc' },
            count: { dataKey: 'sortCount', type: 'number', defaultOrder: 'desc' }
        }
    },
    all: {
        defaultToken: 'date-desc',
        grouped: false,
        fields: {
            name: { dataKey: 'sortName', type: 'string', defaultOrder: 'asc' },
            date: { dataKey: 'sortDate', type: 'number', defaultOrder: 'desc' },
            size: { dataKey: 'sortSize', type: 'number', defaultOrder: 'desc' },
            path: { dataKey: 'sortPath', type: 'string', defaultOrder: 'asc' }
        }
    },
    tree: {
        defaultToken: 'date-desc',
        grouped: true,
        fields: {
            name: { dataKey: 'sortName', type: 'string', defaultOrder: 'asc' },
            date: { dataKey: 'sortDate', type: 'number', defaultOrder: 'desc' },
            count: { dataKey: 'sortCount', type: 'number', defaultOrder: 'desc' }
        }
    },
    products: {
        defaultToken: 'name-asc',
        grouped: false,
        fields: {
            name: { dataKey: 'sortName', type: 'string', defaultOrder: 'asc' },
            price: { dataKey: 'sortPrice', type: 'number', defaultOrder: 'desc' },
            value: { dataKey: 'sortValue', type: 'string', defaultOrder: 'asc' }
        }
    }
};

function parseSortToken(token) {
    const value = typeof token === 'string' ? token.trim().toLowerCase() : '';
    if (!value) return { field: '', order: '' };
    const parts = value.split('-');
    if (parts.length !== 2) return { field: '', order: '' };
    const [field, order] = parts;
    if (order !== 'asc' && order !== 'desc') return { field: '', order: '' };
    return { field, order };
}

function getNormalizedSortToken(token, variantName) {
    const variant = SORT_VARIANTS[variantName];
    if (!variant) return '';
    const parsed = parseSortToken(token);
    if (!parsed.field || !variant.fields[parsed.field]) return variant.defaultToken;
    return `${parsed.field}-${parsed.order}`;
}

function toggleSortOrder(order) {
    return order === 'asc' ? 'desc' : 'asc';
}

function readCurrentSortToken(variantName) {
    const url = new URL(window.location.href);
    return getNormalizedSortToken(url.searchParams.get(SORT_PARAM_KEY), variantName);
}

function buildSortHref(token, defaultToken) {
    const url = new URL(window.location.href);
    if (!token || token === defaultToken) url.searchParams.delete(SORT_PARAM_KEY);
    else url.searchParams.set(SORT_PARAM_KEY, token);
    return `${url.pathname}${url.search}${url.hash}`;
}

function writeSortToken(token, defaultToken) {
    const url = new URL(window.location.href);
    if (!token || token === defaultToken) url.searchParams.delete(SORT_PARAM_KEY);
    else url.searchParams.set(SORT_PARAM_KEY, token);

    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function readRowValue(rowHead, fieldConfig) {
    if (!rowHead || !fieldConfig) return '';
    const raw = rowHead.dataset?.[fieldConfig.dataKey] ?? '';
    if (fieldConfig.type === 'number') {
        const numeric = Number(raw);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    return String(raw);
}

function readOriginalRowIndex(row) {
    const raw = row?.head?.dataset?.sortOriginalIndex ?? '';
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : row.index;
}

function compareRowValues(left, right, fieldConfig, order) {
    const leftValue = readRowValue(left.head, fieldConfig);
    const rightValue = readRowValue(right.head, fieldConfig);
    let result = 0;

    if (fieldConfig.type === 'number') {
        result = leftValue - rightValue;
    } else {
        result = String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    if (result !== 0) return order === 'asc' ? result : -result;

    // Keep ties in the original SSR order so default descending sorts do not
    // reshuffle same-value rows on page load.
    return readOriginalRowIndex(left) - readOriginalRowIndex(right);
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
        if (head?.dataset && head.dataset.sortOriginalIndex === undefined) {
            head.dataset.sortOriginalIndex = String(index);
        }
        rows.push({ index, head, cells });
    }

    return { rows, rowCells };
}

function updateSortControls(grid, variantName, currentToken) {
    const variant = SORT_VARIANTS[variantName];
    const current = parseSortToken(currentToken);
    const controls = grid.querySelectorAll('a[data-sort-control="true"]');

    controls.forEach((control) => {
        const field = (control.dataset.sortField || '').toLowerCase();
        const defaultOrder = (control.dataset.sortDefaultOrder || 'asc').toLowerCase();
        const active = field === current.field;
        const nextOrder = active ? toggleSortOrder(current.order) : defaultOrder;
        const nextToken = `${field}-${nextOrder}`;
        const indicator = control.querySelector('.sort-indicator');
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

    const currentToken = readCurrentSortToken(variantName);
    const current = parseSortToken(currentToken);
    const fieldConfig = variant.fields[current.field];
    if (!fieldConfig) return;

    const { rows, rowCells } = collectSortableRows(grid, columnCount);
    if (!rows.length) {
        updateSortControls(grid, variantName, currentToken);
        return;
    }

    const sortedRows = rows.slice().sort((left, right) => {
        if (variant.grouped) {
            const leftGroup = Number(left.head?.dataset?.sortGroup || 0);
            const rightGroup = Number(right.head?.dataset?.sortGroup || 0);
            if (leftGroup !== rightGroup) {
                return current.order === 'asc' ? leftGroup - rightGroup : rightGroup - leftGroup;
            }
        }

        return compareRowValues(left, right, fieldConfig, current.order);
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

    updateSortControls(grid, variantName, currentToken);
}

function applySortableGrids() {
    document.querySelectorAll('[data-sortable="true"][data-sort-variant]').forEach((grid) => {
        applySortableGrid(grid);
    });
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
        const current = parseSortToken(readCurrentSortToken(variantName));
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
