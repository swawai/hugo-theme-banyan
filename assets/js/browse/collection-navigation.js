import {
    SORT_VARIANTS,
    applySortTokenToUrl,
    parseSortToken,
    readCurrentSortToken,
    toggleSortOrder,
} from './sort-policy.js';
import {
    applySortsTokensToUrl,
    buildDefaultSortsTokens,
    buildCurrentPageSortsTokens,
    getLogicalPathDepth,
    normalizeFromPath,
    readCurrentFromPath,
    readEffectiveSortsTokens,
} from './navigation-state.js';
import { readPageCollectionSource } from './collection-source.js';
import {
    ENTRY_LINEAGE_FIELD,
    hasFieldValue,
} from './navigation-state.contract.js';

function buildSortHref(token, defaultToken) {
    const url = new URL(window.location.href);
    applySortTokenToUrl(url, token, defaultToken);
    return `${url.pathname}${url.search}${url.hash}`;
}

function buildRelativeHref(url) {
    if (!(url instanceof URL)) return '';
    return url.origin === window.location.origin
        ? `${url.pathname}${url.search}${url.hash}`
        : url.toString();
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

function updateCollectionEntryLinks(grid, variantName, currentToken, pageCollectionSource) {
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

    grid.querySelectorAll('[data-collection-cell="name"] [data-collection-entry][href]').forEach((link) => {
        const rawHref = link.getAttribute('href') || '';
        if (!rawHref) return;

        let url;
        try {
            url = new URL(rawHref, window.location.origin);
        } catch (error) {
            return;
        }
        if (url.origin !== window.location.origin) return;

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

function updateCollectionSortControls(grid, variantName, currentToken) {
    const variant = SORT_VARIANTS[variantName];
    const current = parseSortToken(currentToken);
    if (!variant || !current) return;

    grid.querySelectorAll('a[data-sort-control="true"]').forEach((control) => {
        const field = (control.dataset.sortField || '').toLowerCase();
        const defaultOrder = (control.dataset.sortDefaultOrder || 'asc').toLowerCase();
        const active = field === current.field;
        const nextOrder = active ? toggleSortOrder(current.order) : defaultOrder;
        const nextToken = `${field}-${nextOrder}`;
        const indicator = control.querySelector('[data-sort-indicator]');
        const actionLabel = nextOrder === 'asc'
            ? control.dataset.sortTitleAsc || ''
            : control.dataset.sortTitleDesc || '';

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

export function refreshCollectionNavigation(grid, variantName, currentToken, pageCollectionSource) {
    if (!(grid instanceof Element)) return;
    updateCollectionSortControls(grid, variantName, currentToken);
    updateCollectionEntryLinks(grid, variantName, currentToken, pageCollectionSource);
}

export function refreshMainCollectionNavigation() {
    const grid = document.querySelector('.slot-main [data-sortable="true"][data-sort-variant]');
    if (!(grid instanceof Element)) return;

    const variantName = (grid.dataset.sortVariant || '').toLowerCase();
    const variant = SORT_VARIANTS[variantName];
    if (!variant) return;

    const currentToken = readCurrentSortToken(variantName, variant.defaultToken);
    refreshCollectionNavigation(grid, variantName, currentToken, readPageCollectionSource());
}
