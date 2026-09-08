import { LANG_SUGGEST_HANDLED_KEY, PREFERRED_LANG_KEY, readStorage, runAfterPageSettles, writeStorage } from './storage.js';

function localUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
        const url = new URL(value, window.location.href);
        return url.origin === window.location.origin && /^https?:$/.test(url.protocol)
            && !url.username && !url.password ? url : null;
    } catch { return null; }
}

function normalizeLang(code) {
    const value = (code || '').toLowerCase();
    return value === 'zh-hk' || value === 'zh-mo' ? 'zh-tw' : value;
}

function readContext(body) {
    try {
        const context = JSON.parse(body?.dataset.languageContext || 'null');
        return context && Array.isArray(context.options) && context.options.length ? context : null;
    } catch { return null; }
}

function message(template, replacements) {
    return template.replace(/\\n/g, '\n').replace(/\[?\{(\w+)\}\]?/g,
        (match, key) => replacements[key] ?? match);
}

export function initLanguagePreference() {
    const context = readContext(document.body);
    if (!context) return;
    const picker = document.querySelector('[data-language-settings]');

    const targetHref = (option) => {
        const target = localUrl(option.href);
        if (!target) return '';
        if (option.translated && !picker) {
            const sourceUrl = new URL(window.location.href);
            target.search = sourceUrl.search;
            target.hash = sourceUrl.hash;
        }
        return target.pathname + target.search + target.hash;
    };
    const render = () => {
        document.querySelectorAll('[data-language-choice]').forEach((link) => {
            const option = context.options.find((item) => item.code === link.dataset.languageChoice);
            if (!option) return;
            link.href = targetHref(option);
            link.dataset.hasTrans = String(option.translated);
            const selected = option.code === context.language;
            link.classList.toggle('is-current', selected);
            if (selected) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    };
    render();

    document.addEventListener('click', (event) => {
        const link = event.target instanceof Element ? event.target.closest('a[data-language-choice]') : null;
        if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const option = context.options.find((item) => item.code === link.dataset.languageChoice);
        if (!option) return;
        const href = targetHref(option);
        if (!href) return;
        if (!option.translated && !window.confirm(message(context.missing, { lang: option.name }))) return;
        writeStorage(PREFERRED_LANG_KEY, normalizeLang(option.code));
        // A preference change stays in the same history slot as the language settings page.
        if (picker) window.location.replace(href);
        else window.location.href = href;
    });

    // Language recommendation belongs to the page, independently of any menu UI.
    if (!picker && !readStorage(PREFERRED_LANG_KEY) && !readStorage(LANG_SUGGEST_HANDLED_KEY)) {
        const supported = context.options.map((option) => option.code);
        const candidates = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
        let target = '';
        for (const candidate of candidates) {
            const code = normalizeLang(candidate);
            target = supported.includes(code) ? code : supported.includes(code.split('-')[0]) ? code.split('-')[0] : '';
            if (target) break;
        }
        const option = context.options.find((item) => item.code === target && item.translated);
        if (option && target !== context.language) runAfterPageSettles(() => {
            const accepted = window.confirm(message(context.suggestion, { target: option.name }));
            writeStorage(LANG_SUGGEST_HANDLED_KEY, '1');
            if (accepted) {
                writeStorage(PREFERRED_LANG_KEY, target);
                window.location.href = targetHref(option);
            }
        }, 800);
    }
}
