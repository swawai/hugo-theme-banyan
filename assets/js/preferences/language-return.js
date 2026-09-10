import { RETURN_LANGUAGE_KEY, RETURN_LANGUAGE_LABEL_KEY, languageMessage } from './language-state.js';

export function initLanguageReturn() {
    if (document.querySelector('[data-language-settings]')) return;

    const apply = (fromHistory) => {
        document.querySelector('[data-language-return-notice]')?.remove();
        let code;
        let name;
        try {
            code = sessionStorage.getItem(RETURN_LANGUAGE_KEY);
            sessionStorage.removeItem(RETURN_LANGUAGE_KEY);
        } catch { return; }
        try {
            const rawLabel = sessionStorage.getItem(RETURN_LANGUAGE_LABEL_KEY);
            sessionStorage.removeItem(RETURN_LANGUAGE_LABEL_KEY);
            const label = JSON.parse(rawLabel);
            // Older settings pages only write the code; an unrelated label may remain.
            if (label?.code === code) name = label.name;
        } catch { /* Optional display text must not block a language return. */ }
        // A settings visit may translate a restored page, never an explicit navigation.
        if (!fromHistory || !code || code === document.documentElement.lang) return;
        const translation = [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
            .find((link) => link.hreflang === code);
        if (!translation) {
            const notice = document.createElement('p');
            notice.dataset.languageReturnNotice = '';
            notice.setAttribute('role', 'status');
            notice.textContent = languageMessage(document.body.dataset.languageReturnMissing, name || code);
            document.getElementById('main')?.prepend(notice);
            return;
        }
        const target = new URL(translation.href);
        const canonical = document.querySelector('link[rel="canonical"]');
        // SEO links use the published origin; previews keep their own serving origin.
        if (!canonical || target.origin !== new URL(canonical.href).origin || !/^https?:$/.test(target.protocol)) return;
        window.location.replace(target.pathname + window.location.search + window.location.hash);
    };
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) apply(true);
    });
    apply(performance.getEntriesByType('navigation')[0]?.type === 'back_forward');
}
