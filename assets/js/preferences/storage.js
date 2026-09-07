export const PREFERRED_LANG_KEY = 'preferred_lang';
export const LANG_SUGGEST_HANDLED_KEY = 'lang-suggest-handled-v1';

export function readStorage(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

export function writeStorage(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (e) { }
}

export function runAfterPageSettles(callback, delayMs) {
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
