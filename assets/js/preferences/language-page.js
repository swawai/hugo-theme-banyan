import './back-links.js';
import { RETURN_LANGUAGE_KEY, RETURN_LANGUAGE_LABEL_KEY, languageMessage } from './language-state.js';

const picker = document.querySelector('[data-language-settings]');

picker?.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[data-language-choice]') : null;
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = new URL(link.href);
    if (target.origin !== window.location.origin) return;
    event.preventDefault();

    const code = link.dataset.languageChoice;
    const name = link.dataset.languageName;
    if (link.dataset.hasTrans === 'false' && !window.confirm(languageMessage(picker.dataset.languageMissing, name))) return;
    try {
        // Cached pages read the code directly; keep its format stable across builds.
        sessionStorage.setItem(RETURN_LANGUAGE_KEY, code);
        sessionStorage.setItem(RETURN_LANGUAGE_LABEL_KEY, JSON.stringify({ code, name }));
    } catch { /* Static language links also work without storage. */ }
    // All choices occupy the same history slot, so Back leaves language settings.
    window.location.replace(target.pathname + target.search + target.hash);
});
