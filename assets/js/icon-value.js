// Mirror the build-time icon value: a named SVG or an explicit text object.
export function normalizeIcon(value) {
    if (typeof value === 'string') return value.trim().toLowerCase() || null;
    if (value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length === 1 && typeof value.text === 'string' && value.text.trim()) {
        return { text: value.text.trim() };
    }
    return null;
}
