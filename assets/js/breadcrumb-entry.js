import { initBreadcrumbMenus } from './breadcrumb-menu.js';
import {
    buildBreadcrumbMenuItems,
    buildCollectionPageHref,
    buildSelectedBreadcrumbItem,
    getSourceSortVariant,
    normalizeBreadcrumbCollectionSource as normalizeCollectionSource,
} from './breadcrumb-items.js';
import {
    normalizeCollectionLogicalPathFromUrl as normalizeLogicalPathFromUrl,
    normalizeFromPath,
    normalizePathname,
    readCurrentFromPath,
} from './nav-state.js';

const ENTRY_BREADCRUMB_PREVIEW_PENDING_ATTR = 'data-entry-breadcrumb-preview-pending';
const ENTRY_BREADCRUMB_META_PENDING_ATTR = 'data-entry-breadcrumb-meta-pending';

function clearEntryBreadcrumbPending() {
    document.documentElement?.removeAttribute(ENTRY_BREADCRUMB_PREVIEW_PENDING_ATTR);
    document.documentElement?.removeAttribute(ENTRY_BREADCRUMB_META_PENDING_ATTR);
}

function readFragmentRoot() {
    return document.body?.dataset.fragmentRoot || '';
}

function normalizeLinkItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const text = typeof item.text === 'string' ? item.text.trim() : '';
    const href = typeof item.href === 'string' ? item.href.trim() : '';
    if (!text || !href) {
        return null;
    }

    const normalized = { text, href };
    if (typeof item.title === 'string' && item.title.trim() !== '') {
        normalized.title = item.title.trim();
    }
    if (typeof item.current === 'boolean') {
        normalized.current = item.current;
    }
    if (typeof item.selected === 'boolean') {
        normalized.selected = item.selected;
    }
    if (typeof item.highlighted === 'boolean') {
        normalized.highlighted = item.highlighted;
    }
    if (typeof item.menu_button_label === 'string' && item.menu_button_label.trim() !== '') {
        normalized.menu_button_label = item.menu_button_label.trim();
    }
    if (Array.isArray(item.menu)) {
        const menuItems = item.menu.map(normalizeLinkItem).filter(Boolean);
        if (menuItems.length > 0) {
            normalized.menu = menuItems;
        }
    }

    return normalized;
}

function normalizeEntryBreadcrumbSources() {
    const raw = document.body?.dataset.entryBreadcrumbSources || '';
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map((source) => {
                if (!source || typeof source !== 'object') {
                    return null;
                }

                const logicalPath = normalizeFromPath(source.logical_path || source.logicalPath || '');
                const rootItem = normalizeLinkItem(source.root_item || source.rootItem);
                if (!logicalPath || !rootItem) {
                    return null;
                }

                const rootMenuItemsRaw = Array.isArray(source.root_menu || source.rootMenu) ? (source.root_menu || source.rootMenu) : [];
                const rootMenuItems = rootMenuItemsRaw.map(normalizeLinkItem).filter(Boolean);
                const tailItemsRaw = Array.isArray(source.tail_items || source.tailItems) ? (source.tail_items || source.tailItems) : [];
                const tailItems = tailItemsRaw.map(normalizeLinkItem).filter(Boolean);
                const rootMenuLabel = typeof (source.root_menu_label || source.rootMenuLabel) === 'string'
                    ? (source.root_menu_label || source.rootMenuLabel).trim()
                    : '';
                const provider = typeof source.provider === 'string' ? source.provider.trim().toLowerCase() : '';
                const levelsRaw = Array.isArray(source.levels) ? source.levels : [];
                const levels = levelsRaw
                    .map((level) => {
                        if (!level || typeof level !== 'object') {
                            return null;
                        }

                        const item = normalizeLinkItem(level.item);
                        if (!item) {
                            return null;
                        }

                        const normalized = { item };
                        const collectionSource = normalizeCollectionSource(level.collection_source || level.collectionSource);
                        if (collectionSource) {
                            normalized.collectionSource = collectionSource;
                        }

                        return normalized;
                    })
                    .filter(Boolean);
                const currentCollectionSource = normalizeCollectionSource(
                    source.current_collection_source || source.currentCollectionSource
                );

                return {
                    provider,
                    logicalPath,
                    rootItem,
                    rootMenuItems: rootMenuItems.length > 0 ? rootMenuItems : [rootItem],
                    rootMenuLabel: rootMenuLabel || rootItem.text,
                    tailItems,
                    levels,
                    currentCollectionSource,
                };
            })
            .filter(Boolean);
    } catch (error) {
        return [];
    }
}

function isEntryKeySafe(value) {
    return typeof value === 'string' && value !== '' && value !== '.' && value !== '..' && !/[/?#]/.test(value);
}

function parseEntrySelection(sources) {
    const normalized = readCurrentFromPath();
    if (!normalized || !Array.isArray(sources) || sources.length === 0) {
        return null;
    }

    const sortedSources = [...sources].sort((left, right) => right.logicalPath.length - left.logicalPath.length);
    for (const source of sortedSources) {
        if (!normalized.startsWith(source.logicalPath)) {
            continue;
        }

        const remainder = normalized.slice(source.logicalPath.length);
        const parts = remainder.split('/').filter(Boolean);
        if (parts.length !== 1) {
            continue;
        }

        const entryKey = parts[0];
        if (!isEntryKeySafe(entryKey)) {
            return null;
        }

        return {
            source,
            entryKey,
        };
    }

    return null;
}

async function buildPrefixLevelItem(fragmentRoot, source, level) {
    const baseItem = normalizeLinkItem(level?.item);
    if (!baseItem) {
        return null;
    }

    const currentCollectionSource = normalizeCollectionSource(source?.currentCollectionSource) || null;
    const sortVariant = currentCollectionSource?.sortVariant || getSourceSortVariant(source);
    const defaultSort = currentCollectionSource?.defaultSort || '';
    const siteRoot = document.body?.dataset.siteRoot || '/';

    let targetLogicalPath = '';
    let targetPathname = '';
    try {
        const targetUrl = new URL(baseItem.href, window.location.origin);
        targetLogicalPath = normalizeLogicalPathFromUrl(targetUrl, siteRoot);
        targetPathname = normalizePathname(targetUrl.pathname);
    } catch (error) {
        targetLogicalPath = '';
        targetPathname = '';
    }

    const result = {
        text: baseItem.text,
        href: targetLogicalPath
            ? buildCollectionPageHref(baseItem.href, targetLogicalPath, sortVariant, defaultSort)
            : baseItem.href,
        current: false,
    };
    if (baseItem.title) {
        result.title = baseItem.title;
    }

    const collectionSource = normalizeCollectionSource(level?.collectionSource) || null;
    if (collectionSource) {
        const menu = await buildBreadcrumbMenuItems(fragmentRoot, collectionSource, {
            selectedPathname: targetPathname,
        });
        if (menu.length > 0) {
            result.menu = menu;
            result.menu_button_label = baseItem.menu_button_label || baseItem.text;
        }
        return result;
    }

    if (Array.isArray(baseItem.menu) && baseItem.menu.length > 0) {
        result.menu = baseItem.menu;
        result.menu_button_label = baseItem.menu_button_label || baseItem.text;
    }

    return result;
}

async function buildPrefixItems(fragmentRoot, source) {
    const levels = Array.isArray(source?.levels) ? source.levels : [];
    if (levels.length > 0) {
        const items = (await Promise.all(levels.map((level) => buildPrefixLevelItem(fragmentRoot, source, level)))).filter(Boolean);
        if (items.length > 0) {
            return items;
        }
    }

    return Array.isArray(source?.tailItems)
        ? source.tailItems.map((item) => ({ ...item, current: false }))
        : [];
}

function buildBreadcrumbItems(prefixItems, currentItem) {
    const safePrefixItems = Array.isArray(prefixItems) ? prefixItems : [];
    return [...safePrefixItems, currentItem];
}

async function buildEntryState() {
    const fragmentRoot = readFragmentRoot();
    if (!fragmentRoot) {
        return null;
    }

    const sources = normalizeEntryBreadcrumbSources();
    const selection = parseEntrySelection(sources);
    if (!selection) {
        return null;
    }

    const prefixItemsPromise = buildPrefixItems(fragmentRoot, selection.source);
    const currentItem = await buildSelectedBreadcrumbItem(fragmentRoot, selection.source, selection.entryKey);
    if (!currentItem) {
        return null;
    }

    const currentPathname = normalizePathname(window.location.pathname);
    const resolvedPathname = normalizePathname(new URL(currentItem.href, window.location.origin).pathname);
    if (currentPathname !== resolvedPathname) {
        return null;
    }

    const prefixItems = await prefixItemsPromise;
    const breadcrumbItems = buildBreadcrumbItems(prefixItems, currentItem);
    return {
        rootItem: selection.source.rootItem,
        rootMenuItems: selection.source.rootMenuItems,
        rootMenuLabel: selection.source.rootMenuLabel,
        breadcrumbItems,
        metaLabel: selection.source.rootItem.text,
        metaItems: breadcrumbItems,
    };
}

function createCrumbText(text, { withCaret = false } = {}) {
    const span = document.createElement('span');
    span.className = 'crumb-text';
    span.textContent = text;
    if (withCaret) {
        const caret = document.createElement('span');
        caret.className = 'breadcrumb-menu-caret';
        caret.setAttribute('aria-hidden', 'true');
        caret.textContent = '▾';
        span.appendChild(caret);
    }
    return span;
}

function buildMenuPanel(menuItems) {
    const panel = document.createElement('span');
    panel.className = 'breadcrumb-menu-panel';
    panel.hidden = true;
    panel.dataset.breadcrumbMenuPanel = '';

    menuItems.forEach((menuItem) => {
        const option = document.createElement('a');
        option.href = menuItem.href;
        option.className = menuItem.current ? 'breadcrumb-menu-option is-current' : 'breadcrumb-menu-option';
        if (menuItem.current) {
            option.dataset.siteUpdateAnchor = 'true';
            option.setAttribute('aria-current', 'page');
        }
        option.textContent = menuItem.text;
        panel.appendChild(option);
    });

    return panel;
}

function applyBreadcrumbLinkState(link, item, menuItems) {
    if (!(link instanceof Element)) {
        return;
    }

    if (item.current) {
        link.dataset.breadcrumbModeToggle = 'true';
    }

    if (Array.isArray(menuItems) && menuItems.length > 1) {
        link.classList.add('breadcrumb-menu-link');
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
    itemSpan.className = menuItems.length > 1 ? 'breadcrumb-item breadcrumb-item-menu' : 'breadcrumb-item';
    if (menuItems.length > 1) {
        itemSpan.dataset.breadcrumbMenu = '';
    }

    const link = document.createElement('a');
    link.href = item.href;
    link.className = linkClasses.join(' ');
    if (item.current) {
        link.dataset.siteUpdateAnchor = 'true';
        link.setAttribute('aria-current', 'page');
    }
    if (item.title) {
        link.title = item.title;
    }
    applyBreadcrumbLinkState(link, item, menuItems);
    link.appendChild(createCrumbText(item.text, { withCaret: item.current || menuItems.length > 1 }));
    itemSpan.appendChild(link);
    if (menuItems.length > 1) {
        itemSpan.appendChild(buildMenuPanel(menuItems));
    }

    return itemSpan;
}

function renderTopBreadcrumb(items) {
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

function normalizeMenuState(rootItem, rootMenuItems) {
    const menuItems = Array.isArray(rootMenuItems) ? rootMenuItems : [];
    const highlightedItems = menuItems.filter((item) => item && item.highlighted === true);
    if (highlightedItems.length > 0) {
        return menuItems
            .map((item) => normalizeLinkItem(item))
            .filter(Boolean)
            .map((item) => ({
                ...item,
                current: item.highlighted === true,
            }));
    }

    const currentItems = menuItems.filter((item) => item && item.current === true);
    if (currentItems.length > 0) {
        return menuItems
            .map((item) => normalizeLinkItem(item))
            .filter(Boolean)
            .map((item) => ({
                ...item,
                current: item.current === true,
            }));
    }

    const selectedItems = menuItems.filter((item) => item && item.selected === true);
    if (selectedItems.length > 0) {
        return menuItems
            .map((item) => normalizeLinkItem(item))
            .filter(Boolean)
            .map((item) => ({
                ...item,
                current: item.selected === true,
            }));
    }

    const selectedPathname = normalizePathname(new URL(rootItem.href, window.location.origin).pathname);

    return menuItems
        .map((item) => normalizeLinkItem(item))
        .filter(Boolean)
        .map((item) => ({
            ...item,
            current: normalizePathname(new URL(item.href, window.location.origin).pathname) === selectedPathname,
        }));
}

function buildRootStageNav(rootItem, rootMenuItems, rootMenuLabel) {
    const nav = document.createElement('nav');
    nav.className = 'breadcrumb-root-nav breadcrumb-root-nav-stage';
    nav.setAttribute('aria-label', rootMenuLabel || rootItem.text || 'Breadcrumb root');

    const menuItems = normalizeMenuState(rootItem, rootMenuItems);
    const visibleItem = {
        ...rootItem,
        current: false,
        menu: menuItems,
        menu_button_label: rootMenuLabel || rootItem.text || 'Breadcrumb root',
    };

    nav.appendChild(buildTopBreadcrumbItem(visibleItem, 0));
    return nav;
}

function buildRootRailNav(rootItem, rootMenuItems, rootMenuLabel) {
    const nav = document.createElement('nav');
    nav.className = 'breadcrumb-root-nav breadcrumb-root-nav-list';
    nav.setAttribute('aria-label', rootMenuLabel || rootItem.text || 'Breadcrumb root');

    const menuItems = normalizeMenuState(rootItem, rootMenuItems);
    if (menuItems.length <= 1) {
        const link = document.createElement('a');
        link.href = rootItem.href;
        link.className = 'breadcrumb-root-link';
        link.textContent = rootItem.text;
        nav.appendChild(link);
        return nav;
    }

    const list = document.createElement('div');
    list.className = 'breadcrumb-root-list';
    list.setAttribute('role', 'list');

    menuItems.forEach((menuItem) => {
        const item = document.createElement('span');
        item.className = 'breadcrumb-root-list-item';
        item.setAttribute('role', 'listitem');

        const link = document.createElement('a');
        link.href = menuItem.href;
        link.className = menuItem.current ? 'breadcrumb-root-link is-current' : 'breadcrumb-root-link';
        link.textContent = menuItem.text;
        if (menuItem.current) {
            link.dataset.siteUpdateAnchor = 'true';
            link.setAttribute('aria-current', 'page');
        }
        if (menuItem.title) {
            link.title = menuItem.title;
        }

        item.appendChild(link);
        list.appendChild(item);
    });

    nav.appendChild(list);
    return nav;
}

function renderRootSelection(rootItem, rootMenuItems, rootMenuLabel) {
    if (!rootItem || typeof rootItem.text !== 'string' || rootItem.text === '' || typeof rootItem.href !== 'string' || rootItem.href === '') {
        return;
    }

    const stageContainer = document.querySelector('.slot-breadcrumb-root-stage');
    if (stageContainer) {
        stageContainer.replaceChildren(buildRootStageNav(rootItem, rootMenuItems, rootMenuLabel));
    }

    const railContainer = document.querySelector('.slot-breadcrumb-root-rail');
    if (railContainer) {
        railContainer.replaceChildren(buildRootRailNav(rootItem, rootMenuItems, rootMenuLabel));
    }
}

function ensureArticleMetaPathNav(metaLabel) {
    const existing = document.querySelector('.post-taxonomy-path');
    if (existing) {
        return existing;
    }

    const metaContainer = document.querySelector('.article-meta');
    if (!metaContainer) {
        return null;
    }

    const nav = document.createElement('nav');
    nav.className = 'post-taxonomy post-taxonomy-path';
    nav.setAttribute('aria-label', metaLabel || 'Path');
    metaContainer.prepend(nav);
    return nav;
}

function renderArticleMetaPath(metaLabel, items) {
    const nav = ensureArticleMetaPathNav(metaLabel);
    if (!nav || !Array.isArray(items) || items.length === 0) {
        return;
    }

    nav.setAttribute('aria-label', metaLabel || 'Path');
    nav.replaceChildren();

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = metaLabel || 'Path';
    nav.appendChild(label);

    items.forEach((item, index) => {
        if (index > 0) {
            const sep = document.createElement('span');
            sep.className = 'sep';
            sep.setAttribute('aria-hidden', 'true');
            sep.textContent = '/';
            nav.appendChild(sep);
        }

        const link = document.createElement('a');
        link.href = item.href;
        link.textContent = item.text;
        if (item.current) {
            link.setAttribute('aria-current', 'page');
        }
        nav.appendChild(link);
    });
}

export async function initEntryBreadcrumb() {
    try {
        const state = await buildEntryState();
        if (!state || !Array.isArray(state.breadcrumbItems) || state.breadcrumbItems.length === 0) {
            return;
        }

        renderRootSelection(state.rootItem, state.rootMenuItems, state.rootMenuLabel);
        renderTopBreadcrumb(state.breadcrumbItems);
        renderArticleMetaPath(state.metaLabel, state.metaItems || []);
        initBreadcrumbMenus();
    } finally {
        clearEntryBreadcrumbPending();
    }
}
