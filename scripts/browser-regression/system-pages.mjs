import assert from 'node:assert/strict';
import path from 'node:path';
import { gotoAndWait, waitForBreadcrumbSettled, waitForServiceWorkerActive, waitForUpdateReady } from './helpers.mjs';
import { languageReturnScenarios } from './language-return.mjs';

const system = '.system-page';
const updatePanel = '[data-site-update-panel]';

export const systemPageScenarios = [
    ...languageReturnScenarios,
    {
        id: 'system-site-directory',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 1024, height: 700 },
        title: 'Site Directory Sorting and Article Navigation',
        async run({ page, baseUrl, artifactDir }) {
            const grid = '.slot-main [data-sortable="true"]';
            const links = `${grid} .cell-title:not(.header) a`;
            const rowPaths = selector => page.locator(selector).evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
            const geometry = () => page.locator(grid).evaluate(node => {
                const row = node.querySelector('.cell-title:not(.header) a');
                return {
                    columns: getComputedStyle(node).gridTemplateColumns,
                    rowHeight: row.getBoundingClientRect().height,
                    titleOffset: row.querySelector('.collection-item-title').getBoundingClientRect().left - row.getBoundingClientRect().left
                };
            });
            for (const prefix of ['', '/zh', '/zh-tw']) {
                await gotoAndWait(page, `${baseUrl}${prefix}/`);
                const feedHref = await page.locator('head link[rel="alternate"][type="application/rss+xml"]').getAttribute('href');
                const homeEntry = `[data-root-href="${prefix}/"]`;
                const brand = await page.locator(`${homeEntry} .collection-item-title`).textContent();
                assert.equal(await page.locator('footer, .slot-footer').count(), 0);
                assert.equal(await page.locator(`${homeEntry}.is-current`).count(), 1);
                assert.equal(await page.locator(`${homeEntry} .icon--text`).textContent(), '©');
                assert.equal(await page.locator(homeEntry).getAttribute('href'), `${prefix}/`);
                await gotoAndWait(page, `${baseUrl}${prefix}/d/`);
                const directoryGeometry = await geometry();
                await gotoAndWait(page, `${baseUrl}${prefix}/site/`);
                assert.deepEqual(await geometry(), directoryGeometry, 'Site and directory use the same columns, row height and icon spacing.');
                assert.equal(await page.locator(grid).count(), 1);
                assert.deepEqual(await page.locator(`${grid} [data-sort-field]`).evaluateAll(nodes => nodes.map(node => node.dataset.sortField)), ['name', 'date', 'count']);
                const children = ['wechat', 'about', 'changelog', 'site/pwa', 'site/rss', 'site/github'];
                const expected = children.map(name => `${prefix}/${name}/`).sort();
                assert.deepEqual((await rowPaths(links)).sort(), expected, 'Only real site children belong to the directory.');
                assert.equal(await page.locator(`${grid} [data-site-update-action]`).count(), 0, 'Update actions stay outside sortable content.');
                assert.equal(await page.locator('[data-site-update-panel], [data-site-update-action], [data-page-action="back"]').count(), 0, 'The directory contains no appended system controls.');
                assert.equal(await page.locator('[data-site-update-link]').count(), 0, 'Root navigation does not specialize the site entry.');
                assert.equal(await page.locator('.slot-main > article > [data-sortable="true"]').count(), 1, 'The ordinary article-list renders the directory.');
                assert.equal(await page.locator('.slot-main > article [data-site-update-panel]').count(), 0, 'Site tools are attached outside the list layout.');
                assert.equal(await page.locator('footer, .slot-footer').count(), 0, 'The homepage entry replaces the footer.');
                assert.equal(await page.locator(`${homeEntry} .collection-item-title`).textContent(), brand);
                assert.equal(await page.locator(`${homeEntry}.is-current`).count(), 0);
                assert.equal(await page.locator(homeEntry).getAttribute('href'), `${prefix}/`);
                for (const [name, icon] of [['rss', 'rss'], ['github', 'github']]) {
                    assert.equal(await page.locator(`${links}[href*="/site/${name}/"] use`).getAttribute('href'), `#icon-${icon}`);
                }
                const filingEntry = page.locator(`[data-root-href="${prefix}/icp/"]`);
                const filingIcon = filingEntry.locator('img.icon--image');
                assert.match(await filingIcon.getAttribute('src'), /^\/media\/content\/icp\/0\.[a-f0-9]{64}\.webp$/);
                await filingIcon.evaluate(image => image.decode());
                assert.equal(await filingIcon.getAttribute('alt'), '');
                assert.equal(await filingEntry.locator('.collection-item-title').textContent(), 'ICP备2024338434号');
                assert.deepEqual((await rowPaths('[data-root-href]')).slice(-2), [`${prefix}/icp/`, `${prefix}/`]);
                await filingEntry.click();
                await waitForBreadcrumbSettled(page);
                assert.equal(await filingEntry.getAttribute('aria-current'), 'page');
                assert.match(await page.locator('.slot-main .prose').textContent(), /粤ICP备2024338434号/);
                assert.equal(await page.locator('.slot-main .prose a[href="https://beian.miit.gov.cn/"]').count(), 1);
                await page.goBack();
                await page.waitForURL(`${baseUrl}${prefix}/site/`);
                await waitForBreadcrumbSettled(page);

                const assertArticle = async (name, expectedPaths) => {
                    assert.equal(await page.locator(`[data-root-href="${prefix}/site/"].is-current`).count(), 1);
                    assert.deepEqual(await rowPaths('.slot-breadcrumb .collection-item-link'), expectedPaths);
                    assert.equal(await page.locator(`.slot-breadcrumb .is-current[href*="/${name}/"]`).count(), 1);
                };
                const defaultPaths = await rowPaths(links);
                for (const name of children) {
                    await page.locator(`${links}[href*="/${name}/"]`).click();
                    await waitForBreadcrumbSettled(page);
                    await assertArticle(name, defaultPaths);
                    assert.equal(new URL(page.url()).pathname, `${prefix}/${name}/`, 'Selecting an information page stays on that page.');
                    if (name === 'site/github') {
                        assert.equal(await page.locator('.slot-main .prose a[href="https://github.com/swawai"]').count(), 1);
                    } else if (name === 'site/rss') {
                        const feed = page.locator(`.slot-main .prose a[href="${feedHref}"]`);
                        assert.equal(await feed.count(), 1, 'RSS uses the actual language homepage output.');
                        assert.equal(new URL((await feed.textContent()).trim()).pathname, new URL(feedHref, baseUrl).pathname, 'The visible subscription address can be copied into a reader.');
                        const response = await page.request.get(new URL(feedHref, baseUrl).href);
                        assert.equal(response.status(), 200);
                        const xml = await response.text();
                        assert.match(xml, /<rss\b/);
                        assert.match(xml, /<item>/);
                        assert(!/\/(?:site\/(?:rss|github)|icp)\//.test(xml), 'Local information pages do not become feed articles.');
                    }
                    if (prefix === '/zh') await page.screenshot({ path: path.join(artifactDir, `site-${name.replaceAll('/', '-')}-default.png`) });
                    if (name === 'site/pwa') assert.equal(await page.locator('.slot-main > article [data-site-update-panel]').count(), 1, 'Only the real PWA child renders its update controls.');
                    await page.goBack();
                    await page.waitForURL(`${baseUrl}${prefix}/site/`);
                    await waitForBreadcrumbSettled(page);
                }

                for (const [field, firstOrder] of [['count', 'desc'], ['date', 'desc'], ['name', 'asc']]) {
                    await page.locator(`${grid} [data-sort-field="${field}"]`).click();
                    await page.waitForURL(url => (url.searchParams.get('sort') || 'date-desc') === `${field}-${firstOrder}`);
                    await page.locator(`${grid} [data-sort-field="${field}"]`).click();
                    await page.waitForURL(url => (url.searchParams.get('sort') || 'date-desc') === `${field}-${firstOrder === 'asc' ? 'desc' : 'asc'}`);
                    assert.deepEqual((await rowPaths(links)).sort(), expected);
                }
                const sortedUrl = page.url();
                const sortedPaths = await rowPaths(links);
                await page.reload();
                await waitForBreadcrumbSettled(page);
                assert.deepEqual(await rowPaths(links), sortedPaths);
                await page.screenshot({ path: path.join(artifactDir, `site-${prefix.slice(1) || 'en'}.png`) });

                for (const name of children) {
                    await page.locator(`${links}[href*="/${name}/"]`).click();
                    await waitForBreadcrumbSettled(page);
                    assert.equal(new URL(page.url()).searchParams.get('from'), 'site');
                    const articleUrl = page.url();
                    await assertArticle(name, sortedPaths);
                    await page.reload();
                    await waitForBreadcrumbSettled(page);
                    await assertArticle(name, sortedPaths);
                    await page.goBack();
                    await page.waitForURL(sortedUrl);
                    await waitForBreadcrumbSettled(page);
                    assert.deepEqual(await rowPaths(links), sortedPaths);
                    await page.goForward();
                    await page.waitForURL(articleUrl);
                    await waitForBreadcrumbSettled(page);
                    await assertArticle(name, sortedPaths);
                    await page.goBack();
                    await page.waitForURL(sortedUrl);
                    await waitForBreadcrumbSettled(page);
                }
            }
            return { message: 'Six real site children retain their columns and selection in three languages across sort/reload/history; home and ICP are the final ordinary root entries, information links stay in their pages, and RSS resolves to the actual language feed.' };
        }
    },
    {
        id: 'system-return-live-navigation-state',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 1440, height: 900 },
        title: 'Ordinary System Links and Native Back Navigation',
        async run({ page, baseUrl, context }) {
            const entry = name => page.locator('[data-root-href="/zh/' + name + '/"]');
            const back = () => page.locator('[data-page-action="back"]').click();
            const assertCleanLinks = async () => {
                const links = await page.locator('[data-root-href]').evaluateAll(links => links.map(link => ({
                    href: new URL(link.href).pathname + new URL(link.href).search + new URL(link.href).hash,
                    root: link.dataset.rootHref
                })));
                assert.equal(links.length, 12);
                assert(links.every(link => link.href === link.root), 'All root entries retain their ordinary page URLs.');
            };
            await gotoAndWait(page, baseUrl + '/zh/all/');
            await page.locator('.slot-main [data-sort-field="name"]').click();
            await page.waitForURL(url => url.searchParams.get('sort') === 'name-asc');
            await page.evaluate(() => { location.hash = 'reading-position'; });
            await assertCleanLinks();
            const source = page.url();
            await entry('my').click();
            assert.equal(new URL(page.url()).search, '');
            await back();
            await page.waitForURL(source);
            await assertCleanLinks();

            // Opening a system entry in a new tab carries no return context.
            const opened = context.waitForEvent('page');
            await entry('language').click({button: 'middle'});
            const popup = await opened;
            try {
                await popup.waitForLoadState('networkidle');
                assert.equal(new URL(popup.url()).pathname, '/zh/language/');
                assert.equal(new URL(popup.url()).search, '');
                assert.equal(await popup.evaluate(() => history.length), 1);
                await popup.locator('[data-language-choice="en"]').click();
                await popup.waitForURL(baseUrl + '/language/');
                await popup.locator('[data-language-choice="zh-tw"]').click();
                await popup.waitForURL(baseUrl + '/zh-tw/language/');
                assert.equal(await popup.evaluate(() => history.length), 1, 'Language choices do not create a previous page in a new tab.');
                await popup.locator('[data-page-action="back"]').click();
                await popup.waitForURL(baseUrl + '/zh-tw/');
            } finally { await popup.close(); }

            await gotoAndWait(page, baseUrl + '/zh/p/xvenv/?from=all');
            const beforeSort = page.url();
            await page.locator('.slot-breadcrumb [data-collection-sort-toggle="true"]').click();
            await page.waitForURL(url => url.href !== beforeSort);
            await page.evaluate(() => history.replaceState({ ...history.state, backMarker: true }, '', location.href));
            const article = page.url();
            await assertCleanLinks();
            for (const name of ['appearance', 'site', 'language']) {
                await entry(name).click();
                await page.waitForURL(baseUrl + '/zh/' + name + '/');
                await assertCleanLinks();
            }
            await page.reload();
            for (const name of ['site', 'appearance']) {
                if (name === 'appearance') {
                    assert.equal(await page.locator('[data-page-action="back"]').count(), 0, 'The ordinary site directory has no custom back control.');
                    await page.goBack();
                } else await back();
                await page.waitForURL(baseUrl + '/zh/' + name + '/');
            }
            await back();
            await page.waitForURL(article);
            assert.equal(await page.evaluate(() => history.state.backMarker), true);
            await page.goForward();
            await page.waitForURL(baseUrl + '/zh/appearance/');
            await back();
            await page.waitForURL(article);
            return {message: 'Clean root links, My back, new-tab home, one-step settings history and article sort/state restoration passed.'};
        }
    },
    {
        id: 'system-language-return',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Language Choices Replace the Settings History Entry',
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, dialogs, artifactDir }) {
            await gotoAndWait(page, baseUrl + '/zh/p/xvenv/?from=products/free&sorts=_,name-asc#details');
            const article = page.url();
            await page.locator('[data-root-href="/zh/language/"]').click();
            const historyLength = await page.evaluate(() => history.length);
            const assertChoiceContract = async (selectedCode) => {
                const state = await page.evaluate(() => {
                    const list = document.querySelector('.system-page [data-list-view]');
                    return {
                        view: list?.dataset.listView || '',
                        sortable: Boolean(list?.hasAttribute('data-sortable') || list?.querySelector('[data-sortable]')),
                        options: [...(list?.querySelectorAll('[data-language-choice]') || [])].map((option) => ({
                            code: option.dataset.languageChoice,
                            current: option.getAttribute('aria-current') || '',
                            iconHidden: option.querySelector('.collection-item-icon')?.getAttribute('aria-hidden') || '',
                            iconText: option.querySelector('.collection-item-icon--text')?.textContent?.trim() || '',
                            label: option.querySelector('.collection-item-title')?.textContent?.trim() || '',
                            left: option.querySelector('.collection-item-title')?.getBoundingClientRect().left || 0,
                            tagName: option.tagName
                        }))
                    };
                });
                assert.equal(state.view, 'choice');
                assert.equal(state.sortable, false);
                assert.deepEqual(state.options.map(({code, iconText}) => [code, iconText]), [
                    ['en', 'EN'], ['zh', '简'], ['zh-tw', '繁']
                ]);
                assert(state.options.every((option) => option.tagName === 'A' && option.iconHidden === 'true' && option.label));
                assert.equal(state.options.find((option) => option.code === selectedCode)?.current, 'page');
                for (const option of state.options) {
                    assert.equal(await page.getByRole('link', {name: option.label, exact: true}).count(), 1,
                        `Decorative marker must not change the accessible name for ${option.code}.`);
                }
                const titlePositions = state.options.map((option) => option.left);
                assert(Math.max(...titlePositions) - Math.min(...titlePositions) <= 1,
                    'Text and Unicode icon choices keep one aligned title column.');
            };
            await assertChoiceContract('zh');
            for (const [code, pathname] of [['en', '/language/'], ['zh-tw', '/zh-tw/language/'], ['zh', '/zh/language/']]) {
                const choice = page.locator('[data-language-choice="' + code + '"]');
                assert.equal(await choice.getAttribute('href'), pathname);
                await choice.click();
                await page.waitForURL(baseUrl + pathname);
                assert.equal(await page.evaluate(() => localStorage.getItem('preferred_lang')), code);
                assert.equal(await page.locator('[data-language-choice="' + code + '"]').getAttribute('aria-current'), 'page');
                assert.equal(await page.evaluate(() => history.length), historyLength, 'Choosing a language replaces the current settings entry.');
                await assertChoiceContract(code);
            }
            await page.reload();
            await page.locator('[data-page-action="back"]').click();
            await page.waitForURL(article);
            await page.goForward();
            await page.waitForURL(baseUrl + '/zh/language/');
            await page.goBack();
            await page.waitForURL(article);
            assert.equal(await page.evaluate(() => localStorage.getItem('preferred_lang')), 'zh', 'Returning does not undo the chosen preference.');

            // Old links only lose the obsolete parameter; its value is never used.
            await page.addInitScript(() => history.replaceState({ ...history.state, cleanupMarker: true }, '', location.href));
            for (const name of ['language', 'appearance', 'my', 'site/pwa']) {
                await gotoAndWait(page, baseUrl + '/zh/' + name + '/?return=https%3A%2F%2Fexample.invalid%2F&probe=keep#anchor');
                assert.equal(new URL(page.url()).search, '?probe=keep');
                assert.equal(new URL(page.url()).hash, '#anchor');
                assert.equal(await page.evaluate(() => history.state.cleanupMarker), true);
            }
            await gotoAndWait(page, baseUrl + '/zh/site/?return=unused&probe=keep');
            assert.equal(new URL(page.url()).search, '?return=unused&probe=keep', 'The ordinary directory does not apply settings-specific URL cleanup.');
            await gotoAndWait(page, baseUrl + '/language/?return=' + encodeURIComponent('/prefetchdebug/'));
            const dialogCount = dialogs.length;
            await page.locator('[data-language-choice="zh"]').click();
            await page.waitForURL(baseUrl + '/zh/language/');
            assert.equal(dialogs.length, dialogCount);
            await page.screenshot({path: path.join(artifactDir, 'language.png')});
            return {message: 'Three language choices share one history entry; button/browser back restores the article, forward restores the final language, and clean URLs/preference survive refresh.'};
        }
    },
    {
        id: 'system-appearance-independent',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Appearance Page and Global Preference',
        async run({ page, baseUrl, context, artifactDir }) {
            await page.emulateMedia({ colorScheme: 'light' });
            await gotoAndWait(page, baseUrl + '/zh/all/?sort=name-asc');
            await page.locator('[data-root-href="/zh/appearance/"]').click();
            await page.waitForURL(baseUrl + '/zh/appearance/');
            const choiceContract = await page.evaluate(() => {
                const list = document.querySelector('.system-page [data-list-view]');
                return {
                    view: list?.dataset.listView || '',
                    sortable: Boolean(list?.hasAttribute('data-sortable') || list?.querySelector('[data-sortable]')),
                    options: [...(list?.querySelectorAll('[data-theme-choice]') || [])].map((option) => ({
                        choice: option.dataset.themeChoice,
                        pressed: option.getAttribute('aria-pressed'),
                        tagName: option.tagName
                    }))
                };
            });
            assert.equal(choiceContract.view, 'choice');
            assert.equal(choiceContract.sortable, false);
            assert.deepEqual(choiceContract.options.map((option) => option.choice), ['auto', 'light', 'dark']);
            assert(choiceContract.options.every((option) => option.tagName === 'BUTTON' && option.pressed !== null));
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
            await page.locator('[data-page-action="back"]').click();
            await page.waitForURL((url) => url.pathname === '/zh/all/');
            await page.emulateMedia({ colorScheme: 'light' });
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');

            const other = await context.newPage();
            await other.goto(`${baseUrl}/zh/appearance/`);
            await other.locator(`${system} [data-theme-choice="dark"]`).click();
            await page.waitForFunction(() => document.documentElement.dataset.themePreference === 'dark');
            await other.close();
            await page.goForward();
            await page.waitForSelector(`${system} [data-theme-choice="dark"].is-current`);
            await page.screenshot({ path: path.join(artifactDir, 'appearance-dark.png') });
            return { message: 'Appearance choices, refresh, return, system changes and cross-tab sync passed.' };
        }
    },
    {
        id: 'sw-system-site-update',
        kind: 'upgrade',
        title: 'PWA Status Child Checks and Applies Service Worker Updates',
        dialogPolicy: 'dismiss',
        async run({ page, context, baseUrl, server, upgradePair, dialogs, artifactDir }) {
            assert.ok(upgradePair?.fromDir && upgradePair?.toDir, 'Two builds containing the system pages are required.');
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/site/pwa/?from=site`);
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
            assert.equal(dialogs.length, 0, 'The PWA status page should show the update in place.');
            await page.screenshot({ path: path.join(artifactDir, 'site-update-ready.png') });
            const navigation = page.waitForEvent('load');
            await page.locator('[data-site-update-action="check"]').click();
            await navigation;
            await page.waitForFunction((previous) => document.querySelector('[data-site-update-version]')?.title !== previous, versionBefore);
            await waitForServiceWorkerActive(page);
            assert.equal(new URL(page.url()).pathname, '/zh/site/pwa/');
            assert.equal(await page.locator('[data-root-href="/zh/site/"].is-current').count(), 1);
            assert.equal(await page.locator('.slot-breadcrumb .is-current[href*="/site/pwa/"]').count(), 1, 'Applying updates preserves the ordinary directory selection.');
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
