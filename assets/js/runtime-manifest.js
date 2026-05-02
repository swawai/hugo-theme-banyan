let runtimeManifestPromise = null;
let runtimeManifestCache = null;

export function readRuntimeManifestUrl() {
    return document.body?.dataset.assetManifestUrl || '';
}

export function getRuntimeManifest() {
    if (runtimeManifestCache) {
        return Promise.resolve(runtimeManifestCache);
    }

    if (!runtimeManifestPromise) {
        const manifestUrl = readRuntimeManifestUrl();
        if (!manifestUrl) {
            runtimeManifestCache = {};
            return Promise.resolve(runtimeManifestCache);
        }

        runtimeManifestPromise = fetch(manifestUrl, { credentials: 'include' })
            .then((res) => (res && res.ok ? res.json() : {}))
            .catch(() => ({}))
            .then((manifest) => {
                runtimeManifestCache = manifest && typeof manifest === 'object' ? manifest : {};
                return runtimeManifestCache;
            });
    }

    return runtimeManifestPromise;
}

export function getRuntimeLangListUrl(manifest) {
    return typeof manifest?.langList === 'string' && manifest.langList ? manifest.langList : '';
}

export function getRuntimeI18nUrl(manifest, lang) {
    const normalized = typeof lang === 'string' ? lang.toLowerCase() : '';
    const i18nMap = manifest && typeof manifest.i18n === 'object' ? manifest.i18n : null;
    if (i18nMap) {
        if (typeof i18nMap[normalized] === 'string' && i18nMap[normalized]) return i18nMap[normalized];
        if (normalized === 'zh-hk' || normalized === 'zh-mo') {
            if (typeof i18nMap['zh-tw'] === 'string' && i18nMap['zh-tw']) return i18nMap['zh-tw'];
        }
    }

    return '';
}
