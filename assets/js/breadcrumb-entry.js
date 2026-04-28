import { initBreadcrumbMenus } from './breadcrumb-menu.js';

const childrenPayloadPromises = new Map();

function readFragmentRoot() {
    return document.body?.dataset.fragmentRoot || '';
}

function readSiteRoot() {
    return document.body?.dataset.siteRoot || '/';
}

function readEntryTaxonomyRoots() {
    const raw = document.body?.dataset.entryTaxonomyRoots || '';
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function normalizeSiteRoot(siteRoot) {
    if (typeof siteRoot !== 'string' || siteRoot === '') {
        return '/';
    }

    let value = siteRoot.trim();
    if (!value.startsWith('/')) {
        value = `/${value}`;
    }
    if (!value.endsWith('/')) {
        value = `${value}/`;
    }

    return value;
}

function normalizeFromPath(value) {
    if (typeof value !== 'string') {
        return '';
    }

    let path = value.trim();
    if (!path.startsWith('/')) {
        return '';
    }
    if (!path.endsWith('/')) {
        path = `${path}/`;
    }

    return path;
}

function parseEntryPath(entryTaxonomyRoots) {
    const params = new URLSearchParams(window.location.search);
    const rawFrom = params.get('from') || '';
    const normalized = normalizeFromPath(rawFrom);
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) {
        return null;
    }

    const rootKey = parts[0];
    const keys = parts.slice(1);
    const isSafe = keys.every((key) => key && key !== '.' && key !== '..' && !/[/?#]/.test(key));
    if (!isSafe) {
        return null;
    }

    if (rootKey === 'd') {
        return {
            type: 'section',
            rootKey,
            logicalPath: normalized,
            keys,
        };
    }

    const rootMeta = entryTaxonomyRoots?.[rootKey];
    if (!rootMeta || typeof rootMeta !== 'object') {
        return null;
    }

    return {
        type: 'taxonomy',
        rootKey,
        rootMeta,
        logicalPath: normalized,
        keys,
    };
}

function buildOwnerPath(entryPath, index) {
    const prefix = `/${entryPath.rootKey}/`;
    if (index <= 0) {
        return prefix;
    }

    return `${prefix}${entryPath.keys.slice(0, index).join('/')}/`;
}

function buildFragmentUrl(fragmentRoot, ownerPath) {
    const root = fragmentRoot.endsWith('/') ? fragmentRoot : `${fragmentRoot}/`;
    const ownerRelative = ownerPath.replace(/^\/+/, '');
    return `${root}${ownerRelative}_children.json`;
}

function localizeLogicalPath(siteRoot, logicalPath) {
    const root = normalizeSiteRoot(siteRoot);
    const relativePath = logicalPath.replace(/^\/+/, '');
    return root === '/' ? `/${relativePath}` : `${root}${relativePath}`;
}

function resolveItemHref(siteRoot, ownerPath, item) {
    const explicitHref = typeof item?.[3] === 'string' ? item[3] : '';
    if (explicitHref) {
        return explicitHref;
    }

    if (typeof item?.[0] === 'string' && item[0] !== '') {
        return localizeLogicalPath(siteRoot, `${ownerPath}${item[0]}/`);
    }

    return '';
}

function normalizePathname(pathname) {
    if (typeof pathname !== 'string' || pathname === '') {
        return '/';
    }

    const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return normalized === '//' ? '/' : normalized;
}

function getChildrenPayload(fragmentRoot, ownerPath) {
    const url = buildFragmentUrl(fragmentRoot, ownerPath);
    if (!childrenPayloadPromises.has(url)) {
        const promise = fetch(url, { credentials: 'same-origin' })
            .then((response) => (response && response.ok ? response.json() : null))
            .then((payload) => (Array.isArray(payload) ? payload : null))
            .catch(() => null);
        childrenPayloadPromises.set(url, promise);
    }

    return childrenPayloadPromises.get(url);
}

function buildMenu(payload, ownerPath, selectedKey, siteRoot) {
    return payload
        .map((item) => {
            if (!Array.isArray(item) || typeof item[1] !== 'string') {
                return null;
            }

            const optionHref = resolveItemHref(siteRoot, ownerPath, item);
            if (!optionHref) {
                return null;
            }

            return {
                text: item[1],
                href: optionHref,
                current: item[0] === selectedKey,
            };
        })
        .filter(Boolean);
}

function buildSelectedItems(entryPath, payloads, siteRoot) {
    const items = [];

    for (let index = 0; index < entryPath.keys.length; index += 1) {
        const ownerPath = buildOwnerPath(entryPath, index);
        const payload = payloads[index];
        const key = entryPath.keys[index];
        const selectedItem = payload.find((item) => Array.isArray(item) && item[0] === key);
        if (!selectedItem) {
            return null;
        }

        const href = resolveItemHref(siteRoot, ownerPath, selectedItem);
        if (!href) {
            return null;
        }

        items.push({
            text: typeof selectedItem[1] === 'string' && selectedItem[1] !== '' ? selectedItem[1] : key,
            href,
            current: index === entryPath.keys.length - 1,
            menu: buildMenu(payload, ownerPath, key, siteRoot),
        });
    }

    return items;
}

function buildTaxonomyRootItem(entryPath) {
    const rootMeta = entryPath.rootMeta || {};
    if (typeof rootMeta.label !== 'string' || rootMeta.label === '' || typeof rootMeta.href !== 'string' || rootMeta.href === '') {
        return null;
    }

    return {
        text: rootMeta.label,
        href: rootMeta.href,
        current: false,
    };
}

async function buildEntryState() {
    const fragmentRoot = readFragmentRoot();
    if (!fragmentRoot) {
        return null;
    }

    const entryTaxonomyRoots = readEntryTaxonomyRoots();
    const entryPath = parseEntryPath(entryTaxonomyRoots);
    if (!entryPath) {
        return null;
    }

    const siteRoot = readSiteRoot();
    const owners = entryPath.keys.map((_, index) => buildOwnerPath(entryPath, index));
    const payloads = await Promise.all(owners.map((ownerPath) => getChildrenPayload(fragmentRoot, ownerPath)));
    if (payloads.some((payload) => !Array.isArray(payload))) {
        return null;
    }

    const selectedItems = buildSelectedItems(entryPath, payloads, siteRoot);
    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
        return null;
    }

    const currentItem = selectedItems[selectedItems.length - 1];
    const currentPathname = normalizePathname(window.location.pathname);
    const resolvedPathname = normalizePathname(new URL(currentItem.href, window.location.origin).pathname);
    if (currentPathname !== resolvedPathname) {
        return null;
    }

    if (entryPath.type === 'section') {
        return {
            breadcrumbItems: selectedItems,
            rootItem: null,
            metaLabel: '',
            metaItems: selectedItems,
        };
    }

    const rootItem = buildTaxonomyRootItem(entryPath);
    if (!rootItem) {
        return null;
    }

    return {
        breadcrumbItems: selectedItems,
        rootItem,
        metaLabel: rootItem.text,
        metaItems: selectedItems,
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

function renderRootSelection(rootItem) {
    if (!rootItem || typeof rootItem.text !== 'string' || rootItem.text === '') {
        return;
    }

    const rootLink = document.querySelector('.slot-breadcrumb-root-stage [data-breadcrumb-menu-link="true"], .slot-breadcrumb-root-stage .breadcrumb-link');
    if (!(rootLink instanceof HTMLAnchorElement)) {
        return;
    }

    rootLink.href = rootItem.href;
    if (rootItem.title) {
        rootLink.title = rootItem.title;
    } else {
        rootLink.removeAttribute('title');
    }

    const crumbText = rootLink.querySelector('.crumb-text');
    if (crumbText) {
        const arrow = crumbText.querySelector('.breadcrumb-menu-caret');
        crumbText.textContent = rootItem.text;
        if (arrow) {
            crumbText.appendChild(arrow);
        }
    } else {
        rootLink.textContent = rootItem.text;
    }

    const optionLinks = Array.from(document.querySelectorAll('.slot-breadcrumb-root-stage .breadcrumb-menu-panel a[href]'));
    optionLinks.forEach((optionLink) => {
        const isCurrentRoot = optionLink.getAttribute('href') === rootItem.href;
        optionLink.classList.toggle('is-current', isCurrentRoot);
        if (isCurrentRoot) {
            optionLink.setAttribute('aria-current', 'page');
            optionLink.dataset.siteUpdateAnchor = 'true';
        } else {
            optionLink.removeAttribute('aria-current');
            delete optionLink.dataset.siteUpdateAnchor;
        }
    });
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
    if (!nav || !Array.isArray(items)) {
        return;
    }

    const currentLabel = nav.querySelector?.('.label')?.textContent?.trim() || 'Path';
    const finalLabel = metaLabel || currentLabel;
    nav.setAttribute('aria-label', finalLabel);
    nav.replaceChildren();

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = finalLabel;
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
    const state = await buildEntryState();
    if (!state || !Array.isArray(state.breadcrumbItems) || state.breadcrumbItems.length === 0) {
        return;
    }

    renderRootSelection(state.rootItem);
    renderTopBreadcrumb(state.breadcrumbItems);
    renderArticleMetaPath(state.metaLabel, state.metaItems || []);
    initBreadcrumbMenus();
}
