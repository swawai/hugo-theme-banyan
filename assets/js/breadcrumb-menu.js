const MENU_MODE_CLASS = 'is-breadcrumb-menu-mode';
const WIDE_COLUMNS_QUERY = '(min-width: 88rem)';
let activeModeRow = null;
let wideColumnsMediaQuery = null;
let dropdown = null;

function ensureDropdown() {
    if (dropdown) {
        return true;
    }

    const createDropdownController = window.__banyanUiDropdown?.createDropdownController;
    if (typeof createDropdownController !== 'function') {
        return false;
    }

    dropdown = createDropdownController({
        rootSelector: '[data-breadcrumb-menu]',
        triggerSelector: '[data-breadcrumb-menu-link="true"]',
        panelSelector: '[data-breadcrumb-menu-panel]',
        optionSelector: 'a[href]'
    });
    return true;
}

function getMenuLink(target) {
    if (!ensureDropdown()) {
        return null;
    }
    return dropdown.getTrigger(target);
}

function getModeToggleLink(target) {
    return target instanceof Element ? target.closest('[data-breadcrumb-mode-toggle="true"]') : null;
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

function deactivateMode({ restoreFocus = false } = {}) {
    const row = activeModeRow;
    if (ensureDropdown()) {
        dropdown.close({ restoreFocus: false });
    }
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

function handleClick(event) {
    if (!ensureDropdown()) {
        return;
    }

    const modeToggleLink = getModeToggleLink(event.target);
    const link = getMenuLink(event.target);
    const clickTarget = event.target instanceof Element ? event.target : null;

    if (isWideBreadcrumbColumnsActive()) {
        if (modeToggleLink) {
            event.preventDefault();
            deactivateMode();
            return;
        }

        if (activeModeRow || dropdown.hasOpen()) {
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
            dropdown.open(link);
        }
        return;
    }

    if (!link) {
        if (activeModeRow && (!clickTarget || !activeModeRow.contains(clickTarget))) {
            deactivateMode();
        } else if (dropdown.hasOpen() && (!clickTarget || !dropdown.contains(clickTarget))) {
            dropdown.close();
        }
        return;
    }

    if (isModeActive(link)) {
        event.preventDefault();
        dropdown.toggle(link);
        return;
    }

    dropdown.close();
}

function handleKeyDown(event) {
    if (!ensureDropdown()) {
        return;
    }

    const modeToggleLink = getModeToggleLink(event.target);
    const link = getMenuLink(event.target);
    if (event.key === 'Escape') {
        if (activeModeRow) {
            deactivateMode({ restoreFocus: true });
        } else {
            dropdown.close({ restoreFocus: true });
        }
        return;
    }

    if (dropdown.handlePanelKeyDown(event)) {
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
                dropdown.open(link);
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
    dropdown.open(link, { focusPanel: true });
}

function handleFocusIn(event) {
    if (!ensureDropdown()) {
        return;
    }

    const focusTarget = event.target instanceof Element ? event.target : null;
    if (!dropdown.hasOpen() && !activeModeRow) {
        return;
    }

    if (activeModeRow && focusTarget && activeModeRow.contains(focusTarget)) {
        return;
    }

    if (focusTarget && dropdown.contains(focusTarget)) {
        return;
    }

    if (activeModeRow) {
        deactivateMode();
        return;
    }

    dropdown.close();
}

let didInit = false;

function handleWideColumnsLayoutChange() {
    if (isWideBreadcrumbColumnsActive()) {
        deactivateMode();
    }
}

export function initBreadcrumbMenus() {
    if (!ensureDropdown()) {
        return false;
    }

    if (didInit) {
        if (activeModeRow && !document.contains(activeModeRow)) {
            activeModeRow = null;
        }
        dropdown.close();
        dropdown.initTriggers();
        handleWideColumnsLayoutChange();
        return;
    }

    didInit = true;
    dropdown.initTriggers();

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
    return true;
}
