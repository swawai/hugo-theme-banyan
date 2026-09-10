import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { gotoAndWait } from './helpers.mjs';

const pendingKey = 'banyan:language-return';
const labelKey = 'banyan:language-return-label';
const choose = async (page, baseUrl, code) => {
    await page.locator(`[data-language-choice="${code}"]`).click();
    await page.waitForURL(baseUrl + (code === 'en' ? '' : `/${code}`) + '/language/');
};

export const languageReturnScenarios = [
    {
        id: 'language-return-translation',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Return to the Selected Translation Without Adding History',
        async run({ page, baseUrl, artifactDir }) {
            const suffix = '/p/xvenv/?from=products/free&sorts=_,name-asc#details';
            await gotoAndWait(page, baseUrl + suffix);
            await page.locator('[data-root-href="/language/"]').click();
            const historyLength = await page.evaluate(() => history.length);
            for (const code of ['zh-tw', 'en', 'zh']) await choose(page, baseUrl, code);
            assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey), 'zh',
                'Cached pages must still be able to read the language code directly.');
            await page.reload();
            await page.locator('[data-page-action="back"]').click();
            await page.waitForURL(baseUrl + '/zh' + suffix);
            await page.waitForSelector('[data-root-href="/zh/products/"].is-current');
            assert.equal(await page.evaluate(() => history.length), historyLength);
            assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey), null);
            assert.equal(await page.evaluate(key => sessionStorage.getItem(key), labelKey), null);
            await page.screenshot({ path: path.join(artifactDir, 'returned-chinese.png') });
            await page.goForward();
            await page.waitForURL(baseUrl + '/zh/language/');
            await page.goBack();
            await page.waitForURL(baseUrl + '/zh' + suffix);

            // Browser Back also translates collection pages and keeps their sort query.
            await gotoAndWait(page, baseUrl + '/zh/all/?sort=name-asc');
            await page.locator('[data-root-href="/zh/language/"]').click();
            await choose(page, baseUrl, 'en');
            await page.goBack({ waitUntil: 'commit' });
            await page.waitForURL(baseUrl + '/all/?sort=name-asc');
            await page.waitForSelector('[data-sort-field="name"][data-sort-active="true"]');
            return { message: 'Article and collection translations, source/sort/hash, repeated choices, reload, button/browser Back and Forward passed.' };
        }
    },
    {
        id: 'language-return-boundaries',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Missing Translations, Explicit URLs and Tab Isolation',
        async run({ page, baseUrl, context, dialogs }) {
            await gotoAndWait(page, baseUrl + '/prefetchdebug/');
            await page.locator('[data-root-href="/language/"]').click();
            await choose(page, baseUrl, 'zh');
            await page.locator('[data-page-action="back"]').click();
            await page.waitForSelector('[data-language-return-notice][role="status"]');
            assert.equal(new URL(page.url()).pathname, '/prefetchdebug/');
            assert.match(await page.locator('[data-language-return-notice]').textContent(), /中文/);
            assert.equal(dialogs.length, 0, 'Missing translation retains content without a confirmation dialog.');
            await page.reload();
            assert.equal(await page.locator('[data-language-return-notice]').count(), 0);

            // A saved preference alone never redirects an explicit English URL or its history.
            await gotoAndWait(page, baseUrl + '/p/xvenv/');
            await page.locator('[data-root-href="/language/"]').click();
            await page.locator('[data-page-action="back"]').click();
            await page.waitForURL(baseUrl + '/p/xvenv/');
            await page.waitForLoadState('networkidle');
            assert.equal(new URL(page.url()).pathname, '/p/xvenv/');

            const other = await context.newPage();
            await gotoAndWait(other, baseUrl + '/p/xvenv/');
            await other.locator('[data-root-href="/language/"]').click();
            await page.locator('[data-root-href="/language/"]').click();
            await choose(page, baseUrl, 'zh');
            await other.goBack();
            await other.waitForLoadState('networkidle');
            assert.equal(new URL(other.url()).pathname, '/p/xvenv/', 'Another tab has no pending language return.');
            await other.close();

            // Ordinary navigation consumes the pending choice without rewriting the destination.
            await gotoAndWait(page, baseUrl + '/p/xvenv/');
            assert.equal(new URL(page.url()).pathname, '/p/xvenv/');
            assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey), null);
            await page.goBack();
            await page.waitForURL(baseUrl + '/zh/language/');
            await page.goBack();
            await page.waitForURL(baseUrl + '/p/xvenv/');
            await page.waitForLoadState('networkidle');
            assert.equal(new URL(page.url()).pathname, '/p/xvenv/');

            const blocked = await context.newPage();
            await blocked.addInitScript(() => {
                Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage unavailable'); } });
            });
            await gotoAndWait(blocked, baseUrl + '/p/xvenv/');
            await blocked.locator('[data-root-href="/language/"]').click();
            await choose(blocked, baseUrl, 'zh');
            await blocked.locator('[data-page-action="back"]').click();
            await blocked.waitForURL(baseUrl + '/p/xvenv/');
            await blocked.close();
            return { message: 'Missing translation notice, explicit URLs, no-selection Back, ordinary navigation cancellation, tab isolation and unavailable sessionStorage passed.' };
        }
    },
    {
        id: 'language-return-storage-contract',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Older Language Writers Work Without Matching Display Metadata',
        async run({ page, baseUrl }) {
            for (const keepLabel of [false, true]) {
                await gotoAndWait(page, baseUrl + '/prefetchdebug/');
                await page.locator('[data-root-href="/language/"]').click();
                await choose(page, baseUrl, 'zh');
                await page.waitForLoadState('networkidle');
                // An older language page only writes the code. It does not know the label key.
                await page.evaluate(({ pendingKey, labelKey, keepLabel }) => {
                    sessionStorage.setItem(pendingKey, 'zh-tw');
                    if (!keepLabel) sessionStorage.removeItem(labelKey);
                }, { pendingKey, labelKey, keepLabel });
                await page.locator('[data-page-action="back"]').click();
                await page.waitForSelector('[data-language-return-notice][role="status"]');
                const notice = await page.locator('[data-language-return-notice]').textContent();
                assert.match(notice, /zh-tw/, 'Missing translation identifies the code written by the older page.');
                assert.doesNotMatch(notice, /中文/, 'A stale label for a different choice must not be displayed.');
                for (const key of [pendingKey, labelKey]) {
                    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), null);
                }
            }
            return { message: 'Code-only language records are consumed correctly with absent or stale display metadata.' };
        }
    },
    {
        id: 'language-return-bfcache',
        kind: 'single',
        title: 'Selected Language Applies to Real BFCache Restorations',
        async run({ baseUrl }) {
            const browser = await chromium.launch({ channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'] });
            try {
                const context = await browser.newContext({ serviceWorkers: 'block' });
                await context.addInitScript(() => {
                    window.addEventListener('pageshow', event => {
                        const events = JSON.parse(sessionStorage.getItem('test:pageshows') || '[]');
                        events.push({ path: location.pathname, persisted: event.persisted });
                        sessionStorage.setItem('test:pageshows', JSON.stringify(events));
                    });
                });
                const page = await context.newPage();
                await gotoAndWait(page, baseUrl + '/p/xvenv/?from=all&sort=name-asc');
                await page.locator('[data-root-href="/language/"]').click();
                await choose(page, baseUrl, 'zh');
                await page.waitForLoadState('networkidle');
                await page.locator('[data-page-action="back"]').click();
                await page.waitForURL(baseUrl + '/zh/p/xvenv/?from=all&sort=name-asc');
                await page.waitForLoadState('networkidle');
                // BFCache restores a document without firing another load event.
                await page.evaluate(() => history.forward());
                await page.waitForFunction(() => location.pathname === '/zh/language/');
                await choose(page, baseUrl, 'zh-tw');
                await page.waitForLoadState('networkidle');
                await page.evaluate(() => history.back());
                await page.waitForURL(baseUrl + '/zh-tw/p/xvenv/?from=all&sort=name-asc');
                const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem('test:pageshows')));
                for (const original of ['/p/xvenv/', '/zh/p/xvenv/']) {
                    assert(events.some(event => event.path === original && event.persisted), `Expected real BFCache restoration for ${original}.`);
                }
                assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey), null);
                return { message: 'Real pageshow.persisted restorations translate once for both the page button and browser Back.', details: events };
            } finally { await browser.close(); }
        }
    }
];
