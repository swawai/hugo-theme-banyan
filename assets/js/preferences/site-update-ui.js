import { fetchRuntimeJson, getRuntimeBuildTime, getRuntimeBuildVersion, getRuntimeI18nUrl, getRuntimeManifest } from '../runtime-manifest.js';

const updateCopyPromises = new Map();
const updateCopyCache = new Map();
let renderRevision = 0;

function getFallbackUpdateCopy() {
    return {
        message: 'A new version is ready. Refresh now?',
        versionCheck: 'Check for updates',
        versionChecking: 'Checking...',
        versionCheckFailed: 'Check failed',
        versionUnavailable: 'Updates are unavailable in this browser.',
        versionStatus: 'Status',
        versionStatusCurrent: 'Up to date',
        versionStatusReady: 'New version available',
        versionStatusOffline: 'Offline',
        versionStatusClickUpdate: 'Update now',
        versionStatusClickRetry: 'click retry'
    };
}

function normalizeUpdateCopy(messages) {
    const fallback = getFallbackUpdateCopy();
    if (!messages || typeof messages !== 'object') return fallback;

    return {
        message: typeof messages.site_update_prompt === 'string' && messages.site_update_prompt ? messages.site_update_prompt : fallback.message,
        versionCheck: typeof messages.site_version_check === 'string' && messages.site_version_check ? messages.site_version_check : fallback.versionCheck,
        versionChecking: typeof messages.site_version_checking === 'string' && messages.site_version_checking ? messages.site_version_checking : fallback.versionChecking,
        versionCheckFailed: typeof messages.site_version_check_failed === 'string' && messages.site_version_check_failed ? messages.site_version_check_failed : fallback.versionCheckFailed,
        versionUnavailable: messages.site_version_unavailable || fallback.versionUnavailable,
        versionStatus: typeof messages.site_version_status === 'string' && messages.site_version_status ? messages.site_version_status : fallback.versionStatus,
        versionStatusCurrent: typeof messages.site_version_status_current === 'string' && messages.site_version_status_current ? messages.site_version_status_current : fallback.versionStatusCurrent,
        versionStatusReady: typeof messages.site_version_status_ready === 'string' && messages.site_version_status_ready ? messages.site_version_status_ready : fallback.versionStatusReady,
        versionStatusOffline: typeof messages.site_version_status_offline === 'string' && messages.site_version_status_offline ? messages.site_version_status_offline : fallback.versionStatusOffline,
        versionStatusClickUpdate: typeof messages.site_version_status_click_update === 'string' && messages.site_version_status_click_update ? messages.site_version_status_click_update : fallback.versionStatusClickUpdate,
        versionStatusClickRetry: typeof messages.site_version_status_click_retry === 'string' && messages.site_version_status_click_retry ? messages.site_version_status_click_retry : fallback.versionStatusClickRetry
    };
}

async function hydrateUpdateCopy(lang = document.documentElement.lang || '') {
    const langKey = typeof lang === 'string' && lang ? lang.toLowerCase() : '';
    if (updateCopyCache.has(langKey)) return updateCopyCache.get(langKey);

    if (!updateCopyPromises.has(langKey)) {
        updateCopyPromises.set(langKey, (async () => {
            const fallback = getFallbackUpdateCopy();
            const manifest = await getRuntimeManifest();
            const url = getRuntimeI18nUrl(manifest, langKey);
            if (!url) {
                updateCopyCache.set(langKey, fallback);
                return fallback;
            }

            try {
                const copy = normalizeUpdateCopy(await fetchRuntimeJson(url));
                updateCopyCache.set(langKey, copy);
                return copy;
            } catch (error) {
                updateCopyCache.set(langKey, fallback);
                return fallback;
            }
        })());
    }

    return updateCopyPromises.get(langKey);
}

function getVersionStatusValue(copy, status, latencyMs) {
    if (status === 'unavailable') return copy.versionUnavailable;
    if (status === 'idle') return '';
    if (status === 'checking') return copy.versionChecking;
    if (status === 'failed') return `${copy.versionCheckFailed} · ${copy.versionStatusClickRetry}`;
    if (status === 'offline') return `${copy.versionStatusOffline} · ${copy.versionStatusClickRetry}`;
    if (status === 'ready') return `${copy.versionStatusReady} · ${copy.versionStatusClickUpdate}`;

    const latency = Number.isFinite(latencyMs) && latencyMs >= 0
        ? ` · ${Math.round(latencyMs)}ms`
        : '';
    return `${copy.versionStatusCurrent}${latency}`;
}


export function hasVisibleUpdateControl() {
    return Array.from(document.querySelectorAll('[data-site-update-action]'))
        .some((element) => getComputedStyle(element).visibility !== 'hidden' && element.getClientRects().length > 0);
}

export async function confirmSiteUpdate() {
    const copy = await hydrateUpdateCopy();
    return window.confirm(copy.message);
}

export async function renderUpdateUi(status, latencyMs) {
    const revision = ++renderRevision;
    const root = document.documentElement;
    if (status === 'ready') root.dataset.siteUpdate = 'ready';
    else delete root.dataset.siteUpdate;
    const panels = document.querySelectorAll('[data-site-update-panel]');
    if (!panels.length) return;

    const [copy, manifest] = await Promise.all([hydrateUpdateCopy(), getRuntimeManifest()]);
    if (revision !== renderRevision) return;
    const version = getRuntimeBuildVersion(manifest) || '-';
    const versionLabel = getRuntimeBuildTime(manifest) || version;
    const statusValue = getVersionStatusValue(copy, status, latencyMs);
    panels.forEach((panel) => {
        panel.dataset.siteUpdateState = status;
        const versionLink = panel.querySelector('[data-site-update-version]');
        const versionText = versionLink?.querySelector('.collection-item-title');
        if (versionText) versionText.textContent = versionLabel;
        if (versionLink) versionLink.title = version;
        const action = panel.querySelector('[data-site-update-action]');
        const label = action?.querySelector('.collection-item-title');
        if (action) action.disabled = status === 'checking' || status === 'unavailable';
        if (label) label.textContent = status === 'ready' ? copy.versionStatusClickUpdate
            : status === 'checking' ? copy.versionChecking : copy.versionCheck;
        const statusNode = panel.querySelector('[data-site-update-status]');
        if (statusNode) statusNode.textContent = statusValue ? copy.versionStatus + ': ' + statusValue : '';
    });
}

export function bindUpdateUi(onCheck) {
    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-site-update-action="check"]')) return;
        event.preventDefault();
        onCheck();
    });
}
