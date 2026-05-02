import * as params from '@params';

const REQUIRED_FIELD_KEYS = Object.freeze(['entry_lineage', 'active_sort', 'lineage_sorts']);

function normalizeString(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function fail(message) {
    throw new Error(`navigation-state.contract: ${message}`);
}

function normalizeField(rawField, semanticKey) {
    const source = rawField && typeof rawField === 'object' ? rawField : null;
    if (!source) {
        fail(`missing field config for "${semanticKey}"`);
    }

    const name = normalizeString(source.name);
    if (!name) {
        fail(`field "${semanticKey}" must define a non-empty name`);
    }

    const aliasesSource = Array.isArray(source.aliases) ? source.aliases : [];
    const aliases = [];

    if (Array.isArray(aliasesSource)) {
        aliasesSource.forEach((aliasValue) => {
            const alias = normalizeString(aliasValue);
            if (!alias || alias === name || aliases.includes(alias)) return;
            aliases.push(alias);
        });
    }

    const keys = [name, ...aliases].filter(Boolean);
    const location = normalizeString(source.location) || 'query';
    const cacheKey = normalizeString(source.cache_key) || 'keep';
    const normalized = {
        name,
        aliases,
        keys,
        location,
        cache_key: cacheKey
    };

    const placeholder = typeof source.placeholder === 'string' && source.placeholder
        ? source.placeholder
        : '';
    if (placeholder) {
        normalized.placeholder = placeholder;
    }

    return Object.freeze(normalized);
}

function createFieldsMap() {
    const rawNavigationState = params && typeof params === 'object' ? params.navigationState : null;
    const rawFields = rawNavigationState && typeof rawNavigationState.fields === 'object'
        ? rawNavigationState.fields
        : {};
    const normalizedFields = {};

    REQUIRED_FIELD_KEYS.forEach((semanticKey) => {
        normalizedFields[semanticKey] = normalizeField(rawFields[semanticKey], semanticKey);
    });

    return Object.freeze(normalizedFields);
}

function getSearchParams(search) {
    if (search instanceof URLSearchParams) {
        return search;
    }

    if (search instanceof URL) {
        return search.searchParams;
    }

    const value = typeof search === 'string'
        ? search.replace(/^\?/, '')
        : '';
    return new URLSearchParams(value);
}

export const NAVIGATION_STATE_FIELDS = createFieldsMap();
export const ENTRY_LINEAGE_FIELD = NAVIGATION_STATE_FIELDS.entry_lineage;
export const ACTIVE_SORT_FIELD = NAVIGATION_STATE_FIELDS.active_sort;
export const LINEAGE_SORTS_FIELD = NAVIGATION_STATE_FIELDS.lineage_sorts;

export const FROM_PARAM_KEY = ENTRY_LINEAGE_FIELD.name;
export const SORT_PARAM_KEY = ACTIVE_SORT_FIELD.name;
export const SORTS_PARAM_KEY = LINEAGE_SORTS_FIELD.name;
export const SORTS_PLACEHOLDER = LINEAGE_SORTS_FIELD.placeholder || '_';

export const CACHE_IGNORED_QUERY_KEYS = Object.freeze(
    Object.values(NAVIGATION_STATE_FIELDS)
        .filter((field) => field.location === 'query' && field.cache_key === 'ignore')
        .flatMap((field) => field.keys)
        .filter((value, index, list) => value && list.indexOf(value) === index)
);

export function getFieldKeys(field) {
    return Array.isArray(field?.keys) ? field.keys.slice() : [];
}

export function fieldHasParamName(field, paramName) {
    const normalizedParamName = normalizeString(paramName);
    return normalizedParamName !== '' && getFieldKeys(field).includes(normalizedParamName);
}

export function readFieldValue(search, field) {
    const searchParams = getSearchParams(search);

    for (const key of getFieldKeys(field)) {
        const value = searchParams.get(key);
        if (typeof value === 'string') {
            return value;
        }
    }

    return '';
}

export function hasFieldValue(search, field) {
    const searchParams = getSearchParams(search);
    return getFieldKeys(field).some((key) => searchParams.has(key));
}

export function normalizeNavigationCacheUrl(urlValue, baseUrl = '') {
    try {
        const url = new URL(
            urlValue instanceof URL ? urlValue.toString() : urlValue,
            baseUrl || undefined
        );

        CACHE_IGNORED_QUERY_KEYS.forEach((queryKey) => {
            url.searchParams.delete(queryKey);
        });
        url.hash = '';
        return url.toString();
    } catch (error) {
        return '';
    }
}
