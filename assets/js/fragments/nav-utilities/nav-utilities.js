import { initNavUtilityMenus, markCurrentOption } from './menu-runtime.js';

document.addEventListener('DOMContentLoaded', () => {
    const themeMenu = document.querySelector('[data-nav-utility-kind="theme"]');
    const langMenu = document.querySelector('[data-nav-utility-kind="language"]');
    const hasUtilityMenu = Boolean(document.querySelector('[data-nav-utility-menu]'));
    if (!hasUtilityMenu) return;
    if (!initNavUtilityMenus()) return;

    if (langMenu) {
        langMenu.dataset.navPrimaryInit = 'true';
        markCurrentOption(langMenu, document.documentElement.lang);
    }
    if (themeMenu) {
        themeMenu.dataset.navPrimaryInit = 'true';
        markCurrentOption(themeMenu, document.documentElement.dataset.themePreference || 'auto');
        document.addEventListener('banyan:theme-preference', (event) => markCurrentOption(themeMenu, event.detail));
        themeMenu.addEventListener('click', (event) => {
            if (event.target instanceof Element && event.target.closest('[data-theme-choice]')) {
                window.__banyanNavUtilityMenus?.closeRoot(themeMenu);
            }
        });
    }
});
