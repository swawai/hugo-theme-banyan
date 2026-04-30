(function () {
    const PREFERRED_LANG_KEY = 'preferred_lang';
    const LANG_SUGGEST_HANDLED_KEY = 'lang-suggest-handled-v1';
    const html = document.documentElement;
    let dropdown = null;

    let runtimeManifestPromise = null;
    let runtimeManifestCache = null;

    function getMenuRoot(target) {
        return target instanceof Element ? target.closest('[data-nav-utility-menu]') : null;
    }

    function getMenuTrigger(menuRoot) {
        return menuRoot instanceof Element ? menuRoot.querySelector('[data-nav-utility-trigger]') : null;
    }

    function getMenuPanel(menuRoot) {
        return menuRoot instanceof Element ? menuRoot.querySelector('[data-nav-utility-panel]') : null;
    }

    function getMenuOptions(menuRoot) {
        return menuRoot instanceof Element ? Array.from(menuRoot.querySelectorAll('[data-nav-utility-option]')) : [];
    }

    function getMenuSelectedOption(menuRoot) {
        return getMenuOptions(menuRoot).find((option) => option.classList.contains('is-current')) || null;
    }

    function setTriggerState(menuRoot, selectedLabel = '') {
        const trigger = getMenuTrigger(menuRoot);
        if (!(menuRoot instanceof Element) || !(trigger instanceof Element)) {
            return;
        }

        const baseLabel = menuRoot.dataset.navUtilityLabel || trigger.getAttribute('aria-label') || '';
        const accessibleLabel = selectedLabel ? `${baseLabel}: ${selectedLabel}` : baseLabel;
        if (!accessibleLabel) {
            trigger.removeAttribute('title');
            return;
        }

        trigger.setAttribute('aria-label', accessibleLabel);
        trigger.title = accessibleLabel;
    }

    function setMenuDisabled(menuRoot, disabled) {
        const trigger = getMenuTrigger(menuRoot);
        if (!(menuRoot instanceof Element) || !(trigger instanceof HTMLButtonElement)) {
            return;
        }

        menuRoot.classList.toggle('is-disabled', disabled);
        trigger.disabled = disabled;
        if (disabled && dropdown?.isOpen(menuRoot)) {
            dropdown.close();
        }
    }

    function markCurrentOption(menuRoot, selectedValue = '') {
        let selectedLabel = '';

        getMenuOptions(menuRoot).forEach((option) => {
            const isCurrent = option.dataset.value === selectedValue;
            option.classList.toggle('is-current', isCurrent);
            option.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
            if (isCurrent) {
                selectedLabel = option.textContent?.trim() || '';
            }
        });

        setTriggerState(menuRoot, selectedLabel);
    }

    function bindMenuOption(option, onSelect) {
        if (!(option instanceof HTMLButtonElement) || option.dataset.navUtilityBound === 'true') {
            return;
        }

        option.dataset.navUtilityBound = 'true';
        option.addEventListener('click', async () => {
            if (option.disabled) {
                return;
            }

            const menuRoot = getMenuRoot(option);
            const value = option.dataset.value || '';
            const shouldClose = await onSelect(value, option, menuRoot);
            if (shouldClose !== false) {
                dropdown?.close({ restoreFocus: true });
            }
        });
    }

    function replaceMenuOptions(menuRoot, optionDefs, onSelect) {
        const panel = getMenuPanel(menuRoot);
        if (!(panel instanceof Element)) {
            return;
        }

        panel.replaceChildren();
        optionDefs.forEach((definition) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'ui-dropdown-option site-nav-utility-option';
            option.dataset.navUtilityOption = 'true';
            option.dataset.value = definition.value;
            option.textContent = definition.label;
            option.disabled = definition.disabled === true;
            if (definition.hasTrans === false) {
                option.dataset.hasTrans = 'false';
            }
            bindMenuOption(option, onSelect);
            panel.appendChild(option);
        });

        setMenuDisabled(menuRoot, panel.childElementCount === 0);
    }

    function closeOpenMenu({ restoreFocus = false } = {}) {
        dropdown?.close({ restoreFocus });
    }

    function openMenu(menuRoot, { focusSelected = false } = {}) {
        if (!(menuRoot instanceof Element) || !dropdown) {
            return false;
        }

        return dropdown.open(menuRoot, {
            focusPanel: focusSelected,
            focusSelector: '.site-nav-utility-option.is-current:not(:disabled)',
            fallbackFocusSelector: '.site-nav-utility-option:not(:disabled)'
        });
    }

    function toggleMenu(menuRoot, options = {}) {
        if (!(menuRoot instanceof Element) || !dropdown) {
            return false;
        }

        if (dropdown.isOpen(menuRoot)) {
            dropdown.close();
            return false;
        }

        return openMenu(menuRoot, options);
    }

    function initCustomMenus() {
        if (!dropdown) {
            const createDropdownController = window.__banyanUiDropdown?.createDropdownController;
            if (typeof createDropdownController !== 'function') {
                return false;
            }

            dropdown = createDropdownController({
                rootSelector: '[data-nav-utility-menu]',
                triggerSelector: '[data-nav-utility-trigger]',
                panelSelector: '[data-nav-utility-panel]',
                optionSelector: '.site-nav-utility-option:not(:disabled)'
            });
        }

        document.querySelectorAll('[data-nav-utility-menu]').forEach((menuRoot) => {
            const trigger = getMenuTrigger(menuRoot);
            if (!(trigger instanceof HTMLElement)) {
                return;
            }

            if (menuRoot.dataset.navUtilityInit !== 'true') {
                menuRoot.dataset.navUtilityInit = 'true';
            }

            const selectedOption = getMenuSelectedOption(menuRoot);
            setTriggerState(menuRoot, selectedOption?.textContent?.trim() || '');
            setMenuDisabled(menuRoot, getMenuOptions(menuRoot).length === 0);
        });

        dropdown.initTriggers();

        if (document.body.dataset.navUtilityEventsInit === 'true') {
            return true;
        }

        document.body.dataset.navUtilityEventsInit = 'true';

        document.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const trigger = target ? target.closest('[data-nav-utility-trigger]') : null;
            if (trigger) {
                event.preventDefault();
                toggleMenu(getMenuRoot(trigger));
                return;
            }

            if (dropdown?.hasOpen() && (!target || !dropdown.contains(target))) {
                closeOpenMenu();
            }
        });

        document.addEventListener('focusin', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (dropdown?.hasOpen() && (!target || !dropdown.contains(target))) {
                closeOpenMenu();
            }
        });

        document.addEventListener('keydown', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const trigger = target ? target.closest('[data-nav-utility-trigger]') : null;

            if (event.key === 'Escape' && dropdown?.hasOpen()) {
                event.preventDefault();
                closeOpenMenu({ restoreFocus: true });
                return;
            }

            if (dropdown?.handlePanelKeyDown(event)) {
                return;
            }

            if (trigger && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'F4')) {
                event.preventDefault();
                toggleMenu(getMenuRoot(trigger), { focusSelected: true });
            }
        });

        return true;
    }

    function readRuntimeManifestUrl() {
        return document.body?.dataset.assetManifestUrl || '';
    }

    function getRuntimeManifest() {
        if (runtimeManifestCache) {
            return Promise.resolve(runtimeManifestCache);
        }

        if (!runtimeManifestPromise) {
            const manifestUrl = readRuntimeManifestUrl();
            if (!manifestUrl) {
                runtimeManifestCache = {};
                return Promise.resolve(runtimeManifestCache);
            }

            runtimeManifestPromise = fetch(manifestUrl, { credentials: 'include' })
                .then((res) => (res && res.ok ? res.json() : {}))
                .catch(() => ({}))
                .then((manifest) => {
                    runtimeManifestCache = manifest && typeof manifest === 'object' ? manifest : {};
                    return runtimeManifestCache;
                });
        }

        return runtimeManifestPromise;
    }

    function getRuntimeLangListUrl(manifest) {
        return typeof manifest?.langList === 'string' && manifest.langList ? manifest.langList : '';
    }

    function getRuntimeI18nUrl(manifest, lang) {
        const normalized = typeof lang === 'string' ? lang.toLowerCase() : '';
        const i18nMap = manifest && typeof manifest.i18n === 'object' ? manifest.i18n : null;
        if (i18nMap) {
            if (typeof i18nMap[normalized] === 'string' && i18nMap[normalized]) return i18nMap[normalized];
            if (normalized === 'zh-hk' || normalized === 'zh-mo') {
                if (typeof i18nMap['zh-tw'] === 'string' && i18nMap['zh-tw']) return i18nMap['zh-tw'];
            }
        }

        return '';
    }

    function readStorage(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (e) { }
    }

    function runAfterPageSettles(callback, delayMs) {
        let cancelled = false;
        let cleaned = false;

        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            window.removeEventListener('click', cancelOnInteract, true);
            window.removeEventListener('scroll', cancelOnInteract, true);
            window.removeEventListener('keydown', cancelOnInteract, true);
            window.removeEventListener('touchstart', cancelOnInteract, true);
        };
        const cancelOnInteract = () => {
            cancelled = true;
            cleanup();
        };
        const run = () => {
            window.setTimeout(() => {
                if (cancelled) return;
                cleanup();
                callback();
            }, delayMs);
        };

        window.addEventListener('click', cancelOnInteract, true);
        window.addEventListener('scroll', cancelOnInteract, true);
        window.addEventListener('keydown', cancelOnInteract, true);
        window.addEventListener('touchstart', cancelOnInteract, true);

        if (document.readyState === 'complete') {
            run();
            return;
        }

        window.addEventListener('load', run, { once: true });
    }

    void getRuntimeManifest();

    document.addEventListener('DOMContentLoaded', () => {
        const themeMenu = document.querySelector('[data-nav-utility-kind="theme"]');
        const langMenu = document.querySelector('[data-nav-utility-kind="language"]');
        if (!themeMenu && !langMenu) return;
        if (!initCustomMenus()) return;

        if (langMenu && langMenu.dataset.navPrimaryInit !== 'true') {
            langMenu.dataset.navPrimaryInit = 'true';
            const normalizeLang = (code) => {
                code = (code || '').toLowerCase();
                if (code === 'zh-hk' || code === 'zh-mo') return 'zh-tw';
                return code;
            };
            const normalizePath = (path) => {
                if (!path) return '/';
                return path.startsWith('/') ? path : '/' + path;
            };
            const normalizeHomeUrl = (url, code) => {
                let home = url || '/' + code + '/';
                try {
                    home = new URL(home, window.location.origin).pathname || '/';
                } catch (e) {
                    home = normalizePath(home);
                }
                home = normalizePath(home);
                if (home !== '/' && !home.endsWith('/')) home += '/';
                return home;
            };
            const curLang = (langMenu.dataset.curLang || document.documentElement.lang || '').toLowerCase();
            const transLangs = (langMenu.dataset.transLangs || '')
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
            const i18nCache = {};

            async function getI18nMessages(lang) {
                if (!i18nCache[lang]) {
                    try {
                        const manifest = await getRuntimeManifest();
                        const url = getRuntimeI18nUrl(manifest, lang);
                        if (!url) {
                            i18nCache[lang] = {};
                            return i18nCache[lang];
                        }
                        const res = await fetch(url, { credentials: 'same-origin' });
                        if (res.ok) {
                            i18nCache[lang] = await res.json();
                        }
                    } catch (e) { }
                }
                return i18nCache[lang] || {};
            }

            async function getI18nMessage(lang, key, fallback) {
                const messages = await getI18nMessages(lang);
                return messages[key] || fallback;
            }

            function formatMessage(template, replacements) {
                return template
                    .replace(/\[\{(\w+)\}\]/g, (match, key) => (key in replacements ? replacements[key] : match))
                    .replace(/\{(\w+)\}/g, (match, key) => (key in replacements ? replacements[key] : match));
            }

            function detectBrowserLang(supportedLangs) {
                const candidates = Array.isArray(navigator.languages) && navigator.languages.length
                    ? navigator.languages
                    : [navigator.language || navigator.userLanguage || ''];

                for (const candidate of candidates) {
                    const code = normalizeLang((candidate || '').toLowerCase());
                    if (!code) continue;
                    if (supportedLangs.includes(code)) return code;

                    const prefix = code.split('-')[0];
                    if (prefix && supportedLangs.includes(prefix)) return prefix;
                }

                return '';
            }

            getRuntimeManifest()
                .then((manifest) => {
                    const url = getRuntimeLangListUrl(manifest);
                    if (!url) return [];
                    return fetch(url, { credentials: 'same-origin' })
                        .then((res) => (res && res.ok ? res.json() : []))
                        .catch(() => []);
                })
                .then((list) => {
                    if (!Array.isArray(list) || !list.length) return;

                    const supportedLangs = [];
                    const langHomes = {};
                    const langNames = {};
                    const optionDefs = [];
                    list.forEach((item) => {
                        const code = (item.code || '').toLowerCase();
                        const name = item.name || code;
                        if (!code) return;
                        const homeUrl = normalizeHomeUrl(item.url, code);
                        supportedLangs.push(code);
                        langHomes[code] = homeUrl;
                        langNames[code] = name;
                        optionDefs.push({
                            value: code,
                            label: name,
                            hasTrans: transLangs.includes(code)
                        });
                    });

                    if (!optionDefs.length) return;

                    const defaultLang = supportedLangs.find((code) => langHomes[code] === '/') || supportedLangs[0] || 'en';
                    const getHomeUrl = (lang) => langHomes[lang] || (lang === defaultLang ? '/' : '/' + lang + '/');
                    const toRelativePath = (pathname) => {
                        const path = normalizePath(pathname);
                        const currentHome = getHomeUrl(curLang);
                        if (currentHome !== '/') {
                            const currentRoot = currentHome.slice(0, -1);
                            if (path === currentRoot || path === currentHome) return '/';
                            if (path.startsWith(currentHome)) {
                                const rest = path.slice(currentHome.length);
                                return rest ? '/' + rest : '/';
                            }
                        }
                        return path;
                    };
                    const buildTargetUrl = (lang, relativePath) => {
                        const home = getHomeUrl(lang);
                        if (!relativePath || relativePath === '/') return home;
                        const rest = relativePath.replace(/^\/+/, '');
                        return home === '/' ? '/' + rest : home + rest;
                    };
                    const suggestBrowserLanguage = async () => {
                        if (readStorage(PREFERRED_LANG_KEY) || readStorage(LANG_SUGGEST_HANDLED_KEY)) return;

                        const targetLang = detectBrowserLang(supportedLangs);
                        if (!targetLang || targetLang === curLang) return;
                        if (!transLangs.includes(targetLang)) return;

                        const targetName = langNames[targetLang] || targetLang;
                        const template = await getI18nMessage(
                            targetLang,
                            'lang_suggest_msg',
                            'We recommend the [{target}] version of this page.\nContinue?'
                        );
                        const message = formatMessage(template, {
                            target: targetName
                        });

                        runAfterPageSettles(() => {
                            const shouldSwitch = window.confirm(message);
                            writeStorage(LANG_SUGGEST_HANDLED_KEY, '1');
                            if (!shouldSwitch) return;

                            writeStorage(PREFERRED_LANG_KEY, targetLang);
                            const curUrl = new URL(window.location.href);
                            const relativePath = toRelativePath(curUrl.pathname);
                            curUrl.pathname = buildTargetUrl(targetLang, relativePath);
                            window.location.href = curUrl.href;
                        }, 800);
                    };

                    replaceMenuOptions(langMenu, optionDefs, async (targetLang, option) => {
                        try {
                            targetLang = (targetLang || '').toLowerCase();
                            if (!targetLang) return;

                            const hasTrans = option.dataset.hasTrans !== 'false';
                            const targetHome = getHomeUrl(targetLang);
                            if (!hasTrans) {
                                const tpl = await getI18nMessage(
                                    targetLang,
                                    'no_trans_msg',
                                    'This page is not available in [{lang}].\nRedirect to the homepage?'
                                );
                                const msg = formatMessage(tpl, { lang: option.textContent?.trim() || targetLang });
                                if (!window.confirm(msg)) {
                                    markCurrentOption(langMenu, curLang);
                                    return true;
                                }

                                const code = normalizeLang(targetLang);
                                if (supportedLangs.includes(code)) {
                                    writeStorage(PREFERRED_LANG_KEY, code);
                                }
                                window.location.href = targetHome;
                                return true;
                            }

                            const code = normalizeLang(targetLang);
                            if (supportedLangs.includes(code)) {
                                writeStorage(PREFERRED_LANG_KEY, code);
                            }

                            const curUrl = new URL(window.location.href);
                            const relativePath = toRelativePath(curUrl.pathname);
                            curUrl.pathname = buildTargetUrl(targetLang, relativePath);
                            window.location.href = curUrl.href;
                            return true;
                        } catch (e) {
                            const fallback = targetLang || curLang || 'en';
                            window.location.href = normalizeHomeUrl(langHomes[fallback], fallback);
                            return true;
                        }
                    });

                    markCurrentOption(langMenu, curLang);
                    suggestBrowserLanguage();
                })
                .catch(() => { });
        }

        if (!themeMenu || themeMenu.dataset.navPrimaryInit === 'true') return;
        themeMenu.dataset.navPrimaryInit = 'true';

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const setTheme = (mode) => html.setAttribute('data-theme', mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode);
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
    });
})();
