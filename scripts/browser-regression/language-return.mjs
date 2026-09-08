import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { gotoAndWait, suppressLanguageSuggestDialogScript } from './helpers.mjs';

const pendingKey = 'banyan:language-return';
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
            await page.reload();
            await page.locator('[data-page-action="back"]').click();
            await page.waitForURL(baseUrl + '/zh' + suffix);
            await page.waitForSelector('[data-root-href="/zh/products/"].is-current');
            assert.equal(await page.evaluate(() => history.length), historyLength);
            assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingKey), null);
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
        id: 'language-return-bfcache',
        kind: 'single',
        title: 'Selected Language Applies to Real BFCache Restorations',
        async run({ baseUrl }) {
            const browser = await chromium.launch({ channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'] });
            try {
                const context = await browser.newContext({ serviceWorkers: 'block' });
                await context.addInitScript(suppressLanguageSuggestDialogScript());
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
