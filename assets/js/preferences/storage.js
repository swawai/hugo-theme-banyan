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
