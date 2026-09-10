// Normalize browser-facing icon values; image URLs already point to hashed resources.
export function normalizeIcon(value) {
    if (typeof value === 'string') return value.trim().toLowerCase() || null;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value);
        if (keys.length === 1 && typeof value.text === 'string' && value.text.trim()) return { text: value.text.trim() };
        if (typeof value.image === 'string' && /^\/(?!\/)/.test(value.image.trim())
            && keys.every(key => key === 'image' || key === 'monochrome')
            && (!keys.includes('monochrome') || typeof value.monochrome === 'boolean')) {
            return { image: value.image.trim(), ...(value.monochrome === true ? { monochrome: true } : {}) };
        }
    }
    return null;
}
