const SORT_QUERY_KEY = 'sort';
const DEFAULT_SORT_MODE = 'bydate';
const SORT_MODE_CONFIG = {
    bynameasc: { field: 'title', order: 'asc' },
    byname: { field: 'title', order: 'desc' },
    bydateasc: { field: 'date', order: 'asc' },
    bydate: { field: 'date', order: 'desc' },
    bycountasc: { field: 'count', order: 'asc' },
    bycount: { field: 'count', order: 'desc' }
};

const sortRoots = new Set();
let currentSortMode = '';
let popstateBound = false;

function normalizeSortMode(mode, fallback = DEFAULT_SORT_MODE) {
    const normalized = typeof mode === 'string' ? mode.toLowerCase() : '';
    return Object.prototype.hasOwnProperty.call(SORT_MODE_CONFIG, normalized) ? normalized : fallback;
}

function parseSortMode(mode) {
    return SORT_MODE_CONFIG[normalizeSortMode(mode)];
}

function nextSortMode(currentMode, field) {
    const normalizedMode = normalizeSortMode(currentMode);
    if (field === 'title') return normalizedMode === 'bynameasc' ? 'byname' : 'bynameasc';
    if (field === 'date') return normalizedMode === 'bydateasc' ? 'bydate' : 'bydateasc';
    if (field === 'count') return normalizedMode === 'bycountasc' ? 'bycount' : 'bycountasc';
    return normalizedMode;
}

function readUrlSortMode() {
    try {
        const params = new URLSearchParams(window.location.search);
        return normalizeSortMode(params.get(SORT_QUERY_KEY) || '', '');
    } catch (error) {
        return '';
    }
}

function buildSortHref(rawHref, mode) {
    if (!rawHref) return rawHref;

    let url;
    try {
        url = new URL(rawHref, window.location.href);
    } catch (error) {
        return rawHref;
    }

    if (url.origin !== window.location.origin) {
        return rawHref;
    }

    const normalizedMode = normalizeSortMode(mode);
    if (normalizedMode === DEFAULT_SORT_MODE) {
        url.searchParams.delete(SORT_QUERY_KEY);
    } else {
        url.searchParams.set(SORT_QUERY_KEY, normalizedMode);
    }

    return `${url.pathname}${url.search}${url.hash}`;
}

function syncSortUrl(mode, historyMode) {
    if (historyMode !== 'push' && historyMode !== 'replace') {
        return;
    }

    const nextHref = buildSortHref(window.location.href, mode);
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!nextHref || nextHref === currentHref) {
        return;
    }

    const historyFn = historyMode === 'push' ? window.history.pushState : window.history.replaceState;
    historyFn.call(window.history, null, '', nextHref);
}

function readRowValue(row, field) {
    if (field === 'title') return row.dataset.title || '';
    if (field === 'date') return Number(row.dataset.dateKey || '0');
    if (field === 'count') return Number(row.dataset.count || '0');
    return 0;
}

function compareRows(leftRow, rightRow, config) {
    const left = readRowValue(leftRow, config.field);
    const right = readRowValue(rightRow, config.field);

    if (config.field === 'title') {
        const cmp = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
        return config.order === 'asc' ? cmp : -cmp;
    }

    if (left === right) {
        const fallback = String(leftRow.dataset.title || '').localeCompare(
            String(rightRow.dataset.title || ''),
            undefined,
            { numeric: true, sensitivity: 'base' }
        );
        return config.order === 'asc' ? fallback : -fallback;
    }

    return config.order === 'asc' ? left - right : right - left;
}

function sortRows(rows, mode) {
    const config = parseSortMode(mode);
    const branchRows = rows
        .filter((row) => (row.dataset.kind || '') !== 'page')
        .sort((left, right) => compareRows(left, right, config));
    const pageRows = rows
        .filter((row) => (row.dataset.kind || '') === 'page')
        .sort((left, right) => compareRows(left, right, config));

    return config.order === 'asc'
        ? branchRows.concat(pageRows)
        : pageRows.concat(branchRows);
}

function updateSortControls(root, mode) {
    const config = parseSortMode(mode);
    const baseHref = root.dataset.listSortBaseHref || window.location.href;
    const controls = Array.from(root.querySelectorAll('[data-sort-field]'));

    controls.forEach((control) => {
        const field = control.dataset.sortField || '';
        const active = field === config.field;
        control.dataset.sortActive = active ? 'true' : 'false';
        control.dataset.sortDirection = active ? config.order : 'none';

        if (control.tagName === 'A') {
            control.setAttribute('href', buildSortHref(baseHref, nextSortMode(mode, field)));
        }
    });

    root.dataset.currentSort = mode;
    root.dataset.listSortMode = mode;
}

function applySortModeToRoot(root, mode) {
    if (!root || !root.isConnected) {
        return;
    }

    const list = root.matches('[data-sortable-list]') ? root : root.querySelector('[data-sortable-list]');
    if (!list) {
        return;
    }

    const rows = Array.from(list.children).filter((child) => child.hasAttribute('data-sortable-row'));
    if (!rows.length) {
        updateSortControls(root, mode);
        return;
    }

    sortRows(rows, mode).forEach((row) => list.appendChild(row));
    updateSortControls(root, mode);
}

function cleanupDisconnectedRoots() {
    sortRoots.forEach((root) => {
        if (!root.isConnected) {
            sortRoots.delete(root);
        }
    });
}

function applySortMode(mode, options = {}) {
    cleanupDisconnectedRoots();

    const normalizedMode = normalizeSortMode(mode);
    currentSortMode = normalizedMode;

    sortRoots.forEach((root) => {
        applySortModeToRoot(root, normalizedMode);
    });

    syncSortUrl(normalizedMode, options.historyMode || 'none');
}

function handleSortControlClick(event) {
    const control = event.currentTarget;
    if (control.tagName === 'A') {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        event.preventDefault();
    }

    const root = control.closest('[data-list-sort-root]');
    if (!root) return;

    const field = control.dataset.sortField || '';
    const mode = nextSortMode(root.dataset.listSortMode || currentSortMode || DEFAULT_SORT_MODE, field);
    applySortMode(mode, { historyMode: 'push' });
}

function bindRoot(root) {
    if (!root || root.dataset.listSortBound === 'true') {
        return;
    }

    root.dataset.listSortBound = 'true';
    sortRoots.add(root);

    Array.from(root.querySelectorAll('[data-sort-field]')).forEach((control) => {
        control.addEventListener('click', handleSortControlClick);
    });
}

export function bindListSortRoots(scope = document) {
    if (!popstateBound && typeof window !== 'undefined') {
        window.addEventListener('popstate', () => {
            const urlMode = readUrlSortMode() || DEFAULT_SORT_MODE;
            applySortMode(urlMode, { historyMode: 'none' });
        });
        popstateBound = true;
    }

    const roots = [];
    if (scope instanceof Element && scope.matches('[data-list-sort-root]')) {
        roots.push(scope);
    }
    roots.push(...Array.from(scope.querySelectorAll?.('[data-list-sort-root]') || []));
    roots.forEach(bindRoot);

    const initialMode = currentSortMode
        || readUrlSortMode()
        || normalizeSortMode(roots[0]?.dataset.listSortMode || roots[0]?.dataset.currentSort || DEFAULT_SORT_MODE);
    applySortMode(initialMode, { historyMode: 'none' });

    const normalizedUrlMode = readUrlSortMode();
    if (normalizedUrlMode && normalizedUrlMode !== initialMode) {
        syncSortUrl(initialMode, 'replace');
    }
}

export { DEFAULT_SORT_MODE, SORT_QUERY_KEY, buildSortHref, nextSortMode, normalizeSortMode, parseSortMode };
