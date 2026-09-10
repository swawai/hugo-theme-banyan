import {
    fail,
    forceServiceWorkerUpdate,
    gotoAndWait,
    pollUntil,
    waitForServiceWorkerActive,
} from './helpers.mjs';

const MANAGED_CACHE_PREFIXES = [
    'nav-html-',
    'asset-versioned-',
    'asset-static-',
];
const FINGERPRINT_CACHE = 'asset-fingerprint';
const UNRELATED_CACHE = 'browser-regression-unrelated-cache';

function isManagedCache(key) {
    return key === FINGERPRINT_CACHE
        || MANAGED_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function readServiceWorkerState(page) {
    return page.evaluate(async () => ({
        cacheKeys: await caches.keys(),
        controller: navigator.serviceWorker.controller?.scriptURL || '',
        registrations: (await navigator.serviceWorker.getRegistrations()).map((registration) => ({
            active: registration.active?.scriptURL || '',
            scope: registration.scope,
        })),
    }));
}

export const swDisableScenarios = [
    {
        id: 'sw-disable-cleanup',
        kind: 'upgrade',
        title: 'Service Worker Enable To Disable Cleanup',
        viewport: { width: 1280, height: 960 },
        async run({ page, baseUrl, server, upgradePair }) {
            if (!upgradePair?.fromDir || !upgradePair?.toDir) {
                fail('SW disable regression requires explicit enable and disable builds.');
            }

            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/`);
            await waitForServiceWorkerActive(page);

            const enableManager = await page.locator('script[src*="sw-manager.enable"]').count();
            if (enableManager !== 1) {
                fail('The first build must contain exactly one enable manager.', { enableManager });
            }

            await page.evaluate(async ({ unrelatedCache }) => {
                await Promise.all([
                    caches.open('asset-versioned-browser-regression'),
                    caches.open('asset-static-browser-regression'),
                    caches.open(unrelatedCache),
                ]);
            }, { unrelatedCache: UNRELATED_CACHE });

            const before = await readServiceWorkerState(page);
            if (
                !before.cacheKeys.some((key) => key.startsWith('nav-html-'))
                || !before.cacheKeys.includes(FINGERPRINT_CACHE)
                || !before.cacheKeys.includes(UNRELATED_CACHE)
            ) {
                fail('Enable build must establish real managed caches before disable cleanup.', before);
            }

            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await pollUntil(async () => {
                const state = await readServiceWorkerState(page);
                return state.cacheKeys.includes(UNRELATED_CACHE)
                    && !state.cacheKeys.some(isManagedCache);
            }, { timeoutMs: 15_000, label: 'Disable worker activation and managed cache cleanup' });

            await page.reload({ waitUntil: 'load' });
            const disableManager = await page.locator('script[src*="sw-manager.disable"]').count();
            if (disableManager !== 1) {
                fail('The disable build must contain exactly one disable manager.', { disableManager });
            }
            await pollUntil(async () => {
                const state = await readServiceWorkerState(page);
                return state.registrations.length === 0;
            }, { timeoutMs: 10_000, label: 'Disable manager registration cleanup' });

            await page.reload({ waitUntil: 'load' });
            const after = await readServiceWorkerState(page);
            if (
                after.controller
                || after.registrations.length > 0
                || after.cacheKeys.some(isManagedCache)
                || !after.cacheKeys.includes(UNRELATED_CACHE)
            ) {
                fail('Disable mode must leave unrelated caches intact and remove all managed PWA state.', {
                    after,
                    before,
                });
            }

            return { after, before };
        },
    },
];
