import { bindMenuOption, getMenuOptions, markCurrentOption } from './menu-runtime.js';
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

function normalizeMessage(template, fallback) {
    return (template || fallback).replace(/\\n/g, '\n');
}

export function initLanguageMenu(langMenu) {
    if (!(langMenu instanceof Element) || langMenu.dataset.navPrimaryInit === 'true') {
        return;
    }

    langMenu.dataset.navPrimaryInit = 'true';

    const curLang = (langMenu.dataset.curLang || document.documentElement.lang || '').toLowerCase();
    const noTranslationMessage = normalizeMessage(
        langMenu.dataset.noTranslationMessage,
        'This page is not available in [{lang}].\nRedirect to the homepage?'
    );
    const languageSuggestionMessage = normalizeMessage(
        langMenu.dataset.languageSuggestionMessage,
        'We recommend the [{target}] version of this page.\nContinue?'
    );
    const supportedLangs = [];
    const langNames = {};
    const langOptions = {};

    getMenuOptions(langMenu).forEach((option) => {
        const code = (option.dataset.value || '').toLowerCase();
        if (!code || !(option instanceof HTMLAnchorElement) || !option.href) return;
        supportedLangs.push(code);
        langNames[code] = option.textContent?.trim() || code;
        langOptions[code] = option;
    });

    if (!supportedLangs.length) return;

    function suggestBrowserLanguage() {
        if (readStorage(PREFERRED_LANG_KEY) || readStorage(LANG_SUGGEST_HANDLED_KEY)) return;

        const targetLang = detectBrowserLang(supportedLangs);
        if (!targetLang || targetLang === curLang) return;
        const targetOption = langOptions[targetLang];
        if (!targetOption || targetOption.dataset.hasTrans === 'false') return;

        const targetName = langNames[targetLang] || targetLang;
        const message = formatMessage(languageSuggestionMessage, {
            target: targetName
        });

        runAfterPageSettles(() => {
            const shouldSwitch = window.confirm(message);
            writeStorage(LANG_SUGGEST_HANDLED_KEY, '1');
            if (!shouldSwitch) return;

            writeStorage(PREFERRED_LANG_KEY, targetLang);
            window.location.href = targetOption.href;
        }, 800);
    }

    getMenuOptions(langMenu).forEach((option) => bindMenuOption(option, (targetLang) => {
        try {
            targetLang = (targetLang || '').toLowerCase();
            if (!targetLang) return true;

            const hasTrans = option.dataset.hasTrans !== 'false';
            const targetUrl = option instanceof HTMLAnchorElement && option.href
                ? option.href
                : langOptions[targetLang]?.href;
            if (!targetUrl) return true;

            if (!hasTrans) {
                const msg = formatMessage(noTranslationMessage, {
                    lang: option.textContent?.trim() || targetLang
                });
                if (!window.confirm(msg)) {
                    markCurrentOption(langMenu, curLang);
                    return true;
                }

                const code = normalizeLang(targetLang);
                if (supportedLangs.includes(code)) {
                    writeStorage(PREFERRED_LANG_KEY, code);
                }
                window.location.href = targetUrl;
                return true;
            }

            const code = normalizeLang(targetLang);
            if (supportedLangs.includes(code)) {
                writeStorage(PREFERRED_LANG_KEY, code);
            }

            window.location.href = targetUrl;
            return true;
        } catch (e) {
            const fallbackOption = langOptions[targetLang] || langOptions[curLang];
            if (fallbackOption?.href) window.location.href = fallbackOption.href;
            return true;
        }
    }));

    markCurrentOption(langMenu, curLang);
    suggestBrowserLanguage();
}
