import {
    applySortQueryTokenToUrl,
    readCurrentSortTokenRaw,
} from './nav-state.js';

export const SORT_VARIANTS = {
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

export function parseSortToken(token) {
    const value = typeof token === 'string' ? token.trim().toLowerCase() : '';
    if (!value) return { field: '', order: '' };
    const parts = value.split('-');
    if (parts.length !== 2) return { field: '', order: '' };
    const [field, order] = parts;
    if (order !== 'asc' && order !== 'desc') return { field: '', order: '' };
    return { field, order };
}

export function getNormalizedSortToken(token, variantName, defaultTokenOverride = '') {
    const variant = SORT_VARIANTS[variantName];
    if (!variant) return '';
    const parsed = parseSortToken(token);
    if (!parsed.field || !variant.fields[parsed.field]) return defaultTokenOverride || variant.defaultToken;
    return `${parsed.field}-${parsed.order}`;
}

export function toggleSortOrder(order) {
    return order === 'asc' ? 'desc' : 'asc';
}

export function readCurrentSortToken(variantName, defaultTokenOverride = '') {
    return getNormalizedSortToken(readCurrentSortTokenRaw(), variantName, defaultTokenOverride);
}

export function applySortTokenToUrl(url, token, defaultToken) {
    return applySortQueryTokenToUrl(url, !token || token === defaultToken ? '' : token);
}
