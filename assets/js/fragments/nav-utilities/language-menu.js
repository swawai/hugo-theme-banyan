import { fetchRuntimeJson, getRuntimeI18nUrl, getRuntimeLangListUrl, getRuntimeManifest } from '../../runtime-manifest.js';
import { bindMenuOption, markCurrentOption, replaceMenuOptions } from './menu-runtime.js';
import {
    LANG_SUGGEST_HANDLED_KEY,
    PREFERRED_LANG_KEY,
    readStorage,
    runAfterPageSettles,
    writeStorage
} from './shared.js';

function normalizeLang(code) {
    code = (code || '').toLowerCase();
    if (code === 'zh-hk' || code === 'zh-mo') return 'zh-tw';
    return code;
}

function normalizePath(path) {
    if (!path) return '/';
    return path.startsWith('/') ? path : `/${path}`;
}

function normalizeHomeUrl(url, code) {
    let home = url || `/${code}/`;
    try {
        home = new URL(home, window.location.origin).pathname || '/';
    } catch (e) {
        home = normalizePath(home);
    }
    home = normalizePath(home);
    if (home !== '/' && !home.endsWith('/')) home += '/';
    return home;
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

function formatMessage(template, replacements) {
    return template
        .replace(/\[\{(\w+)\}\]/g, (match, key) => (key in replacements ? replacements[key] : match))
        .replace(/\{(\w+)\}/g, (match, key) => (key in replacements ? replacements[key] : match));
}

export async function initLanguageMenu(langMenu) {
    if (!(langMenu instanceof Element) || langMenu.dataset.navPrimaryInit === 'true') {
        return;
    }

    langMenu.dataset.navPrimaryInit = 'true';

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
                const data = await fetchRuntimeJson(url);
                i18nCache[lang] = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
            } catch (e) { }
        }
        return i18nCache[lang] || {};
    }

    async function getI18nMessage(lang, key, fallback) {
        const messages = await getI18nMessages(lang);
        return messages[key] || fallback;
    }

    const manifest = await getRuntimeManifest();
    const langListUrl = getRuntimeLangListUrl(manifest);
    if (!langListUrl) return;

    const listData = await fetchRuntimeJson(langListUrl);
    const list = Array.isArray(listData) ? listData : [];
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
    const getHomeUrl = (lang) => langHomes[lang] || (lang === defaultLang ? '/' : `/${lang}/`);
    const toRelativePath = (pathname) => {
        const path = normalizePath(pathname);
        const currentHome = getHomeUrl(curLang);
        if (currentHome !== '/') {
            const currentRoot = currentHome.slice(0, -1);
            if (path === currentRoot || path === currentHome) return '/';
            if (path.startsWith(currentHome)) {
                const rest = path.slice(currentHome.length);
                return rest ? `/${rest}` : '/';
            }
        }
        return path;
    };
    const buildTargetUrl = (lang, relativePath) => {
        const home = getHomeUrl(lang);
        if (!relativePath || relativePath === '/') return home;
        const rest = relativePath.replace(/^\/+/, '');
        return home === '/' ? `/${rest}` : `${home}${rest}`;
    };

    async function suggestBrowserLanguage() {
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
    }

    replaceMenuOptions(langMenu, optionDefs, async (targetLang, option) => {
        try {
            targetLang = (targetLang || '').toLowerCase();
            if (!targetLang) return true;

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
    void suggestBrowserLanguage();
}
