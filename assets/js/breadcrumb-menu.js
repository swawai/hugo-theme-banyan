const MENU_MODE_CLASS = 'is-breadcrumb-menu-mode';
const WIDE_COLUMNS_QUERY = '(min-width: 88rem)';
let openMenuState = null;
let activeModeRow = null;
let wideColumnsMediaQuery = null;

function getMenuLink(target) {
    return target instanceof Element ? target.closest('[data-breadcrumb-menu-link="true"]') : null;
}

function getModeToggleLink(target) {
    return target instanceof Element ? target.closest('[data-breadcrumb-mode-toggle="true"]') : null;
}

function getMenuRoot(link) {
    return link instanceof Element ? link.closest('[data-breadcrumb-menu]') : null;
}

function getMenuPanel(menuRoot) {
    return menuRoot instanceof Element ? menuRoot.querySelector('[data-breadcrumb-menu-panel]') : null;
}

function getBreadcrumbRow(target) {
    return target instanceof Element ? target.closest('.slot-row-breadcrumb') : null;
}

function isWideBreadcrumbColumnsActive() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }

    if (!wideColumnsMediaQuery) {
        wideColumnsMediaQuery = window.matchMedia(WIDE_COLUMNS_QUERY);
    }

    return wideColumnsMediaQuery.matches;
}

function isModeActive(target) {
    if (!(activeModeRow instanceof Element)) {
        return false;
    }

    if (!(target instanceof Element)) {
        return activeModeRow.classList.contains(MENU_MODE_CLASS);
    }

    return activeModeRow.classList.contains(MENU_MODE_CLASS) && activeModeRow.contains(target);
}

function activateMode(target) {
    const row = getBreadcrumbRow(target);
    if (!(row instanceof Element)) {
        return null;
    }

    if (activeModeRow && activeModeRow !== row) {
        deactivateMode();
    }

    row.classList.add(MENU_MODE_CLASS);
    activeModeRow = row;
    return row;
}

function setExpanded(link, expanded) {
    if (!(link instanceof Element)) {
        return;
    }

    link.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function closeOpenMenu({ restoreFocus = false } = {}) {
    if (!openMenuState) {
        return;
    }

    const { menuRoot, link, panel } = openMenuState;
    menuRoot.classList.remove('is-open');
    if (panel) {
        panel.hidden = true;
    }
    setExpanded(link, false);
    openMenuState = null;

    if (restoreFocus && link instanceof HTMLElement) {
        link.focus({ preventScroll: true });
    }
}

function deactivateMode({ restoreFocus = false } = {}) {
    const row = activeModeRow;
    closeOpenMenu({ restoreFocus: false });
    if (row instanceof Element) {
        row.classList.remove(MENU_MODE_CLASS);
    }
    activeModeRow = null;

    if (restoreFocus) {
        const toggleLink = row?.querySelector?.('[data-breadcrumb-mode-toggle="true"]');
        if (toggleLink instanceof HTMLElement) {
            toggleLink.focus({ preventScroll: true });
        }
    }
}

function openMenu(link) {
    const menuRoot = getMenuRoot(link);
    const panel = getMenuPanel(menuRoot);
    if (!menuRoot || !panel) {
        return false;
    }

    if (openMenuState && openMenuState.menuRoot !== menuRoot) {
        closeOpenMenu();
    }

    menuRoot.classList.add('is-open');
    panel.hidden = false;
    setExpanded(link, true);
    openMenuState = { menuRoot, link, panel };
    return true;
}

function toggleMenu(link) {
    const menuRoot = getMenuRoot(link);
    if (!menuRoot) {
        return false;
    }

    if (openMenuState?.menuRoot === menuRoot) {
        closeOpenMenu();
        return false;
    }

    return openMenu(link);
}

function initMenuLinkState() {
    document.querySelectorAll('[data-breadcrumb-menu-link="true"]').forEach((link) => {
        link.setAttribute('aria-haspopup', 'true');
        setExpanded(link, false);
    });
}

function handleClick(event) {
    const modeToggleLink = getModeToggleLink(event.target);
    const link = getMenuLink(event.target);
    const clickTarget = event.target instanceof Element ? event.target : null;

    if (isWideBreadcrumbColumnsActive()) {
        if (modeToggleLink) {
            event.preventDefault();
            deactivateMode();
            return;
        }

        if (activeModeRow || openMenuState) {
            deactivateMode();
        }

        return;
    }

    if (modeToggleLink) {
        event.preventDefault();
        if (isModeActive(modeToggleLink)) {
            deactivateMode();
            return;
        }

        activateMode(modeToggleLink);
        if (link) {
            openMenu(link);
        }
        return;
    }

    if (!link) {
        if (activeModeRow && (!clickTarget || !activeModeRow.contains(clickTarget))) {
            deactivateMode();
        } else if (openMenuState && (!clickTarget || !openMenuState.menuRoot.contains(clickTarget))) {
            closeOpenMenu();
        }
        return;
    }

    if (isModeActive(link)) {
        event.preventDefault();
        toggleMenu(link);
        return;
    }

    closeOpenMenu();
}

function handleKeyDown(event) {
    const modeToggleLink = getModeToggleLink(event.target);
    const link = getMenuLink(event.target);
    if (event.key === 'Escape') {
        if (activeModeRow) {
            deactivateMode({ restoreFocus: true });
        } else {
            closeOpenMenu({ restoreFocus: true });
        }
        return;
    }

    if (isWideBreadcrumbColumnsActive()) {
        return;
    }

    if (modeToggleLink && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        if (isModeActive(modeToggleLink)) {
            deactivateMode({ restoreFocus: true });
        } else {
            activateMode(modeToggleLink);
            if (link) {
                openMenu(link);
            }
        }
        return;
    }

    if (!link || !isModeActive(link)) {
        return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'F4' && event.key !== 'Enter' && event.key !== ' ') {
        return;
    }

    event.preventDefault();
    if (!openMenu(link)) {
        return;
    }

    const firstOption = openMenuState?.panel?.querySelector('a[href]');
    if (firstOption instanceof HTMLElement) {
        firstOption.focus({ preventScroll: true });
    }
}

function handleFocusIn(event) {
    const focusTarget = event.target instanceof Element ? event.target : null;
    if (!openMenuState && !activeModeRow) {
        return;
    }

    if (activeModeRow && focusTarget && activeModeRow.contains(focusTarget)) {
        return;
    }

    if (activeModeRow) {
        deactivateMode();
        return;
    }

    closeOpenMenu();
}

let didInit = false;

function handleWideColumnsLayoutChange() {
    if (isWideBreadcrumbColumnsActive()) {
        deactivateMode();
    }
}

export function initBreadcrumbMenus() {
    if (didInit) {
        if (activeModeRow && !document.contains(activeModeRow)) {
            activeModeRow = null;
            openMenuState = null;
        }
        initMenuLinkState();
        handleWideColumnsLayoutChange();
        return;
    }

    didInit = true;
    initMenuLinkState();

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        wideColumnsMediaQuery = window.matchMedia(WIDE_COLUMNS_QUERY);
        if (typeof wideColumnsMediaQuery.addEventListener === 'function') {
            wideColumnsMediaQuery.addEventListener('change', handleWideColumnsLayoutChange);
        }
    }

    handleWideColumnsLayoutChange();
}
