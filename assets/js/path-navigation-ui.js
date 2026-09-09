import {
    buildCollectionPageHref,
    buildCollectionSortToggleHref,
    getCollectionSortState,
    normalizeBreadcrumbCollectionSource,
} from './breadcrumb-items.js';
import { normalizeIcon } from './icon-value.js';

const BREADCRUMB_PREFETCH_SLOT = 'crumb';

function normalizeBreadcrumbItemKind(item) {
    const kind = item && typeof item.kind === 'string' ? item.kind.trim().toLowerCase() : '';
    return kind || '';
}

function applyBreadcrumbPrefetchSlot(element) {
    if (element instanceof Element) {
        element.dataset.prefetchSlot = BREADCRUMB_PREFETCH_SLOT;
    }
}

function buildCollectionItemContent(item) {
    const fragment = document.createDocumentFragment();
    const kind = normalizeBreadcrumbItemKind(item);
    const value = normalizeIcon(item?.icon) || (kind === 'page' ? 'file' : 'folder');
    const icon = document.createElement('span');
    icon.className = 'collection-item-icon';
    if (typeof value === 'object' && value.image) {
        icon.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.className = 'icon icon--image';
        if (value.monochrome) image.classList.add('icon--monochrome');
        image.src = value.image;
        image.alt = '';
        image.width = 16;
        image.height = 16;
        image.decoding = 'async';
        image.setAttribute('aria-hidden', 'true');
        icon.appendChild(image);
    } else if (typeof value === 'object') {
        icon.classList.add('collection-item-icon--text');
        icon.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.className = 'icon icon--text';
        text.setAttribute('aria-hidden', 'true');
        text.textContent = value.text;
        icon.appendChild(text);
    } else {
        const iconName = value;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('icon', `icon-${iconName}`, 'collection-item-icon-svg');
        svg.setAttribute('width', '1em');
        svg.setAttribute('height', '1em');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#icon-${iconName}`);
        svg.appendChild(use);
        icon.appendChild(svg);
    }

    const title = document.createElement('span');
    title.className = 'collection-item-title';
    title.textContent = item?.text || '';
    fragment.append(icon, title);
    return fragment;
}

function readCollectionSortCopy() {
    const rawCopy = document.body?.dataset.collectionSortCopy || '';
    if (!rawCopy) {
        return { fields: {}, actions: {} };
    }

    try {
        const copy = JSON.parse(rawCopy);
        return {
            fields: copy?.fields && typeof copy.fields === 'object' ? copy.fields : {},
            actions: copy?.actions && typeof copy.actions === 'object' ? copy.actions : {},
        };
    } catch (error) {
        return { fields: {}, actions: {} };
    }
}

function buildCollectionColumnHeader(source, { lineageLogicalPath = '' } = {}) {
    const collectionSource = normalizeBreadcrumbCollectionSource(source);
    if (!collectionSource?.label || !collectionSource?.href) {
        return null;
    }

    const header = document.createElement('span');
    header.className = 'cell-title header collection-column-header collection-list-header';
    const label = document.createElement('a');
    label.className = 'collection-column-label';
    label.href = collectionSource.href;
    label.title = collectionSource.label;
    label.textContent = collectionSource.label;
    applyBreadcrumbPrefetchSlot(label);
    header.appendChild(label);

    const state = getCollectionSortState(collectionSource);
    if (!state) {
        return header;
    }
    label.href = buildCollectionPageHref(
        collectionSource.href,
        collectionSource.logicalPath,
        state.sortVariant,
        state.defaultSort
    );
    const copy = readCollectionSortCopy();

    const separator = document.createElement('span');
    separator.className = 'collection-column-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '·';

    const toggle = document.createElement('a');
    toggle.className = 'collection-column-sort';
    toggle.href = buildCollectionSortToggleHref(
        collectionSource,
        window.location.href,
        lineageLogicalPath
    );
    toggle.dataset.collectionSortToggle = 'true';
    applyBreadcrumbPrefetchSlot(toggle);
    const actionLabel = copy.actions[state.nextToken] || state.nextToken;
    toggle.title = actionLabel;
    toggle.setAttribute('aria-label', actionLabel);

    const sortLabel = document.createElement('span');
    sortLabel.className = 'collection-sort-label';
    sortLabel.textContent = copy.fields[state.field] || state.field;
    const indicator = document.createElement('span');
    indicator.className = 'collection-sort-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = state.order === 'asc' ? '↑' : '↓';
    toggle.append(sortLabel, indicator);
    header.append(separator, toggle);
    return header;
}

function buildCollectionCell(item, current) {
    const cell = document.createElement('span');
    cell.className = 'cell-title';
    const option = document.createElement('a');
    option.href = item.href;
    option.className = current
        ? 'path-column-link collection-item-link is-current'
        : 'path-column-link collection-item-link';
    applyBreadcrumbPrefetchSlot(option);
    if (current) {
        option.setAttribute('aria-current', 'page');
    }
    option.title = item.title || item.text || '';
    option.appendChild(buildCollectionItemContent(item));
    cell.appendChild(option);
    return cell;
}

function buildCollectionColumnGrid(items, collectionSource, options = {}) {
    const grid = document.createElement('div');
    grid.className = 'grid-list collection-list collection-list--column';
    const header = buildCollectionColumnHeader(collectionSource, options);
    if (header) {
        grid.classList.add('grid-list--headed');
        grid.appendChild(header);
    }
    items.forEach((item) => {
        grid.appendChild(buildCollectionCell(item, item.current === true));
    });
    return grid;
}

export function renderPathColumn(
    column,
    items,
    collectionSource = null,
    options = {}
) {
    if (!(column instanceof Element) || !Array.isArray(items)) {
        return;
    }

    column.replaceChildren(buildCollectionColumnGrid(items, collectionSource, options));
}

function buildPathColumn(item) {
    const columnItems = Array.isArray(item.column_items) ? item.column_items.filter(Boolean) : [];
    const collectionSource = item.collection_source || item.collectionSource || {
        href: item.collection_href || '',
        label: item.collection_label || '',
    };
    const collectionHref = item.collection_href || item.collectionHref || collectionSource.href || '';
    const column = document.createElement('div');
    column.className = 'path-column';
    column.dataset.collectionColumn = 'true';
    if (collectionHref) {
        column.dataset.breadcrumbCollectionHref = collectionHref;
    }
    renderPathColumn(column, columnItems.length > 0 ? columnItems : [item], collectionSource);
    return column;
}

export function renderPathColumns(items) {
    const container = document.querySelector('.slot-breadcrumb');
    if (!container || !Array.isArray(items) || items.length === 0) {
        return;
    }

    const nav = document.createElement('nav');
    nav.className = 'path-navigation';
    nav.setAttribute('aria-label', 'Breadcrumb');

    items.forEach((item) => nav.appendChild(buildPathColumn(item)));

    container.replaceChildren(nav);
}
