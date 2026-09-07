import assert from 'node:assert/strict';
import path from 'node:path';
import {
    gotoAndWait,
    readFirstMainLayout,
    recordFirstMainLayoutScript,
    waitForBreadcrumbSettled
} from './helpers.mjs';

const articlePath = '/zh/p/wsl-guide/?from=%2Ftags%2Ftooling%2Fdevtools%2Fwindows%2Fwsl';
const viewports = [390, 1024, 1440].map(width => ({ width, height: 900 }));
const nextPaint = page => page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
}));
const position = page => page.evaluate(() => ({ x: scrollX, y: scrollY }));

async function assertPosition(page, expected, label) {
    await page.waitForFunction(({ x, y }) => (
        Math.abs(scrollX - x) <= 1 && Math.abs(scrollY - y) <= 1
    ), expected, { timeout: 5000 });
    assert.deepEqual(await position(page), expected, label);
}

async function readCanvas(page) {
    return page.evaluate(() => {
        const offsetLeft = window.visualViewport?.offsetLeft || 0;
        const offsetTop = window.visualViewport?.offsetTop || 0;
        const rect = node => {
            const box = node.getBoundingClientRect();
            return {
                x: box.x - offsetLeft, y: box.y - offsetTop,
                width: box.width, height: box.height, right: box.right - offsetLeft
            };
        };
        const nav = document.querySelector('[data-root-navigation]');
        const main = document.querySelector('#main');
        const columns = [...document.querySelectorAll('.slot-breadcrumb [data-collection-column]')];
        const footer = document.querySelector('.slot-footer');
        const prose = document.querySelector('.prose');
        return {
            main: rect(main),
            mainDocumentX: main.getBoundingClientRect().x + scrollX,
            nav: rect(nav),
            columns: columns.map(rect),
            columnLinks: columns.map(column => column.querySelectorAll('.breadcrumb-column-link[href]').length),
            plainColumns: columns.every(column => (
                column.querySelector(':scope > .grid-list--single.collection-list--column')
                && !column.querySelector('[aria-expanded], [role="menu"], [hidden]')
            )),
            obsoleteControls: document.querySelectorAll('.breadcrumb-item-menu, .breadcrumb-menu-panel, .breadcrumb-menu-trigger').length,
            rootCount: nav.querySelectorAll('[data-root-href]').length,
            prose: prose ? rect(prose) : null,
            proseOverflow: prose ? prose.scrollWidth - prose.clientWidth : 0,
            footer: footer ? rect(footer) : null,
            footerInRail: !footer || footer.closest('.page-rail') !== null,
            viewport: window.visualViewport?.width || document.documentElement.clientWidth,
            layoutViewportWidth: innerWidth,
            visualViewport: window.visualViewport ? {
                width: visualViewport.width, offsetLeft: visualViewport.offsetLeft, scale: visualViewport.scale
            } : null,
            scrollWidth: document.scrollingElement.scrollWidth,
            canvasOffsetX: window.visualViewport?.pageLeft ?? scrollX,
            canvasOffsetY: window.visualViewport?.pageTop ?? scrollY,
            scrollX,
            scrollY
        };
    });
}

export const canvasScenarios = [
    {
        id: 'canvas-mobile-touch-navigation',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: viewports[0],
        isMobile: true,
        hasTouch: true,
        title: 'Mobile Viewport and Real Touch Drag Between Reading and Root Entries',
        async run({ page, context, baseUrl, artifactDir }) {
            await page.addInitScript(() => {
                window.__canvasTouchStarts = [];
                document.addEventListener('touchstart', event => {
                    window.__canvasTouchStarts.push({
                        trusted: event.isTrusted,
                        region: event.target.closest('[data-root-navigation]') ? 'root'
                            : event.target.closest('.prose') ? 'prose' : 'column'
                    });
                }, { passive: true });
            });
            const url = `${baseUrl}/zh/p/wsl-guide/?from=all`;
            await gotoAndWait(page, url);
            await waitForBreadcrumbSettled(page);
            await nextPaint(page);
            const initial = await readCanvas(page);
            assert.ok(initial.canvasOffsetX > 0 && initial.main.x >= 0 && initial.main.x <= 16,
                'A real mobile viewport must initially show the main content: ' + JSON.stringify(initial));
            assert.ok(await page.evaluate(() => navigator.maxTouchPoints > 0));
            const cdp = await context.newCDPSession(page);
            const canvasPosition = () => page.evaluate(() => ({
                x: window.visualViewport?.pageLeft ?? scrollX,
                y: window.visualViewport?.pageTop ?? scrollY
            }));
            const drags = [];
            const swipe = async (x, distance, distanceY = 0) => {
                const before = await canvasPosition();
                const point = (currentX, currentY = 180) => ({ x: currentX, y: currentY, id: 1 });
                await cdp.send('Input.dispatchTouchEvent', {
                    type: 'touchStart', touchPoints: [point(x)]
                });
                const steps = Math.ceil(Math.max(Math.abs(distance), Math.abs(distanceY)) / 20);
                for (let step = 1; step <= steps; step++) {
                    await page.waitForTimeout(40);
                    await cdp.send('Input.dispatchTouchEvent', {
                        type: 'touchMove', touchPoints: [point(x + distance * step / steps, 180 + distanceY * step / steps)]
                    });
                }
                // Release after a stationary moment so inertia does not obscure the final position.
                await page.waitForTimeout(120);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await nextPaint(page);
                const after = await canvasPosition();
                if (!distanceY) assert.equal(after.y, before.y, 'Horizontal touch input preserves the vertical reading position.');
                drags.push({ x, distance, distanceY, before, after });
            };
            for (let attempt = 0; attempt < 5 && (await canvasPosition()).x > 0; attempt++) {
                await swipe(50, 260);
            }
            const roots = await readCanvas(page);
            assert.equal(roots.canvasOffsetX, 0, 'Dragging right on prose and the adjacent list reveals the canvas start.');
            assert.ok(roots.nav.x >= 0 && roots.nav.right <= 390 && roots.rootCount === 10);
            await page.screenshot({ path: path.join(artifactDir, 'mobile-root-entries.png') });

            await swipe(210, -180);
            assert.ok((await canvasPosition()).x > 0, 'A leftward drag on a root row moves the document canvas.');
            for (let attempt = 0; attempt < 4 && (await readCanvas(page)).main.x > 16; attempt++) {
                await swipe(350, -300);
            }
            const final = await readCanvas(page);
            assert.ok(final.main.x >= 0 && final.main.x <= 16 && final.main.right <= final.viewport + 1,
                'Dragging left returns to the main content: ' + JSON.stringify(final));
            assert.equal(page.url(), url, 'Dragging a navigation link must not activate it.');
            const events = await page.evaluate(() => window.__canvasTouchStarts);
            assert.ok(events.some(event => event.trusted && event.region === 'prose'));
            assert.ok(events.some(event => event.trusted && event.region === 'root'));
            assert.ok(events.every(event => event.trusted));
            await page.screenshot({ path: path.join(artifactDir, 'mobile-reading-restored.png') });

            await swipe(210, 0, -120);
            await swipe(50, 180);
            const historyPosition = await canvasPosition();
            assert.ok(historyPosition.x > 0 && historyPosition.x < initial.canvasOffsetX && historyPosition.y > 0,
                'The history fixture preserves a user-chosen position on both axes.');
            await gotoAndWait(page, `${baseUrl}/zh/appearance/`);
            await page.goBack();
            await waitForBreadcrumbSettled(page);
            await page.waitForFunction(({ x, y }) => (
                Math.abs((window.visualViewport?.pageLeft ?? scrollX) - x) <= 1
                && Math.abs((window.visualViewport?.pageTop ?? scrollY) - y) <= 1
            ), historyPosition, { timeout: 5000 });
            const restoredHistoryPosition = await canvasPosition();
            return { initial, roots, final, drags, events, historyPosition, restoredHistoryPosition };
        }
    },
    {
        id: 'canvas-shared-layout-all-widths',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'One Horizontal Column Layout at 390, 1024 and 1440 Pixels',
        async run({ page, baseUrl, artifactDir }) {
            const results = [];
            for (const viewport of viewports) {
                await page.setViewportSize(viewport);
                for (const [name, target] of [
                    ['article', articlePath], ['collection', '/zh/all/'], ['system', '/zh/site/']
                ]) {
                    await gotoAndWait(page, baseUrl + target);
                    await waitForBreadcrumbSettled(page);
                    await nextPaint(page);
                    const state = await readCanvas(page);
                    const detail = JSON.stringify({ viewport, name, state });
                    assert.equal(state.rootCount, 10, detail);
                    assert.equal(state.obsoleteControls, 0, detail);
                    assert.equal(state.plainColumns, true, detail);
                    assert.ok(Math.abs(state.nav.width - 225) <= 1, detail);
                    assert.ok(state.columns.every(column => Math.abs(column.width - 225) <= 1), detail);
                    assert.ok(state.columnLinks.every(count => count > 0), detail);
                    assert.ok(state.columns.every(column => Math.abs(column.y - state.main.y) <= 1), detail);
                    assert.ok(Math.abs(state.nav.y - state.main.y) <= 1, detail);
                    assert.ok(state.main.x >= -1 && state.main.x < state.viewport, detail);
                    assert.ok(state.main.width <= state.viewport + 1, detail);
                    if (viewport.width === 390) {
                        assert.ok(state.scrollWidth > state.viewport && state.scrollX > 0, detail);
                        assert.ok(state.main.x <= 16, detail);
                    }
                    if (state.prose) {
                        assert.ok(state.prose.width <= state.viewport && state.prose.width >= Math.min(350, state.viewport - 32), detail);
                        assert.ok(state.proseOverflow <= 1, 'Wide code, tables and images must not expand the prose track: ' + detail);
                    }
                    assert.ok(state.footerInRail, detail);
                    if (state.footer) {
                        assert.ok(Math.abs(state.footer.x - state.nav.x) <= 1, detail);
                        assert.ok(state.footer.y >= state.nav.y + state.nav.height, detail);
                    }
                    if (name === 'article') {
                        assert.ok(state.columns.length >= 5, detail);
                        await page.screenshot({ path: path.join(artifactDir, `article-${viewport.width}.png`) });
                    }
                    await page.evaluate(() => scrollTo({ left: 0, top: 0, behavior: 'instant' }));
                    await nextPaint(page);
                    const rootBounds = await page.locator('[data-root-navigation]').boundingBox();
                    assert.ok(rootBounds.x >= 0 && rootBounds.x + rootBounds.width <= viewport.width,
                        'Scrolling left must reveal all ten navigation entries.');
                    results.push({ viewport, name, ...state });
                }
            }
            const articleCounts = results.filter(result => result.name === 'article').map(result => result.columns.length);
            assert.ok(articleCounts.every(count => count === articleCounts[0]), 'The same content exposes the same columns at every width.');
            return { cases: results };
        }
    },
    {
        id: 'canvas-history-scroll-restoration',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: viewports[0],
        title: 'Native Back, Forward and Reload Preserve Both Scroll Axes',
        async run({ page, baseUrl }) {
            await gotoAndWait(page, baseUrl + articlePath);
            await waitForBreadcrumbSettled(page);
            await page.evaluate(() => scrollTo({ left: 241, top: 570, behavior: 'instant' }));
            await nextPaint(page);
            const first = await position(page);
            assert.ok(first.x > 0 && first.y > 0, 'The history fixture must exercise both axes.');
            await gotoAndWait(page, `${baseUrl}/zh/p/xvenv/?from=all`);
            await waitForBreadcrumbSettled(page);
            await page.evaluate(() => scrollTo({ left: 37, top: 310, behavior: 'instant' }));
            await nextPaint(page);
            const second = await position(page);
            await page.goBack();
            await waitForBreadcrumbSettled(page);
            await assertPosition(page, first, 'Back must restore the chosen view, including the directory column.');
            await page.goForward();
            await waitForBreadcrumbSettled(page);
            await assertPosition(page, second, 'Forward must restore the second reading position.');
            await page.reload();
            await waitForBreadcrumbSettled(page);
            await assertPosition(page, second, 'Reload must not run the new-navigation positioning again.');

            const sort = page.locator('.slot-breadcrumb [data-collection-sort-toggle="true"]').first();
            await sort.scrollIntoViewIfNeeded();
            await sort.focus();
            await nextPaint(page);
            const beforeSort = await position(page);
            const beforeUrl = page.url();
            await page.keyboard.press('Enter');
            await page.waitForURL(url => url.href !== beforeUrl);
            await waitForBreadcrumbSettled(page);
            await assertPosition(page, beforeSort, 'Sorting a visible column must not jump back to main.');
            return { first, second, beforeSort };
        }
    },
    {
        id: 'canvas-anchors-and-keyboard',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: viewports[0],
        title: 'Native Anchors, Skip Link and Column Keyboard Order',
        async run({ page, baseUrl }) {
            await gotoAndWait(page, baseUrl + articlePath);
            const headingId = await page.locator('.prose :is(h2, h3)[id]').first().getAttribute('id');
            assert.ok(headingId, 'The real article must expose a native heading anchor.');
            await gotoAndWait(page, baseUrl + articlePath + '#' + encodeURIComponent(headingId));
            await nextPaint(page);
            const heading = await page.locator('[id]').evaluateAll((nodes, id) => {
                const box = nodes.find(node => node.id === id).getBoundingClientRect();
                return { x: box.x, y: box.y, width: box.width };
            }, headingId);
            assert.ok(heading.x >= -1 && heading.x < 390 && heading.y >= -1 && heading.y < 900,
                'A direct fragment keeps the native target visible: ' + JSON.stringify(heading));

            await page.locator('.skip').focus();
            await page.keyboard.press('Enter');
            await page.waitForURL(url => url.hash === '#main');
            await nextPaint(page);
            const main = await page.locator('#main').boundingBox();
            assert.ok(main.x >= -1 && main.x < 390 && main.y >= -1 && main.y < 900,
                'Skip to content must bring the actual main column into view.');

            // Site pages intentionally include the footer; ordinary articles do not.
            await gotoAndWait(page, `${baseUrl}/zh/site/`);
            const order = await page.evaluate(() => {
                const rail = document.querySelector('.page-rail');
                const footer = rail.querySelector('.slot-footer');
                const nextColumn = document.querySelector('.slot-breadcrumb') || document.querySelector('#main');
                const footerLinks = [...footer.querySelectorAll('a[href], button:not([disabled])')];
                footerLinks.at(-1).focus();
                return {
                    count: footerLinks.length,
                    before: !!(footer.compareDocumentPosition(nextColumn) & Node.DOCUMENT_POSITION_FOLLOWING),
                    focused: footer.contains(document.activeElement)
                };
            });
            assert.ok(order.count && order.before && order.focused, 'Footer stays in the first column in both DOM and visual order.');
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => !!document.activeElement.closest('.slot-breadcrumb, #main')), true,
                'Tab after the final footer link proceeds to the next visible column.');
            return { headingId, heading, order };
        }
    },
    {
        id: 'canvas-first-frame-slow-runtime',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Source Columns Reserve Stable Geometry Before Slow Runtime Loads',
        async run({ page, baseUrl }) {
            await page.addInitScript(recordFirstMainLayoutScript());
            await page.route('**/js/*.js', async route => {
                await new Promise(resolve => setTimeout(resolve, 650));
                await route.continue();
            });
            const cases = [];
            for (const viewport of [viewports[0], viewports[2]]) {
                await page.setViewportSize(viewport);
                await gotoAndWait(page, baseUrl + articlePath);
                const first = await readFirstMainLayout(page);
                await waitForBreadcrumbSettled(page);
                await nextPaint(page);
                const final = await readCanvas(page);
                assert.ok(first.previewPending && first.runtimePending,
                    'The first parsed main must be captured before the source runtime settles.');
                assert.equal(first.breadcrumbColumnCount, final.columns.length);
                assert.ok(Math.abs(first.mainInlineStart - final.mainDocumentX) <= 1,
                    'Source resolution must not move the main track even when runtime scripts arrive late.');
                assert.ok(final.main.x >= -1 && final.main.right <= final.viewport + 1,
                    'The initial reading position must remain correct after source rendering.');
                cases.push({ viewport, first, final });
            }
            return { cases };
        }
    }
];
