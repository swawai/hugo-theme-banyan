// Mirror published icon values; image URLs already point to hashed resources.
export function normalizeIcon(value) {
    if (typeof value === 'string') return value.trim().toLowerCase() || null;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1) {
        if (typeof value.text === 'string' && value.text.trim()) return { text: value.text.trim() };
        if (typeof value.image === 'string' && /^\/(?!\/)/.test(value.image.trim())) {
            return { image: value.image.trim() };
        }
    }
    return null;
}
