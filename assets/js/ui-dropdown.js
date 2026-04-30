function toElement(target) {
    return target instanceof Element ? target : null;
}

export function createDropdownController({
    rootSelector = '[data-ui-dropdown]',
    triggerSelector = '[data-ui-dropdown-trigger]',
    panelSelector = '[data-ui-dropdown-panel]',
    optionSelector = 'a[href], button:not(:disabled)'
} = {}) {
    let openState = null;

    function getTrigger(target) {
        return toElement(target)?.closest(triggerSelector) || null;
    }

    function getRoot(target) {
        return toElement(target)?.closest(rootSelector) || null;
    }

    function getPanel(target) {
        return getRoot(target)?.querySelector(panelSelector) || null;
    }

    function getRootTrigger(root) {
        return root instanceof Element ? root.querySelector(triggerSelector) : null;
    }

    function setExpanded(trigger, expanded) {
        if (!(trigger instanceof Element)) {
            return;
        }

        trigger.setAttribute('aria-haspopup', 'true');
        trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function close({ restoreFocus = false } = {}) {
        if (!openState) {
            return;
        }

        const { root, trigger, panel } = openState;
        root.classList.remove('is-open');
        if (panel) {
            panel.hidden = true;
        }
        setExpanded(trigger, false);
        openState = null;

        if (restoreFocus && trigger instanceof HTMLElement) {
            trigger.focus({ preventScroll: true });
        }
    }

    function focusPanelOption(panel, { focusSelector = '', fallbackFocusSelector = optionSelector } = {}) {
        if (!(panel instanceof Element)) {
            return;
        }

        const preferred = focusSelector ? panel.querySelector(focusSelector) : null;
        const focusTarget = preferred || (fallbackFocusSelector ? panel.querySelector(fallbackFocusSelector) : null);
        if (focusTarget instanceof HTMLElement) {
            focusTarget.focus({ preventScroll: true });
        }
    }

    function getPanelOptions(panel = openState?.panel) {
        if (!(panel instanceof Element)) {
            return [];
        }

        return Array.from(panel.querySelectorAll(optionSelector)).filter((option) => option instanceof HTMLElement);
    }

    function getFocusedPanelOption(target) {
        const element = toElement(target);
        if (!element || !(openState?.panel instanceof Element) || !openState.panel.contains(element)) {
            return null;
        }

        const option = element.closest(optionSelector);
        return option instanceof HTMLElement && openState.panel.contains(option) ? option : null;
    }

    function focusPanelOptionByIndex(options, index) {
        const focusTarget = options[index];
        if (focusTarget instanceof HTMLElement) {
            focusTarget.focus({ preventScroll: true });
            return true;
        }

        return false;
    }

    function handlePanelKeyDown(event) {
        if (!openState || !(openState.panel instanceof Element)) {
            return false;
        }

        const target = toElement(event.target);
        if (!target || !openState.panel.contains(target)) {
            return false;
        }

        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
            return false;
        }

        const options = getPanelOptions();
        if (options.length === 0) {
            return false;
        }

        const currentOption = getFocusedPanelOption(target);
        const currentIndex = currentOption ? options.indexOf(currentOption) : -1;
        let nextIndex = 0;

        if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = options.length - 1;
        } else if (event.key === 'ArrowUp') {
            nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        } else {
            nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, options.length - 1);
        }

        event.preventDefault();
        return focusPanelOptionByIndex(options, nextIndex);
    }

    function open(target, options = {}) {
        const root = getRoot(target);
        const trigger = getTrigger(target) || getRootTrigger(root);
        const panel = getPanel(root);
        if (!(root instanceof Element) || !(trigger instanceof Element) || !(panel instanceof Element) || trigger.disabled) {
            return false;
        }

        if (openState && openState.root !== root) {
            close();
        }

        root.classList.add('is-open');
        panel.hidden = false;
        setExpanded(trigger, true);
        openState = { root, trigger, panel };

        if (options.focusPanel === true) {
            focusPanelOption(panel, options);
        }
        return true;
    }

    function toggle(target, options = {}) {
        const root = getRoot(target);
        if (!(root instanceof Element)) {
            return false;
        }

        if (openState?.root === root) {
            close();
            return false;
        }

        return open(target, options);
    }

    function isOpen(target) {
        const root = getRoot(target);
        return !!(root && openState?.root === root);
    }

    function contains(target) {
        const element = toElement(target);
        return !!(element && openState?.root?.contains(element));
    }

    function hasOpen() {
        return !!openState;
    }

    function initTriggers() {
        document.querySelectorAll(triggerSelector).forEach((trigger) => {
            setExpanded(trigger, false);
        });
    }

    return {
        close,
        contains,
        getTrigger,
        handlePanelKeyDown,
        hasOpen,
        initTriggers,
        isOpen,
        open,
        toggle
    };
}

if (typeof window !== 'undefined') {
    window.__banyanUiDropdown = {
        createDropdownController
    };
}
