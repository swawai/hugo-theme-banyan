// Removed with the old navigation controls in flattening step 4.
import { settingsReturnUrl } from '../../preferences/settings-navigation.js';

function getVersionMenus() {
    return Array.from(document.querySelectorAll('[data-site-version-menu]'));
}

function getVersionMenuRoot(target) {
    return target instanceof Element ? target.closest('[data-site-version-menu]') : null;
}

function getVersionPanel(menuRoot) {
    return menuRoot instanceof Element ? menuRoot.querySelector('[data-nav-utility-panel]') : null;
}

function getVersionTrigger(menuRoot) {
    return menuRoot instanceof Element ? menuRoot.querySelector('[data-site-version-trigger]') : null;
}

function isVersionMenuOpen(menuRoot) {
    return menuRoot instanceof Element && menuRoot.classList.contains('is-open');
}

function closeVersionMenu(menuRoot) {
    if (!(menuRoot instanceof Element)) return;

    const closeRoot = window.__banyanNavUtilityMenus?.closeRoot;
    if (typeof closeRoot === 'function' && closeRoot(menuRoot)) return;

    const panel = getVersionPanel(menuRoot);
    const trigger = getVersionTrigger(menuRoot);
    menuRoot.classList.remove('is-open');
    menuRoot.removeAttribute('data-open');
    if (panel instanceof HTMLElement) panel.hidden = true;
    if (trigger instanceof HTMLElement) trigger.setAttribute('aria-expanded', 'false');
}

function getVersionChangelogHref(copy, menuRoot) {
    const menuHref = menuRoot instanceof HTMLElement ? menuRoot.dataset.siteVersionChangelogHref || '' : '';
    return menuHref || copy.versionChangelogHref || '';
}

function getVersionHomeOption(copy, menuRoot) {
    const homeHref = menuRoot instanceof HTMLElement ? menuRoot.dataset.siteVersionHomeHref || '' : '';
    const homeLabel = menuRoot instanceof HTMLElement ? menuRoot.dataset.siteVersionHomeLabel || '' : '';
    if (!homeHref) return null;

    return createOption({
        text: homeLabel || copy.versionHome,
        href: homeHref,
        action: 'home',
        current: isCurrentHref(homeHref)
    });
}

function normalizePathname(href) {
    try {
        const url = new URL(href, window.location.href);
        let path = url.pathname || '/';
        if (!path.endsWith('/')) path = `${path}/`;
        return path;
    } catch (error) {
        return '';
    }
}

function isCurrentHref(href) {
    if (!href) return false;
    const target = normalizePathname(href);
    const current = normalizePathname(window.location.href);
    return Boolean(target && current && target === current);
}

function createOption({ text, href = '', action = '', disabled = false, title = '', current = false }) {
    const option = href ? document.createElement('a') : document.createElement('button');
    option.className = 'ui-dropdown-option site-nav-utility-option';
    if (current) {
        option.classList.add('is-current');
        option.setAttribute('aria-current', 'page');
    }
    option.dataset.navUtilityOption = 'true';
    option.textContent = text;
    if (href) {
        option.href = href;
    } else {
        option.type = 'button';
        option.disabled = disabled;
    }
    if (action) option.dataset.siteVersionAction = action;
    if (title) option.title = title;
    return option;
}

function renderVersionMenu(menuRoot, { copy, version, versionLabel, status, statusValue }) {
    const panel = getVersionPanel(menuRoot);
    if (!(panel instanceof HTMLElement)) return;

    const changelogHref = getVersionChangelogHref(copy, menuRoot);
    const homeOption = getVersionHomeOption(copy, menuRoot);
    const options = [
        createOption({
            text: versionLabel,
            href: changelogHref,
            disabled: !changelogHref,
            title: version,
            current: isCurrentHref(changelogHref)
        }),
        createOption({
            text: `${copy.versionStatus}: ${statusValue}`,
            action: 'check',
            disabled: status === 'checking' || status === 'unavailable',
            title: status === 'ready' ? copy.versionStatusClickUpdate : copy.versionCheck
        })
    ];
    const siteHref = menuRoot.dataset.siteUpdatePageHref;
    if (siteHref) {
        const siteLink = createOption({ text: menuRoot.dataset.siteUpdatePageLabel, href: siteHref });
        siteLink.dataset.settingsLink = 'true';
        const source = document.querySelector('[data-system-page]')
            ? settingsReturnUrl() : new URL(window.location.href);
        if (source) {
            const url = new URL(siteLink.href);
            url.searchParams.set('return', source.pathname + source.search + source.hash);
            siteLink.href = url.pathname + url.search;
        }
        options.unshift(siteLink);
    }
    if (homeOption) options.unshift(homeOption);

    panel.replaceChildren(...options);
}

export function renderVersionMenus(model) {
    getVersionMenus().filter(isVersionMenuOpen).forEach((menuRoot) => renderVersionMenu(menuRoot, model));
}

export function closeVersionMenus() {
    getVersionMenus().forEach(closeVersionMenu);
}

export function bindVersionMenuActions(onCheck, onOpen) {
    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest('[data-site-version-action="check"]')) {
            event.preventDefault();
            onCheck();
        } else {
            const trigger = target.closest('[data-site-version-trigger]');
            if (trigger && !isVersionMenuOpen(getVersionMenuRoot(trigger))) window.setTimeout(onOpen, 0);
        }
    }, true);
}
