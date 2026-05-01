import { initEntryBreadcrumb } from './breadcrumb-entry.js';
import { initBreadcrumbMenus } from './breadcrumb-menu.js';
import { runBreadcrumbPreview } from './breadcrumb-preview.js';

// 针对微信安卓版：通过 WeixinJSBridge 强制覆盖字体大小并禁止用户修改，缓解字体缩放导致的页面跳变
(function () {
    if (typeof WeixinJSBridge == "object" && typeof WeixinJSBridge.invoke == "function") {
        handleFontSize();
    } else {
        if (document.addEventListener) {
            document.addEventListener("WeixinJSBridgeReady", handleFontSize, false);
        } else if (document.attachEvent) {
            document.attachEvent("WeixinJSBridgeReady", handleFontSize);
            document.attachEvent("onWeixinJSBridgeReady", handleFontSize);
        }
    }
    function handleFontSize() {
        try {
            WeixinJSBridge.invoke('setFontSizeCallback', { 'fontSize': 0 });
            WeixinJSBridge.on('menu:setfont', function () {
                WeixinJSBridge.invoke('setFontSizeCallback', { 'fontSize': 0 });
            });
        } catch (e) { }
    }
})();

let runtimeManifestPromise = null;
let runtimeManifestCache = null;

function readRuntimeManifestUrl() {
    return document.body?.dataset.assetManifestUrl || '';
}

function getRuntimeManifest() {
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

void getRuntimeManifest();
runBreadcrumbPreview();

async function injectSiteManifest() {
    try {
        const manifest = await getRuntimeManifest();
        const url = manifest?.siteManifest;
        if (!url) return;
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = url;
        link.setAttribute('fetchpriority', 'low');
        document.head.appendChild(link);
    } catch (e) { }
}

document.addEventListener('DOMContentLoaded', () => {
    injectSiteManifest();
    initBreadcrumbMenus();
    initEntryBreadcrumb();
});
