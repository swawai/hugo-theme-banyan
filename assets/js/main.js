// 针对微信安卓版：通过 WeixinJSBridge 强制覆盖字体大小并禁止用户修改，缓解字体缩放导致的页面跳变
(function () {
    if (typeof WeixinJSBridge == "object" && typeof WeixinJSBridge.invoke == "function") {
        handleFontSize();
    } else {
        if (document.addEventListener) {
            document.addEventListener("WeixinJSBridgeReady", handleFontSize, false);
        } else if (document.attachEvent) {
            document.attachEvent("WeixinJSBridgeReady", handleFontSize);
            document.attachEvent("onWeixinJSBridgeReady", handleFontSize);
        }
    }
    function handleFontSize() {
        try {
            WeixinJSBridge.invoke('setFontSizeCallback', { 'fontSize': 0 });
            WeixinJSBridge.on('menu:setfont', function () {
                WeixinJSBridge.invoke('setFontSizeCallback', { 'fontSize': 0 });
            });
        } catch (e) { }
    }
})();

const NAV_PROGRESS_KEY = 'nav-progress-pending';
const PREFERRED_LANG_KEY = 'preferred_lang';
const LANG_SUGGEST_HANDLED_KEY = 'lang-suggest-handled-v1';
const html = document.documentElement;
const desktopNavMedia = window.matchMedia ? window.matchMedia('(pointer: fine) and (hover: hover)') : null;
let navProgressTimer = null;
let navProgressValue = 0;

function canUseNavProgress() {
    return !!desktopNavMedia?.matches;
}

function setNavProgressValue(value) {
    navProgressValue = Math.max(0, Math.min(1, value));
    html.style.setProperty('--nav-progress-scale', navProgressValue.toFixed(3));
}

function stopNavProgressTimer() {
    if (navProgressTimer) {
        window.clearInterval(navProgressTimer);
        navProgressTimer = null;
    }
}

function activateNavProgress() {
    html.setAttribute('data-nav-progress', 'active');
    html.classList.add('is-nav-pending');
}

function resetNavProgress() {
    stopNavProgressTimer();
    html.classList.remove('is-nav-pending');
    html.removeAttribute('data-nav-progress');
    setNavProgressValue(0);
}

function startNavProgress(initialValue) {
    if (!canUseNavProgress()) return;

    activateNavProgress();
    setNavProgressValue(Math.max(navProgressValue, initialValue));
    stopNavProgressTimer();

    navProgressTimer = window.setInterval(() => {
        const current = navProgressValue;
        const step = current < 0.28 ? 0.05 : current < 0.56 ? 0.025 : current < 0.82 ? 0.012 : 0;
        if (!step) {
            stopNavProgressTimer();
            return;
        }

        setNavProgressValue(Math.min(0.88, current + step));
    }, 140);
}

function finishNavProgress() {
    stopNavProgressTimer();

    if (!html.hasAttribute('data-nav-progress')) {
        sessionStorage.removeItem(NAV_PROGRESS_KEY);
        return;
    }

    activateNavProgress();
    setNavProgressValue(1);
    sessionStorage.removeItem(NAV_PROGRESS_KEY);

    window.setTimeout(() => {
        resetNavProgress();
    }, 220);
}

function markNavigationPending() {
    if (!canUseNavProgress()) return;

    sessionStorage.setItem(NAV_PROGRESS_KEY, '1');
    startNavProgress(0.14);
}

function navigateWithProgress(url) {
    markNavigationPending();
    window.location.href = url;
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

function shouldTrackNavigation(anchor, event) {
    if (!canUseNavProgress() || !anchor || event.defaultPrevented) return false;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target.toLowerCase() !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;

    const rawHref = anchor.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#')) return false;

    let targetUrl;
    try {
        targetUrl = new URL(anchor.href, window.location.href);
    } catch (e) {
        return false;
    }

    if (!/^https?:$/.test(targetUrl.protocol)) return false;
    if (targetUrl.origin !== window.location.origin) return false;

    const currentUrl = new URL(window.location.href);
    const sameDocument = targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search;
    if (sameDocument) return false;

    return true;
}

if (canUseNavProgress() && sessionStorage.getItem(NAV_PROGRESS_KEY) === '1') {
    startNavProgress(0.82);
}

document.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!shouldTrackNavigation(anchor, event)) return;
    markNavigationPending();
}, true);

window.addEventListener('pageshow', () => {
    finishNavProgress();
});

document.addEventListener('DOMContentLoaded', () => {
    const themeSelect = document.getElementById('theme-select');
    const langSelect = document.getElementById('lang-select');
    const updateFit = (el) => {
        const wrapper = el?.parentElement?.classList.contains('select-fit') ? el.parentElement : null;
        if (wrapper) wrapper.setAttribute('data-value', el.options[el.selectedIndex]?.text || '');
    };
    if (langSelect) {
        // 区域方言归并映射（业务规则，与语言数量无关）
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

        // 当前页面已有翻译的语言列表（由 Hugo 在 baseof.html 上以 data-trans-langs 注入）
        const curLang = (langSelect.dataset.curLang || document.documentElement.lang || '').toLowerCase();
        const transLangs = (langSelect.dataset.transLangs || '')
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);

        // 懒加载 i18n JSON（仅在需要时请求，内存缓存）
        const _i18nCache = {};
        async function getI18nMessages(lang, homeUrl) {
            if (!_i18nCache[lang]) {
                try {
                    const res = await fetch(homeUrl === '/' ? '/i18n.json' : homeUrl + 'i18n.json');
                    if (res.ok) {
                        _i18nCache[lang] = await res.json();
                    }
                } catch (e) { /* 静默降级 */ }
            }
            return _i18nCache[lang] || {};
        }
        async function getI18nMessage(lang, homeUrl, key, fallback) {
            const messages = await getI18nMessages(lang, homeUrl);
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

        // 从 Hugo 生成的 /lang-list.json 读取站点支持语言列表，并动态构建下拉选项
        fetch('/lang-list.json', { credentials: 'same-origin' })
            .then(res => res && res.ok ? res.json() : [])
            .then(list => {
                if (!Array.isArray(list) || !list.length) return;

                const supportedLangs = [];
                const langHomes = {};
                const langNames = {};
                list.forEach(item => {
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

                const defaultLang = supportedLangs.find(code => langHomes[code] === '/') || supportedLangs[0] || 'en';
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

                    const targetHome = getHomeUrl(targetLang);
                    const currentName = langNames[curLang] || curLang;
                    const targetName = langNames[targetLang] || targetLang;
                    const template = await getI18nMessage(
                        targetLang,
                        targetHome,
                        'lang_suggest_msg',
                        'This page is currently in [{current}]. Your browser language appears to be [{target}]. Switch to [{target}]?'
                    );
                    const message = formatMessage(template, {
                        current: currentName,
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
                        navigateWithProgress(curUrl.href);
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
                                targetHome,
                                'no_trans_msg',
                                'This page is not available in [{lang}]. Redirect to the homepage?'
                            );
                            const msg = formatMessage(tpl, { lang: option.text.trim() });
                            if (!window.confirm(msg)) {
                                // 用户取消：恢复为当前语言
                                for (let i = 0; i < langSelect.options.length; i++) {
                                    if (langSelect.options[i].value.toLowerCase() === curLang) {
                                        langSelect.selectedIndex = i;
                                        updateFit(langSelect);
                                        break;
                                    }
                                }
                                return;
                            }
                            // 确认后直接跳转目标语言首页
                            const code = normalizeLang(targetLang);
                            if (supportedLangs.includes(code)) {
                                writeStorage(PREFERRED_LANG_KEY, code);
                            }
                            navigateWithProgress(targetHome);
                            return;
                        }

                        const code = normalizeLang(targetLang);
                        if (supportedLangs.includes(code)) {
                            writeStorage(PREFERRED_LANG_KEY, code);
                        }

                        const curUrl = new URL(window.location.href);
                        const relativePath = toRelativePath(curUrl.pathname);
                        curUrl.pathname = buildTargetUrl(targetLang, relativePath);
                        navigateWithProgress(curUrl.href);
                    } catch (e) {
                        const fallback = langSelect.options[langSelect.selectedIndex]?.value || 'en';
                        navigateWithProgress(normalizeHomeUrl(langHomes[fallback], fallback));
                    }
                });

                suggestBrowserLanguage();
            })
            .catch(() => { /* 如果语言列表加载失败，则语言切换器保持空白，静默降级 */ });
    }

    updateFit(langSelect);
    if (!themeSelect) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const setTheme = (mode) => html.setAttribute('data-theme', mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode);

    const saved = localStorage.getItem('theme-preference') || 'auto';
    themeSelect.value = saved;
    setTheme(saved);
    updateFit(themeSelect);

    // 当系统主题变化且处于 auto 模式时，动态响应
    const handleMedia = () => { if (themeSelect.value === 'auto') setTheme('auto'); };
    if (media?.addEventListener) media.addEventListener('change', handleMedia);
    else if (media?.addListener) media.addListener(handleMedia);

    themeSelect.addEventListener('change', () => {
        const mode = themeSelect.value;
        localStorage.setItem('theme-preference', mode);
        setTheme(mode);
        updateFit(themeSelect);
    });
});

