import { LANG_SUGGEST_HANDLED_KEY, PREFERRED_LANG_KEY, readStorage, runAfterPageSettles, writeStorage } from './storage.js';
import { localUrl, settingsReturnUrl } from './settings-navigation.js';

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
    let context = readContext(document.body);
    if (!context) return;
    const picker = document.querySelector('[data-language-settings]');
    const returnAddress = picker ? settingsReturnUrl() : null;
    const hasReturn = picker && new URL(window.location.href).searchParams.has('return');
    let sourceUrl = returnAddress || new URL(window.location.href);
    let available = !hasReturn;

    const targetHref = (option) => {
        const target = localUrl(option.href);
        if (!target) return '';
        if (option.translated) {
            target.search = sourceUrl.search;
            target.hash = sourceUrl.hash;
        }
        return target.pathname + target.search + target.hash;
    };
    const render = () => {
        document.querySelectorAll('[data-language-choice]').forEach((link) => {
            const option = context.options.find((item) => item.code === link.dataset.languageChoice);
            if (!option) return;
            if (available) link.href = targetHref(option);
            else link.removeAttribute('href');
            link.dataset.hasTrans = String(option.translated);
            const selected = option.code === context.language;
            link.classList.toggle('is-current', selected);
            if (selected) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
            if (available) link.removeAttribute('aria-disabled');
            else link.setAttribute('aria-disabled', 'true');
        });
    };
    const setStatus = (state) => {
        if (!picker) return;
        picker.dataset.languageState = state;
        const status = picker.querySelector('[data-settings-status]');
        const retry = picker.querySelector('[data-settings-retry]');
        if (status) {
            status.textContent = state === 'loading' ? picker.dataset.loadingLabel
                : state === 'error' ? picker.dataset.errorLabel : '';
            status.hidden = state === 'ready';
        }
        if (retry) retry.hidden = state !== 'error';
    };
    const loadReturnContext = async () => {
        if (!hasReturn) { setStatus('ready'); render(); return; }
        available = false;
        setStatus('loading');
        render();
        try {
            if (!returnAddress) throw new Error('Invalid return address');
            const response = await fetch(returnAddress.pathname + returnAddress.search, { credentials: 'same-origin' });
            if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Unavailable return page');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const original = readContext(doc.body);
            if (!original || original.page !== returnAddress.pathname
                || original.options.some((option) => !localUrl(option.href))) throw new Error('Unavailable translation context');
            context = original;
            sourceUrl = returnAddress;
            available = true;
            setStatus('ready');
            render();
        } catch { setStatus('error'); }
    };
    let ready = loadReturnContext();
    picker?.querySelector('[data-settings-retry]')?.addEventListener('click', () => { ready = loadReturnContext(); });

    document.addEventListener('click', async (event) => {
        const link = event.target instanceof Element ? event.target.closest('a[data-language-choice]') : null;
        if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        await ready;
        if (!available) return;
        const option = context.options.find((item) => item.code === link.dataset.languageChoice);
        if (!option) return;
        if (!hasReturn) sourceUrl = new URL(window.location.href);
        const href = targetHref(option);
        if (!href) return;
        if (!option.translated && !window.confirm(message(context.missing, { lang: option.name }))) return;
        writeStorage(PREFERRED_LANG_KEY, normalizeLang(option.code));
        window.location.href = href;
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
