import assert from 'node:assert/strict';
import path from 'node:path';
import { gotoAndWait, waitForServiceWorkerActive, waitForUpdateReady } from './helpers.mjs';

const system = '.system-page';
const picker = '[data-language-settings]';
const updatePanel = '[data-site-update-panel]';

export const systemPageScenarios = [
    {
        id: 'system-return-live-navigation-state',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 1440, height: 900 },
        title: 'Settings Links Track Live Sort and History State',
        async run({ page, baseUrl, context }) {
            const settingsEntry = (name) => page.locator(`[data-root-navigation] a[data-root-href="/zh/${name}/"]`);
            const relativeUrl = () => {
                const url = new URL(page.url());
                return url.pathname + url.search + url.hash;
            };
            const assertReturnLinks = async (expected) => {
                const targets = await page.locator('[data-root-navigation] a[data-settings-link]').evaluateAll(
                    links => links.map(link => new URL(link.href).searchParams.get('return'))
                );
                assert.equal(targets.length, 4);
                assert.deepEqual(targets, Array(4).fill(expected), 'Every settings href must already contain the current reading state.');
            };
            const markDocument = () => page.evaluate(() => {
                window.__settingsNavigationDocument = 'same-document';
                history.replaceState({ ...history.state, settingsReviewMarker: 'preserved' }, '', location.href);
            });
            const assertDocumentPreserved = async () => {
                assert.deepEqual(await page.evaluate(() => ({
                    document: window.__settingsNavigationDocument,
                    history: history.state?.settingsReviewMarker
                })), { document: 'same-document', history: 'preserved' });
            };

            await gotoAndWait(page, `${baseUrl}/zh/all/`);
            await markDocument();
            await page.locator('.slot-main [data-sort-control="true"][data-sort-field="name"]').click();
            await page.waitForURL(url => url.searchParams.get('sort') === 'name-asc');
            await assertDocumentPreserved();
            await assertReturnLinks(relativeUrl());

            // Middle-click consumes the existing href without firing the normal click handler.
            const popupReady = context.waitForEvent('page');
            await settingsEntry('language').click({ button: 'middle' });
            const popup = await popupReady;
            try {
                await popup.waitForSelector('[data-language-state="ready"]');
                assert.equal(new URL(popup.url()).searchParams.get('return'), relativeUrl());
                assert.equal(await popup.locator('[data-settings-return]').getAttribute('href'), relativeUrl());
            } finally { await popup.close(); }

            // Native hash/history changes also update the link before copying or opening it.
            await page.evaluate(() => { location.hash = 'return-first'; });
            await page.waitForFunction(() => document.querySelector('[data-settings-link]')?.href.includes('%23return-first'));
            await assertReturnLinks(relativeUrl());
            await page.evaluate(() => { location.hash = 'return-second'; });
            await page.waitForFunction(() => document.querySelector('[data-settings-link]')?.href.includes('%23return-second'));
            await page.goBack();
            await page.waitForURL(url => url.hash === '#return-first');
            await assertReturnLinks(relativeUrl());
            await page.goForward();
            await page.waitForURL(url => url.hash === '#return-second');
            await assertReturnLinks(relativeUrl());

            await gotoAndWait(page, `${baseUrl}/zh/p/xvenv/?from=all`);
            await markDocument();
            const before = relativeUrl();
            await page.locator('.slot-breadcrumb [data-collection-sort-toggle="true"]').click();
            await page.waitForURL(url => url.pathname + url.search + url.hash !== before);
            await assertDocumentPreserved();
            const source = relativeUrl();
            await assertReturnLinks(source);

            await settingsEntry('appearance').click();
            await page.waitForURL(url => url.pathname === '/zh/appearance/');
            await assertReturnLinks(source);
            await page.evaluate(() => { location.hash = 'settings-only'; });
            await assertReturnLinks(source);
            await page.reload();
            await page.waitForSelector('[data-settings-return]:not([hidden])');
            await assertReturnLinks(source);
            await settingsEntry('site').click();
            await page.waitForURL(url => url.pathname === '/zh/site/');
            await assertReturnLinks(source);
            await settingsEntry('language').click();
            await page.waitForSelector('[data-language-state="ready"]');
            await assertReturnLinks(source);
            await page.locator('[data-settings-return]').click();
            await page.waitForURL(url => url.pathname + url.search + url.hash === source);
            return { message: 'Live main/breadcrumb sorts, pre-click hrefs, middle-click, hash/history, history-state preservation and chained settings return passed.' };
        }
    },
    {
        id: 'system-language-return',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Language Page Preserves Reading Context',
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, dialogs, artifactDir }) {
            await gotoAndWait(page, `${baseUrl}/zh/p/xvenv/?from=%2Fproducts%2Ffree%2F&sort=name-asc&sorts=_,name-asc#details`);
            const source = new URL(page.url());
            await page.locator('[data-root-navigation] a[data-root-href="/zh/language/"]').click();
            await page.waitForSelector(`${picker}[data-language-state="ready"]`);
            const returnHref = await page.locator('[data-settings-return]').getAttribute('href');
            assert.equal(returnHref, source.pathname + source.search + source.hash);
            await page.locator(`${system} [data-language-choice="en"]`).click();
            await page.waitForURL((url) => url.pathname === '/p/xvenv/');
            const translated = new URL(page.url());
            assert.equal(translated.search, source.search);
            assert.equal(translated.hash, source.hash);
            assert.equal(await page.evaluate(() => localStorage.getItem('preferred_lang')), 'en');

            // The root project's existing debug page intentionally has no Chinese translation.
            await gotoAndWait(page, `${baseUrl}/zh/language/?return=${encodeURIComponent('/prefetchdebug/?sort=name.asc#debug')}`);
            await page.waitForSelector(`${picker}[data-language-state="ready"]`);
            const before = page.url();
            const dialogCount = dialogs.length;
            await page.locator(`${system} [data-language-choice="zh"]`).click();
            assert.equal(page.url(), before);
            assert.equal(dialogs.length, dialogCount + 1);

            await gotoAndWait(page, `${baseUrl}/zh/language/?return=${encodeURIComponent('https://example.invalid/article/')}`);
            await page.waitForSelector(`${picker}[data-language-state="error"]`);
            assert.equal(await page.locator('[data-settings-return]').isVisible(), false);
            assert.equal(await page.locator(`${system} [data-language-choice="en"]`).getAttribute('aria-disabled'), 'true');
            assert.equal(await page.locator(`${system} [data-language-choice="en"]`).getAttribute('href'), null);
            assert.equal(new URL(page.url()).pathname, '/zh/language/');

            // A failed source lookup offers retry, without guessing a translation URL.
            await page.route('**/zh/about/**', (route) => route.fulfill({ status: 503, body: '' }));
            await gotoAndWait(page, `${baseUrl}/zh/language/?return=${encodeURIComponent('/zh/about/?probe=language-retry')}`);
            await page.waitForSelector(`${picker}[data-language-state="error"]`);
            await page.unroute('**/zh/about/**');
            await page.locator('[data-settings-retry]').click();
            await page.waitForSelector(`${picker}[data-language-state="ready"]`);
            await page.screenshot({ path: path.join(artifactDir, 'language.png') });

            await gotoAndWait(page, `${baseUrl}/zh/all/?sort=name-asc`);
            const original = new URL(page.url());
            const expectedReturn = original.pathname + original.search;
            const primaryLinks = await page.locator('[data-root-navigation] a[data-root-href]:not([data-settings-link])').evaluateAll(links => links.map(link => link.href));
            assert.equal(primaryLinks.length, 6, 'The six collection entries are ordinary links.');
            assert.ok(primaryLinks.every(href => !new URL(href).searchParams.has('return')), 'Only settings links carry return context.');
            await page.locator('[data-root-navigation] a[data-root-href="/zh/my/"]').click();
            await page.waitForURL(url => url.pathname === '/zh/my/');
            assert.equal(new URL(page.url()).searchParams.get('return'), expectedReturn);
            await page.locator('[data-page-action="back"]').click();
            await page.waitForURL(url => url.pathname === original.pathname && url.search === original.search);
            return { message: 'Translation, source query/hash, missing-translation cancellation, invalid return and retry passed.' };
        }
    },
    {
        id: 'system-appearance-independent',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Appearance Page and Global Preference',
        async run({ page, baseUrl, context, artifactDir }) {
            await page.emulateMedia({ colorScheme: 'light' });
            await gotoAndWait(page, `${baseUrl}/zh/appearance/?return=${encodeURIComponent('/zh/all/?sort=name.asc')}`);
            await page.locator(`${system} [data-theme-choice="dark"]`).click();
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
            assert.equal(await page.evaluate(() => localStorage.getItem('theme-preference')), 'dark');
            await page.reload();
            await page.waitForSelector(`${system} [data-theme-choice="dark"].is-current[aria-pressed="true"]`);
            await page.locator(`${system} [data-theme-choice="light"]`).click();
            await page.waitForSelector(`${system} [data-theme-choice="light"].is-current`);

            assert.equal(await page.locator('.site-nav-utilities').count(), 0, 'The old settings buttons are removed.');
            await page.locator(`${system} [data-theme-choice="auto"]`).click();
            await page.emulateMedia({ colorScheme: 'dark' });
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
            await page.locator('[data-settings-return]').click();
            await page.waitForURL((url) => url.pathname === '/zh/all/');
            await page.emulateMedia({ colorScheme: 'light' });
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');

            const other = await context.newPage();
            await other.goto(`${baseUrl}/zh/appearance/`);
            await other.locator(`${system} [data-theme-choice="dark"]`).click();
            await page.waitForFunction(() => document.documentElement.dataset.themePreference === 'dark');
            await other.close();
            await page.goBack();
            await page.waitForSelector(`${system} [data-theme-choice="dark"].is-current`);
            await page.screenshot({ path: path.join(artifactDir, 'appearance-dark.png') });
            return { message: 'Appearance choices, refresh, return, system changes and cross-tab sync passed.' };
        }
    },
    {
        id: 'sw-system-site-update',
        kind: 'upgrade',
        title: 'Site Page Checks and Applies Service Worker Updates',
        dialogPolicy: 'dismiss',
        async run({ page, context, baseUrl, server, upgradePair, dialogs, artifactDir }) {
            assert.ok(upgradePair?.fromDir && upgradePair?.toDir, 'Two builds containing the system pages are required.');
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/site/`);
            await waitForServiceWorkerActive(page);
            await page.waitForSelector(`${updatePanel}[data-site-update-state]`);
            const versionBefore = await page.locator('[data-site-update-version]').getAttribute('title');
            const cacheKeysBefore = await page.evaluate(() => caches.keys());
            await context.setOffline(true);
            await page.locator('[data-site-update-action="check"]').click();
            await page.waitForSelector(`${updatePanel}[data-site-update-state="offline"]`);
            await context.setOffline(false);
            await page.locator('[data-site-update-action="check"]').click();
            await page.waitForSelector(`${updatePanel}[data-site-update-state="current"]`);

            server.setRoot(upgradePair.toDir);
            await page.locator('[data-site-update-action="check"]').click();
            await waitForUpdateReady(page);
            await page.waitForSelector(`${updatePanel}[data-site-update-state="ready"]`);
            assert.equal(dialogs.length, 0, 'The site page should show the update in place.');
            await page.screenshot({ path: path.join(artifactDir, 'site-update-ready.png') });
            const navigation = page.waitForEvent('load');
            await page.locator('[data-site-update-action="check"]').click();
            await navigation;
            await page.waitForFunction((previous) => document.querySelector('[data-site-update-version]')?.title !== previous, versionBefore);
            await waitForServiceWorkerActive(page);
            const cacheKeysAfter = await page.evaluate(() => caches.keys());
            for (const key of cacheKeysBefore.filter((key) => key.startsWith('nav-html-'))) {
                assert.ok(!cacheKeysAfter.includes(key), `Old navigation cache remains: ${key}`);
            }
            const swResponse = await context.request.get(`${baseUrl}/sw.js`);
            assert.equal(swResponse.headers()['cache-control'], 'no-cache, max-age=0, must-revalidate');
            return { message: 'Offline/retry, update notification, activation, reload, old navigation cache deletion and sw.js headers passed.',
                details: { versionBefore, versionAfter: await page.locator('[data-site-update-version]').getAttribute('title'), cacheKeysBefore, cacheKeysAfter } };
        }
    }
];
