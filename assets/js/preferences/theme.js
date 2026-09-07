import { readStorage, writeStorage } from './storage.js';

const PREFERENCE_KEY = 'theme-preference';
const MODES = ['auto', 'light', 'dark'];

export function initThemePreference() {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const readMode = () => {
        const stored = readStorage(PREFERENCE_KEY);
        return MODES.includes(stored) ? stored : 'auto';
    };
    let mode = readMode();
    const apply = () => {
        document.documentElement.dataset.themePreference = mode;
        document.documentElement.dataset.theme = mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode;
        document.querySelectorAll('[data-theme-choice]').forEach((option) => {
            const selected = option.dataset.themeChoice === mode;
            option.classList.toggle('is-current', selected);
            option.setAttribute('aria-pressed', String(selected));
        });
        document.dispatchEvent(new CustomEvent('banyan:theme-preference', { detail: mode }));
    };
    document.addEventListener('click', (event) => {
        const option = event.target instanceof Element ? event.target.closest('[data-theme-choice]') : null;
        if (!option || !MODES.includes(option.dataset.themeChoice)) return;
        mode = option.dataset.themeChoice;
        writeStorage(PREFERENCE_KEY, mode);
        apply();
    });
    media.addEventListener('change', apply);
    window.addEventListener('storage', (event) => {
        if (event.key === PREFERENCE_KEY || event.key === null) {
            mode = readMode();
            apply();
        }
    });
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) mode = readMode();
        apply();
    });
    apply();
}
