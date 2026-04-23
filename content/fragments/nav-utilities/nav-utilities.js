(function () {
    const PREFERRED_LANG_KEY = 'preferred_lang';
    const LANG_SUGGEST_HANDLED_KEY = 'lang-suggest-handled-v1';
    const html = document.documentElement;

    let runtimeManifestPromise = null;
    let runtimeManifestCache = null;

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
        const themeSelect = document.getElementById('theme-select');
        const langSelect = document.getElementById('lang-select');
        if (!themeSelect && !langSelect) return;

        const updateFit = (el) => {
            const wrapper = el?.parentElement?.classList.contains('icon-select-wrapper') ? el.parentElement : null;
            if (wrapper) wrapper.setAttribute('data-value', el.options[el.selectedIndex]?.text || '');
        };

        if (langSelect && langSelect.dataset.navPrimaryInit !== 'true') {
            langSelect.dataset.navPrimaryInit = 'true';
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
            const curLang = (langSelect.dataset.curLang || document.documentElement.lang || '').toLowerCase();
            const transLangs = (langSelect.dataset.transLangs || '')
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

                    langSelect.replaceChildren();
                    const supportedLangs = [];
                    const langHomes = {};
                    const langNames = {};
                    list.forEach((item) => {
                        const code = (item.code || '').toLowerCase();
                        const name = item.name || code;
                        if (!code) return;
                        const homeUrl = normalizeHomeUrl(item.url, code);
                        supportedLangs.push(code);
                        langHomes[code] = homeUrl;
                        langNames[code] = name;

                        const opt = document.createElement('option');
                        opt.value = code;
                        opt.textContent = name;
                        if (code === curLang) opt.selected = true;
                        opt.setAttribute('data-has-trans', transLangs.includes(code) ? 'true' : 'false');
                        langSelect.appendChild(opt);
                    });

                    if (!langSelect.options.length) return;
                    updateFit(langSelect);

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

                    langSelect.addEventListener('change', async () => {
                        try {
                            const option = langSelect.options[langSelect.selectedIndex];
                            const targetLang = (option.value || '').toLowerCase();
                            if (!targetLang) return;

                            const hasTrans = option.getAttribute('data-has-trans') === 'true';
                            const targetHome = getHomeUrl(targetLang);
                            if (!hasTrans) {
                                const tpl = await getI18nMessage(
                                    targetLang,
                                    'no_trans_msg',
                                    'This page is not available in [{lang}].\nRedirect to the homepage?'
                                );
                                const msg = formatMessage(tpl, { lang: option.text.trim() });
                                if (!window.confirm(msg)) {
                                    for (let i = 0; i < langSelect.options.length; i++) {
                                        if (langSelect.options[i].value.toLowerCase() === curLang) {
                                            langSelect.selectedIndex = i;
                                            updateFit(langSelect);
                                            break;
                                        }
                                    }
                                    return;
                                }

                                const code = normalizeLang(targetLang);
                                if (supportedLangs.includes(code)) {
                                    writeStorage(PREFERRED_LANG_KEY, code);
                                }
                                window.location.href = targetHome;
                                return;
                            }

                            const code = normalizeLang(targetLang);
                            if (supportedLangs.includes(code)) {
                                writeStorage(PREFERRED_LANG_KEY, code);
                            }

                            const curUrl = new URL(window.location.href);
                            const relativePath = toRelativePath(curUrl.pathname);
                            curUrl.pathname = buildTargetUrl(targetLang, relativePath);
                            window.location.href = curUrl.href;
                        } catch (e) {
                            const fallback = langSelect.options[langSelect.selectedIndex]?.value || 'en';
                            window.location.href = normalizeHomeUrl(langHomes[fallback], fallback);
                        }
                    });

                    suggestBrowserLanguage();
                })
                .catch(() => { });
        }

        updateFit(langSelect);
        if (!themeSelect || themeSelect.dataset.navPrimaryInit === 'true') return;
        themeSelect.dataset.navPrimaryInit = 'true';

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const setTheme = (mode) => html.setAttribute('data-theme', mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode);
        const saved = readStorage('theme-preference') || 'auto';
        themeSelect.value = saved;
        setTheme(saved);
        updateFit(themeSelect);

        const handleMedia = () => {
            if (themeSelect.value === 'auto') setTheme('auto');
        };
        if (media?.addEventListener) media.addEventListener('change', handleMedia);
        else if (media?.addListener) media.addListener(handleMedia);

        themeSelect.addEventListener('change', () => {
            const mode = themeSelect.value;
            writeStorage('theme-preference', mode);
            setTheme(mode);
            updateFit(themeSelect);
        });
    });
})();
