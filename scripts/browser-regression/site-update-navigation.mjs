import assert from 'node:assert/strict';
import path from 'node:path';
import { forceServiceWorkerUpdate, gotoAndWait, pollUntil, waitForServiceWorkerActive, waitForUpdateReady } from './helpers.mjs';

const siteEntry = '[data-root-navigation] a[data-site-update-link]';

function requireUpgradePair(upgradePair) {
    assert.ok(upgradePair?.fromDir && upgradePair?.toDir, 'Two builds containing the flattened navigation are required.');
}

export const siteUpdateNavigationScenarios = [
    ...[
        { name: 'home', href: '/zh/' },
        { name: 'collection', href: '/zh/all/?sort=name-asc' }
    ].map(({ name, href }) => ({
        id: `sw-update-site-entry-${name}`,
        kind: 'upgrade',
        title: `Site Update Entry Navigates Before Applying (${name})`,
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, server, upgradePair, dialogs, artifactDir }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, baseUrl + href);
            await waitForServiceWorkerActive(page);
            assert.equal(await page.locator(siteEntry).count(), 1, 'Only the single root site entry carries update status.');

            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await page.waitForSelector(`${siteEntry}[data-site-update-state="ready"][aria-description]`);
            assert.ok(await page.locator(siteEntry).getAttribute('title'));
            const marker = await page.locator(`${siteEntry} .collection-item-title`).evaluate(node => getComputedStyle(node, '::after').content);
            assert.ok(marker && marker !== 'none' && marker !== 'normal' && marker !== '""', 'The ordinary root row shows a visible update marker.');
            assert.equal(dialogs.length, 0, 'A visible root site entry suppresses the confirmation fallback.');
            await page.screenshot({ path: path.join(artifactDir, 'site-entry-ready.png') });

            await page.locator(siteEntry).click();
            await page.waitForURL(url => url.pathname === '/zh/site/');
            await page.waitForSelector('[data-site-update-panel][data-site-update-state="ready"]');
            assert.equal(new URL(page.url()).searchParams.has('return'), false);
            assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting), true,
                'Navigating through the root entry must leave the worker waiting for the site-page action.');
            assert.equal(dialogs.length, 0);

            const reload = page.waitForEvent('load');
            await page.locator('[data-site-update-action="check"]').click();
            await reload;
            await waitForServiceWorkerActive(page);
            await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration('/'))?.waiting
                && document.documentElement.dataset.siteUpdate !== 'ready');
            return { message: 'One visible update entry navigates to its ordinary URL; only the site-page action activates and reloads.' };
        }
    })),
    ...['zh-hk', 'zh-mo'].map(lang => ({
        id: `sw-update-site-entry-${lang}`,
        kind: 'upgrade',
        title: `Site Update Entry Uses Traditional Chinese for ${lang}`,
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, server, upgradePair, dialogs }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/`);
            await waitForServiceWorkerActive(page);
            const expected = await page.evaluate(async () => {
                const manifest = await (await fetch(document.body.dataset.assetManifestUrl)).json();
                const messages = await (await fetch(manifest.i18n['zh-tw'])).json();
                return messages.site_version_status_ready;
            });
            assert.ok(expected, 'The Traditional Chinese status is defined in the runtime i18n resource.');
            await page.evaluate(value => { document.documentElement.lang = value; }, lang);
            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await page.waitForFunction(value => document.querySelector('[data-site-update-link]')?.getAttribute('aria-description') === value, expected);
            assert.equal(await page.locator(siteEntry).getAttribute('title'), expected);
            assert.equal(dialogs.length, 0);
            return { message: `${lang} resolves to the Traditional Chinese site update notice.`, details: { expected } };
        }
    })),
    {
        id: 'sw-update-without-visible-control-fallback',
        kind: 'upgrade',
        title: 'Hidden Update Entry Falls Back to One Confirmation',
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, server, upgradePair, dialogs }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/all/`);
            await waitForServiceWorkerActive(page);
            await page.locator(siteEntry).evaluate(node => { node.style.visibility = 'hidden'; });
            assert.equal(await page.locator('[data-site-update-action]').count(), 0);
            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await pollUntil(() => dialogs.length === 1, { label: 'single fallback confirmation' });
            assert.equal(dialogs[0].type, 'confirm');
            await forceServiceWorkerUpdate(page);
            assert.equal(dialogs.length, 1, 'Repeated discovery of the same waiting worker must not repeat the fallback.');
            assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting), true,
                'Dismissing the fallback leaves the waiting worker unapplied.');
            return { message: 'A hidden site entry allows one confirmation; dismissing it keeps the waiting update available.' };
        }
    }
];
