import assert from 'node:assert/strict';
import path from 'node:path';
import { forceServiceWorkerUpdate, gotoAndWait, pollUntil, waitForServiceWorkerActive, waitForUpdateReady } from './helpers.mjs';

const updatesEntry = '[data-root-navigation] a[data-root-href="/zh/updates/"]';

function requireUpgradePair(upgradePair) {
    assert.ok(upgradePair?.fromDir && upgradePair?.toDir, 'Two builds containing the flattened navigation are required.');
}

export const updatesNavigationScenarios = [
    ...[
        { name: 'home', href: '/zh/' },
        { name: 'collection', href: '/zh/all/?sort=name-asc' }
    ].map(({ name, href }) => ({
        id: `sw-update-entry-${name}`,
        kind: 'upgrade',
        title: `Updates List Opens Check Controls (${name})`,
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, server, upgradePair, dialogs, artifactDir }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, baseUrl + href);
            await waitForServiceWorkerActive(page);
            assert.equal(await page.locator(updatesEntry).count(), 1);
            assert.equal(await page.locator('[data-site-update-link]').count(), 0, 'The root site link has no special update role.');

            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await forceServiceWorkerUpdate(page);
            assert.equal(dialogs.length, 0, 'Discovering an update, including repeated checks, must not prompt.');
            assert.equal(page.url(), baseUrl + href, 'An available update does not navigate or reload the reading page.');
            assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting), true);
            await page.screenshot({ path: path.join(artifactDir, 'site-entry-ready.png') });

            await page.locator(updatesEntry).click();
            await page.waitForURL(url => url.pathname === '/zh/updates/');
            assert.equal(await page.locator('[data-site-update-panel]').count(), 0);
            await page.locator('.slot-main .collection-item-link[href*="/updates/check/"]').click();
            await page.waitForURL(url => url.pathname === '/zh/updates/check/');
            await page.waitForSelector('[data-site-update-panel][data-site-update-state="ready"]');
            assert.equal(new URL(page.url()).searchParams.has('return'), false);
            assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting), true,
                'Root navigation must leave the worker waiting for the PWA page action.');
            assert.equal(await page.locator(`${updatesEntry}.is-current`).count(), 1);
            assert.equal(await page.locator('.slot-breadcrumb .collection-item-link').count(), 2);

            const reload = page.waitForEvent('load');
            await page.locator('[data-site-update-action="check"]').click();
            await reload;
            await waitForServiceWorkerActive(page);
            await pollUntil(() => page.evaluate(async () => !(await navigator.serviceWorker.getRegistration('/'))?.waiting
                && document.querySelector('[data-site-update-panel]')?.dataset.siteUpdateState !== 'ready'),
                { label: 'Updated page has no waiting worker' });
            assert.equal(dialogs.length, 0, 'The PWA page applies updates in place without a confirmation.');
            return { message: 'Ordinary pages remain quiet; the updates entry opens its controls, whose action applies and reloads.' };
        }
    })),
    ...['zh-hk', 'zh-mo'].map(lang => ({
        id: `sw-update-entry-${lang}`,
        kind: 'upgrade',
        title: `Check Updates Uses Traditional Chinese for ${lang}`,
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, server, upgradePair, dialogs }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/updates/check/`);
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
            await page.waitForFunction(value => document.querySelector('[data-site-update-status]')?.textContent.includes(value), expected);
            assert.equal(dialogs.length, 0);
            return { message: `${lang} resolves to the Traditional Chinese site update notice.`, details: { expected } };
        }
    })),
    {
        id: 'sw-update-hidden-control-stays-quiet',
        kind: 'upgrade',
        title: 'Hidden PWA Control Keeps the Update Waiting Without a Dialog',
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, server, upgradePair, dialogs }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/updates/check/`);
            await waitForServiceWorkerActive(page);
            await page.locator('[data-site-update-action]').evaluate(node => { node.style.visibility = 'hidden'; });
            assert.equal(await page.locator('[data-site-update-link]').count(), 0);
            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await page.waitForSelector('[data-site-update-panel][data-site-update-state="ready"]');
            await forceServiceWorkerUpdate(page);
            assert.equal(dialogs.length, 0, 'A hidden control must not enable a fallback confirmation.');
            assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting), true,
                'The update waits for an explicit page action.');
            return { message: 'A hidden PWA action leaves the update available without prompting or applying it.' };
        }
    }
];
