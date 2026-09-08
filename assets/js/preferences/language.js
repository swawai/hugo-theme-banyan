import { LANG_SUGGEST_HANDLED_KEY, PREFERRED_LANG_KEY, readStorage, runAfterPageSettles, writeStorage } from './storage.js';

const RETURN_LANGUAGE_KEY = 'banyan:language-return';

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

    const applyReturnLanguage = (fromHistory) => {
        if (picker) return false;
        document.querySelector('[data-language-return-notice]')?.remove();
        let language;
        try {
            language = sessionStorage.getItem(RETURN_LANGUAGE_KEY);
            sessionStorage.removeItem(RETURN_LANGUAGE_KEY);
        } catch { return false; }
        // Only this settings visit can translate a restored page. Explicit URLs keep their language.
        if (!fromHistory || !language || language === context.language) return false;
        const option = context.options.find((item) => item.code === language);
        if (!option) return false;
        if (!option.translated) {
            const notice = document.createElement('p');
            notice.dataset.languageReturnNotice = '';
            notice.setAttribute('role', 'status');
            notice.textContent = message(context.returnMissing, { lang: option.name });
            document.getElementById('main')?.prepend(notice);
            return false;
        }
        const href = targetHref(option);
        if (!href) return false;
        window.location.replace(href);
        return true;
    };
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) applyReturnLanguage(true);
    });
    if (applyReturnLanguage(performance.getEntriesByType('navigation')[0]?.type === 'back_forward')) return;

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
        if (picker) {
            try { sessionStorage.setItem(RETURN_LANGUAGE_KEY, option.code); } catch { /* Keep language links usable without storage. */ }
            window.location.replace(href);
        } else window.location.href = href;
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
