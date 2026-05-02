import { bindMenuOption, getMenuOptions, getMenuSelectedOption, markCurrentOption } from './menu-runtime.js';
import { readStorage, writeStorage } from './shared.js';

export function initThemeMenu(themeMenu) {
    if (!(themeMenu instanceof Element) || themeMenu.dataset.navPrimaryInit === 'true') {
        return;
    }

    themeMenu.dataset.navPrimaryInit = 'true';

    const html = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const setTheme = (mode) => {
        html.setAttribute('data-theme', mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode);
    };
    const saved = readStorage('theme-preference') || 'auto';

    setTheme(saved);
    markCurrentOption(themeMenu, saved);

    const handleMedia = () => {
        const isAuto = getMenuSelectedOption(themeMenu)?.dataset.value === 'auto';
        if (isAuto) setTheme('auto');
    };
    if (media?.addEventListener) media.addEventListener('change', handleMedia);
    else if (media?.addListener) media.addListener(handleMedia);

    getMenuOptions(themeMenu).forEach((option) => {
        bindMenuOption(option, (mode) => {
            mode = mode || 'auto';
            writeStorage('theme-preference', mode);
            setTheme(mode);
            markCurrentOption(themeMenu, mode);
            return true;
        });
    });

    const activeMode = getMenuSelectedOption(themeMenu)?.dataset.value || saved || 'auto';
    writeStorage('theme-preference', activeMode);
    setTheme(activeMode);
    markCurrentOption(themeMenu, activeMode);
}
