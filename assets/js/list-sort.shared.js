const SORT_QUERY_KEY = 'sort';
const DEFAULT_SORT_VARIANT = 'dir';
const DEFAULT_SORT_MODE = 'bydate';
const SORT_VARIANT_CONFIG = {
    dir: {
        defaultMode: 'bydate',
        groupRows: true,
        fieldModes: {
            title: ['bynameasc', 'byname'],
            date: ['bydateasc', 'bydate'],
            count: ['bycountasc', 'bycount']
        },
        modes: {
            bynameasc: { field: 'title', order: 'asc' },
            byname: { field: 'title', order: 'desc' },
            bydateasc: { field: 'date', order: 'asc' },
            bydate: { field: 'date', order: 'desc' },
            bycountasc: { field: 'count', order: 'asc' },
            bycount: { field: 'count', order: 'desc' }
        }
    },
    all: {
        defaultMode: 'allbydate',
        groupRows: false,
        fieldModes: {
            title: ['allbynameasc', 'allbyname'],
            date: ['allbydateasc', 'allbydate'],
            bytes: ['allbysizeasc', 'allbysize'],
            path: ['allbypathasc', 'allbypath']
        },
        modes: {
            allbynameasc: { field: 'title', order: 'asc' },
            allbyname: { field: 'title', order: 'desc' },
            allbydateasc: { field: 'date', order: 'asc' },
            allbydate: { field: 'date', order: 'desc' },
            allbysizeasc: { field: 'bytes', order: 'asc' },
            allbysize: { field: 'bytes', order: 'desc' },
            allbypathasc: { field: 'path', order: 'asc' },
            allbypath: { field: 'path', order: 'desc' }
        }
    },
    resources: {
        defaultMode: 'resourcesbynameasc',
        groupRows: false,
        fieldModes: {
            title: ['resourcesbyname', 'resourcesbynameasc'],
            price: ['resourcesbyprice', 'resourcesbypriceasc'],
            value: ['resourcesbyvalue', 'resourcesbyvalueasc']
        },
        modes: {
            resourcesbynameasc: { field: 'title', order: 'asc' },
            resourcesbyname: { field: 'title', order: 'desc' },
            resourcesbypriceasc: { field: 'price', order: 'asc' },
            resourcesbyprice: { field: 'price', order: 'desc' },
            resourcesbyvalueasc: { field: 'value', order: 'asc' },
            resourcesbyvalue: { field: 'value', order: 'desc' }
        }
    }
};

const sortRoots = new Set();
let currentSortVariant = '';
let currentSortMode = '';
let popstateBound = false;

function normalizeSortVariant(variant) {
    const normalized = typeof variant === 'string' ? variant.toLowerCase() : '';
    return Object.prototype.hasOwnProperty.call(SORT_VARIANT_CONFIG, normalized)
        ? normalized
        : DEFAULT_SORT_VARIANT;
}

function getSortVariantConfig(variant) {
    return SORT_VARIANT_CONFIG[normalizeSortVariant(variant)];
}

function getDefaultSortMode(variant = DEFAULT_SORT_VARIANT) {
    return getSortVariantConfig(variant).defaultMode;
}

function getRootSortVariant(root) {
    return normalizeSortVariant(root?.dataset?.listSortVariant || '');
}

function normalizeSortMode(mode, variant = DEFAULT_SORT_VARIANT, fallback = getDefaultSortMode(variant)) {
    const variantConfig = getSortVariantConfig(variant);
    const normalized = typeof mode === 'string' ? mode.toLowerCase() : '';
    if (Object.prototype.hasOwnProperty.call(variantConfig.modes, normalized)) {
        return normalized;
    }

    if (fallback === '') {
        return '';
    }

    const normalizedFallback = typeof fallback === 'string' ? fallback.toLowerCase() : '';
    return Object.prototype.hasOwnProperty.call(variantConfig.modes, normalizedFallback)
        ? normalizedFallback
        : variantConfig.defaultMode;
}

function parseSortMode(mode, variant = DEFAULT_SORT_VARIANT) {
    const variantConfig = getSortVariantConfig(variant);
    return variantConfig.modes[normalizeSortMode(mode, variant)];
}

function nextSortMode(currentMode, field, variant = DEFAULT_SORT_VARIANT) {
    const variantConfig = getSortVariantConfig(variant);
    const normalizedMode = normalizeSortMode(currentMode, variant);
    const fieldModes = variantConfig.fieldModes[field];
    if (!Array.isArray(fieldModes) || fieldModes.length !== 2) {
        return normalizedMode;
    }

    return normalizedMode === fieldModes[0] ? fieldModes[1] : fieldModes[0];
}

function readUrlSortMode(variant = DEFAULT_SORT_VARIANT) {
    try {
        const params = new URLSearchParams(window.location.search);
        return normalizeSortMode(params.get(SORT_QUERY_KEY) || '', variant, '');
    } catch (error) {
        return '';
    }
}

function buildSortHref(rawHref, mode, variant = DEFAULT_SORT_VARIANT) {
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

    const normalizedVariant = normalizeSortVariant(variant);
    const normalizedMode = normalizeSortMode(mode, normalizedVariant);
    if (normalizedMode === getDefaultSortMode(normalizedVariant)) {
        url.searchParams.delete(SORT_QUERY_KEY);
    } else {
        url.searchParams.set(SORT_QUERY_KEY, normalizedMode);
    }

    return `${url.pathname}${url.search}${url.hash}`;
}

function syncSortUrl(mode, historyMode, variant = DEFAULT_SORT_VARIANT) {
    if (historyMode !== 'push' && historyMode !== 'replace') {
        return;
    }

    const nextHref = buildSortHref(window.location.href, mode, variant);
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
    if (field === 'bytes') return Number(row.dataset.bytes || '0');
    if (field === 'path') return row.dataset.path || '';
    if (field === 'price') return Number(row.dataset.price || '0');
    if (field === 'value') return row.dataset.value || '';
    return 0;
}

function compareRows(leftRow, rightRow, config) {
    const left = readRowValue(leftRow, config.field);
    const right = readRowValue(rightRow, config.field);

    if (config.field === 'title' || config.field === 'path' || config.field === 'value') {
        const cmp = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) {
            return config.order === 'asc' ? cmp : -cmp;
        }
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

function sortRows(rows, mode, variant = DEFAULT_SORT_VARIANT) {
    const variantConfig = getSortVariantConfig(variant);
    const config = parseSortMode(mode, variant);
    const sortedRows = rows.slice().sort((left, right) => compareRows(left, right, config));

    if (!variantConfig.groupRows) {
        return sortedRows;
    }

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
    const variant = getRootSortVariant(root);
    const config = parseSortMode(mode, variant);
    const baseHref = root.dataset.listSortBaseHref || window.location.href;
    const controls = Array.from(root.querySelectorAll('[data-sort-field]'));

    controls.forEach((control) => {
        const field = control.dataset.sortField || '';
        const active = field === config.field;
        control.dataset.sortActive = active ? 'true' : 'false';
        control.dataset.sortDirection = active ? config.order : 'none';

        if (control.tagName === 'A') {
            control.setAttribute('href', buildSortHref(baseHref, nextSortMode(mode, field, variant), variant));
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

    sortRows(rows, mode, getRootSortVariant(root)).forEach((row) => list.appendChild(row));
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

    const normalizedVariant = normalizeSortVariant(
        options.variant
        || currentSortVariant
        || Array.from(sortRoots)[0]?.dataset?.listSortVariant
        || DEFAULT_SORT_VARIANT
    );
    const normalizedMode = normalizeSortMode(mode, normalizedVariant);
    currentSortVariant = normalizedVariant;
    currentSortMode = normalizedMode;

    sortRoots.forEach((root) => {
        const rootVariant = getRootSortVariant(root);
        applySortModeToRoot(root, normalizeSortMode(normalizedMode, rootVariant), rootVariant);
    });

    syncSortUrl(normalizedMode, options.historyMode || 'none', normalizedVariant);
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
    const variant = getRootSortVariant(root);
    const mode = nextSortMode(root.dataset.listSortMode || currentSortMode || getDefaultSortMode(variant), field, variant);
    applySortMode(mode, { historyMode: 'push', variant });
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
            const variant = currentSortVariant || Array.from(sortRoots)[0]?.dataset?.listSortVariant || DEFAULT_SORT_VARIANT;
            const urlMode = readUrlSortMode(variant) || getDefaultSortMode(variant);
            applySortMode(urlMode, { historyMode: 'none', variant });
        });
        popstateBound = true;
    }

    const roots = [];
    if (scope instanceof Element && scope.matches('[data-list-sort-root]')) {
        roots.push(scope);
    }
    roots.push(...Array.from(scope.querySelectorAll?.('[data-list-sort-root]') || []));
    roots.forEach(bindRoot);

    const initialVariant = getRootSortVariant(roots[0]);
    const initialMode = currentSortMode
        || readUrlSortMode(initialVariant)
        || normalizeSortMode(
            roots[0]?.dataset.listSortMode || roots[0]?.dataset.currentSort || getDefaultSortMode(initialVariant),
            initialVariant
        );
    applySortMode(initialMode, { historyMode: 'none', variant: initialVariant });

    const normalizedUrlMode = readUrlSortMode(initialVariant);
    if (normalizedUrlMode && normalizedUrlMode !== initialMode) {
        syncSortUrl(initialMode, 'replace', initialVariant);
    }
}

export { DEFAULT_SORT_MODE, SORT_QUERY_KEY, buildSortHref, nextSortMode, normalizeSortMode, parseSortMode };
