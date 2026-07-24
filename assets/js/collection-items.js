import {
    SORT_VARIANTS,
    compareSortRecords,
    parseSortToken,
    readCurrentSortToken,
} from './sort-shared.js';
import {
    normalizeFromPath,
    readSortTokenForPath,
} from './nav-state.js';

export const ITEMS_PAYLOAD_PROVIDERS = new Set(['all', 'products', 'section-d', 'taxonomy']);

const itemsPayloadPromises = new Map();

function buildItemsUrl(fragmentRoot, logicalPath) {
    const root = fragmentRoot.endsWith('/') ? fragmentRoot : `${fragmentRoot}/`;
    const ownerRelative = logicalPath.replace(/^\/+/, '');
    return `${root}${ownerRelative}_items.json`;
}

export function getItemsPayload(fragmentRoot, logicalPath) {
    const url = buildItemsUrl(fragmentRoot, logicalPath);
    if (!itemsPayloadPromises.has(url)) {
        const promise = fetch(url, { credentials: 'same-origin' })
            .then((response) => (response && response.ok ? response.json() : null))
            .then((payload) => (payload && typeof payload === 'object' ? payload : null))
            .catch(() => null);
        itemsPayloadPromises.set(url, promise);
    }

    return itemsPayloadPromises.get(url);
}

export function supportsItemsPayloadProvider(provider) {
    return ITEMS_PAYLOAD_PROVIDERS.has(`${provider ?? ''}`.trim().toLowerCase());
}

function toRowSortKey(dataKey) {
    return String(dataKey || '')
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase();
}

export function decodeItemsPayload(payload) {
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

    const constants = payload.c && typeof payload.c === 'object' ? payload.c : {};
    const rows = [];

    for (let offset = 0, index = 0; offset < rowVector.length; offset += fields.length, index += 1) {
        const row = { ...constants, _originalIndex: index };
        for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
            const field = fields[fieldIndex];
            const rawValue = rowVector[offset + fieldIndex];
            row[field] = typeof rawValue === 'string' ? rawValue : `${rawValue ?? ''}`;
        }
        rows.push(row);
    }

    const sortVariant = typeof payload.sv === 'string' ? payload.sv.trim().toLowerCase() : '';
    const defaultSort = typeof payload.ds === 'string' ? payload.ds.trim().toLowerCase() : '';
    const provider = typeof payload.p === 'string' ? payload.p.trim().toLowerCase() : '';
    const logicalPath = typeof payload.lp === 'string' ? normalizeFromPath(payload.lp) : '';

    return { provider, logicalPath, sortVariant, defaultSort, rows };
}

function readItemsRowValue(row, fieldConfig) {
    if (!row || !fieldConfig) {
        return '';
    }

    return row[toRowSortKey(fieldConfig.dataKey)] ?? '';
}

function readItemsRowGroup(row) {
    return row?.sort_group ?? 0;
}

function readItemsRowStableKey(row) {
    return row?.href || row?.key || (row?._originalIndex ?? '');
}

export function readRequestedSortToken(sortVariant, logicalPath = '', defaultSort = '') {
    if (!sortVariant) {
        return '';
    }

    const fallbackToken = defaultSort || SORT_VARIANTS[sortVariant]?.defaultToken || '';
    if (!logicalPath) {
        return readCurrentSortToken(sortVariant, fallbackToken);
    }

    const normalizedLogicalPath = normalizeFromPath(logicalPath);
    return readSortTokenForPath(normalizedLogicalPath, fallbackToken);
}

export function sortItemsRows(rows, sortVariant, logicalPath = '', defaultSort = '') {
    const variant = SORT_VARIANTS[sortVariant];
    if (!variant) {
        return {
            rows: Array.isArray(rows) ? rows.slice() : [],
            token: '',
            defaultToken: defaultSort || ''
        };
    }

    const defaultToken = defaultSort || variant.defaultToken;
    const token = readRequestedSortToken(sortVariant, logicalPath, defaultToken);
    const current = parseSortToken(token);
    if (!variant.fields[current.field]) {
        return {
            rows: Array.isArray(rows) ? rows.slice() : [],
            token,
            defaultToken
        };
    }

    const sortedRows = (Array.isArray(rows) ? rows.slice() : []).sort((left, right) => {
        return compareSortRecords(left, right, {
            variant,
            field: current.field,
            order: current.order,
            readValue: readItemsRowValue,
            readGroup: readItemsRowGroup,
            readStableKey: readItemsRowStableKey,
        });
    });

    return { rows: sortedRows, token, defaultToken };
}

export function isCollectionRowKind(kind) {
    const normalized = `${kind ?? ''}`.trim().toLowerCase();
    return normalized !== '' && normalized !== 'page';
}
