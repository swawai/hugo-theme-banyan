import {
    buildCollectionPageHref,
    buildCollectionSortToggleHref,
    getCollectionSortState,
    normalizeBreadcrumbCollectionSource,
} from './breadcrumb-items.js';

const BREADCRUMB_PREFETCH_SLOT = 'crumb';

function createCrumbText(text, { withCaret = false } = {}) {
    const span = document.createElement('span');
    span.className = 'crumb-text';
    span.textContent = text;
    if (withCaret) {
        const caret = document.createElement('span');
        caret.className = 'ui-dropdown-caret breadcrumb-menu-caret';
        caret.setAttribute('aria-hidden', 'true');
        caret.textContent = '▾';
        span.appendChild(caret);
    }
    return span;
}

function normalizeBreadcrumbItemKind(item) {
    const kind = item && typeof item.kind === 'string' ? item.kind.trim().toLowerCase() : '';
    return kind || '';
}

function applyBreadcrumbKind(element, item) {
    if (!(element instanceof Element)) {
        return;
    }

    const kind = normalizeBreadcrumbItemKind(item);
    if (kind) {
        element.dataset.breadcrumbKind = kind;
    }
}

function applyBreadcrumbPrefetchSlot(element) {
    if (element instanceof Element) {
        element.dataset.prefetchSlot = BREADCRUMB_PREFETCH_SLOT;
    }
}

function buildCollectionItemContent(item) {
    const fragment = document.createDocumentFragment();
    const kind = normalizeBreadcrumbItemKind(item);
    const iconName = typeof item?.icon === 'string' && item.icon.trim() !== ''
        ? item.icon.trim().toLowerCase()
        : (kind === 'page' ? 'file' : 'folder');
    const icon = document.createElement('span');
    icon.className = 'collection-item-icon';
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
    const state = getCollectionSortState(collectionSource);
    if (!state || !collectionSource?.label || !collectionSource?.href) {
        return null;
    }

    const copy = readCollectionSortCopy();
    const header = document.createElement('span');
    header.className = 'cell-title header collection-column-header collection-list-header';

    const label = document.createElement('a');
    label.className = 'collection-column-label';
    label.href = buildCollectionPageHref(
        collectionSource.href,
        collectionSource.logicalPath,
        state.sortVariant,
        state.defaultSort
    );
    label.title = collectionSource.label;
    label.textContent = collectionSource.label;
    applyBreadcrumbPrefetchSlot(label);

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
    header.append(label, separator, toggle);
    return header;
}

function buildMenuCell(menuItem) {
    const cell = document.createElement('span');
    cell.className = 'cell-title';
    const option = document.createElement('a');
    option.href = menuItem.href;
    option.className = menuItem.current
        ? 'ui-dropdown-option breadcrumb-menu-option collection-item-link is-current'
        : 'ui-dropdown-option breadcrumb-menu-option collection-item-link';
    applyBreadcrumbPrefetchSlot(option);
    applyBreadcrumbKind(option, menuItem);
    if (menuItem.current) {
        option.setAttribute('aria-current', 'page');
    }
    option.title = menuItem.title || menuItem.text || '';
    option.appendChild(buildCollectionItemContent(menuItem));
    cell.appendChild(option);
    return cell;
}

function buildCollectionColumnGrid(menuItems, collectionSource, options = {}) {
    const grid = document.createElement('span');
    grid.className = 'grid-list grid-list--single collection-list collection-list--column';
    const header = buildCollectionColumnHeader(collectionSource, options);
    if (header) {
        grid.classList.add('grid-list--headed');
        grid.appendChild(header);
    }
    menuItems.forEach((menuItem) => {
        grid.appendChild(buildMenuCell(menuItem));
    });
    return grid;
}

export function renderBreadcrumbMenuPanel(
    panel,
    menuItems,
    collectionSource = null,
    options = {}
) {
    if (!(panel instanceof Element) || !Array.isArray(menuItems)) {
        return;
    }

    panel.replaceChildren(buildCollectionColumnGrid(menuItems, collectionSource, options));
}

function buildMenuPanel(menuItems, collectionSource) {
    const panel = document.createElement('span');
    panel.className = 'ui-dropdown-panel breadcrumb-menu-panel';
    panel.hidden = true;
    panel.dataset.uiDropdownPanel = 'true';
    panel.dataset.breadcrumbMenuPanel = 'true';
    renderBreadcrumbMenuPanel(panel, menuItems, collectionSource);
    return panel;
}

function applyBreadcrumbLinkState(link, item, menuItems) {
    if (!(link instanceof Element)) {
        return;
    }

    if (item.current) {
        link.dataset.breadcrumbModeToggle = 'true';
    }

    if (Array.isArray(menuItems) && menuItems.length > 0) {
        link.classList.add('ui-dropdown-trigger', 'breadcrumb-menu-link');
        link.dataset.uiDropdownTrigger = 'true';
        link.dataset.breadcrumbMenuLink = 'true';
        link.setAttribute('aria-haspopup', 'true');
        link.setAttribute('aria-expanded', 'false');
    }
}

function buildTopBreadcrumbItem(item, index) {
    const isLead = index === 0;
    const linkClasses = ['breadcrumb-link'];
    if (isLead) {
        linkClasses.push('breadcrumb-link-lead');
    }
    if (item.current) {
        linkClasses.push('is-current');
    }

    const menuItems = Array.isArray(item.menu) ? item.menu.filter(Boolean) : [];
    const itemSpan = document.createElement('span');
    const collectionSource = item && typeof item === 'object'
        ? (item.collection_source || item.collectionSource)
        : null;
    const collectionHrefRaw = item && typeof item === 'object'
        ? (item.collection_href || item.collectionHref || collectionSource?.href || '')
        : '';
    const collectionHref = typeof collectionHrefRaw === 'string'
        ? collectionHrefRaw.trim()
        : '';

    itemSpan.className = menuItems.length > 0
        ? 'breadcrumb-item ui-dropdown breadcrumb-item-menu'
        : 'breadcrumb-item';
    if (menuItems.length > 0) {
        itemSpan.dataset.uiDropdown = 'true';
        itemSpan.dataset.breadcrumbMenu = 'true';
        if (collectionHref) {
            itemSpan.dataset.breadcrumbCollectionHref = collectionHref;
        }
    }

    const link = document.createElement('a');
    link.href = item.href;
    link.className = linkClasses.join(' ');
    applyBreadcrumbPrefetchSlot(link);
    applyBreadcrumbKind(link, item);
    if (item.current) {
        link.setAttribute('aria-current', 'page');
    }
    if (item.title) {
        link.title = item.title;
    }
    applyBreadcrumbLinkState(link, item, menuItems);
    link.appendChild(createCrumbText(item.text, { withCaret: item.current || menuItems.length > 0 }));
    itemSpan.appendChild(link);
    if (menuItems.length > 0) {
        itemSpan.appendChild(buildMenuPanel(menuItems, collectionSource));
    }

    return itemSpan;
}

export function renderTopBreadcrumb(items) {
    const container = document.querySelector('.slot-breadcrumb');
    if (!container || !Array.isArray(items) || items.length === 0) {
        return;
    }

    const nav = document.createElement('nav');
    nav.className = 'breadcrumb-nav';
    nav.setAttribute('aria-label', 'Breadcrumb');

    items.forEach((item, index) => {
        if (index > 0) {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb-sep';
            sep.setAttribute('aria-hidden', 'true');
            sep.textContent = '﹥';
            nav.appendChild(sep);
        }

        nav.appendChild(buildTopBreadcrumbItem(item, index));
    });

    container.replaceChildren(nav);
}
