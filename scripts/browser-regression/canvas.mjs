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
            columnLinks: columns.map(column => column.querySelectorAll('[data-collection-entry][href]').length),
            plainColumns: columns.every(column => (
                column.querySelector(':scope > .collection-list.collection-list--path-column')
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
    ...[false, true].map(mobile => ({
        id: mobile ? 'canvas-mobile-append-column' : 'canvas-append-column',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 390, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
        timeoutMs: 60000,
        title: 'Opening a Product Appends a Column Without Moving Existing Names',
        async run({ page, context, baseUrl, artifactDir }) {
            const cases = [];
            const cdp = mobile ? await context.newCDPSession(page) : null;
            await page.addInitScript(() => {
                const observer = new MutationObserver(() => {
                    if (!document.getElementById('main')) return;
                    observer.disconnect();
                    requestAnimationFrame(() => {
                        window.__firstCanvasX = window.visualViewport?.pageLeft ?? scrollX;
                    });
                });
                observer.observe(document, { childList: true, subtree: true });
            });
            await page.route('**/js/**/*.js', async route => {
                await new Promise(resolve => setTimeout(resolve, 500));
                await route.continue();
            });
            for (const width of mobile ? [390] : [390, 1024, 1440]) {
                if (!mobile) await page.setViewportSize({ width, height: 900 });
                for (const source of ['products/free', 'all-products']) {
                    await gotoAndWait(page, `${baseUrl}/zh/${source}/`);
                    await waitForBreadcrumbSettled(page);
                    assert.equal((await readCanvas(page)).canvasOffsetX, 0);
                    if (source === 'products') {
                        if (mobile) {
                            const sortPoint = await page.locator('main [data-sort-field="name"]').evaluate(el => {
                                const box = el.getBoundingClientRect();
                                return { x: box.x - visualViewport.offsetLeft + 10, y: box.y + 5 };
                            });
                            await page.touchscreen.tap(sortPoint.x, sortPoint.y);
                        } else {
                            await page.locator('main [data-sort-field="price"]').click();
                        }
                        await page.waitForURL(url => url.searchParams.get('sort') === (mobile ? 'name-desc' : 'price-desc'));
                        assert.equal(await page.evaluate(() => sessionStorage.getItem('banyan:canvas-navigation')), null,
                            'In-place sorting does not create a pending navigation.');
                    }
                    const link = page.locator('main .collection-item-link[href*="/p/xvenv/"]');
                    if (width === 390) {
                        if (mobile) {
                            await cdp.send('Input.dispatchTouchEvent', {
                                type: 'touchStart', touchPoints: [{ x: 350, y: 180, id: 1 }]
                            });
                            const distance = source === 'products' ? 160 : 320;
                            for (let offset = 20; offset <= distance; offset += 20) {
                                await page.waitForTimeout(40);
                                await cdp.send('Input.dispatchTouchEvent', {
                                    type: 'touchMove', touchPoints: [{ x: 350 - offset, y: 180, id: 1 }]
                                });
                            }
                            await page.waitForTimeout(120);
                            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                        } else {
                            await page.evaluate(x => scrollTo(x, 0), source === 'products' ? 150 : 310);
                        }
                    }
                    await nextPaint(page);
                    const before = await readCanvas(page);
                    if (width === 390) assert.ok(before.canvasOffsetX > 0, 'Exercise a manually panned source.');
                    const name = await link.evaluate(el => {
                        const box = el.getBoundingClientRect();
                        return { x: box.x - (visualViewport?.offsetLeft || 0), y: box.y, width: box.width };
                    });
                    assert.ok(Math.abs(name.width - before.nav.width) <= 1, 'Product names share the navigation column width.');
                    await page.screenshot({ path: path.join(artifactDir, `${source.replaceAll('/', '-')}-${width}-before.png`) });
                    // Use a visible point, avoiding Playwright's automatic centering of links.
                    const point = { x: name.x + 40, y: name.y + 10 };
                    assert.ok(point.x > 0 && point.x < width);
                    if (mobile) await page.touchscreen.tap(point.x, point.y);
                    else await page.mouse.click(point.x, point.y);
                    await page.waitForURL(url => url.pathname === '/zh/p/xvenv/');
                    await waitForBreadcrumbSettled(page);
                    await nextPaint(page);
                    const after = await readCanvas(page);
                    const firstX = await page.evaluate(() => window.__firstCanvasX);
                    assert.ok(Math.abs(firstX - before.canvasOffsetX) <= 1, 'The inherited position is already correct at first paint, before slow runtime scripts.');
                    if (source === 'products') assert.equal(new URL(page.url()).searchParams.get('sort'), mobile ? 'name-desc' : 'price-desc');
                    assert.ok(Math.abs(after.canvasOffsetX - before.canvasOffsetX) <= 1, 'Opening a product retains the source canvas position.');
                    assert.equal(after.canvasOffsetY, 0, 'The new article starts at its top.');
                    assert.ok(Math.abs(after.nav.x - before.nav.x) <= 1, 'Root entries stay in place.');
                    before.columns.forEach((column, i) => assert.ok(Math.abs(column.x - after.columns[i].x) <= 1));
                    const selected = await page.locator('.slot-breadcrumb .collection-item-link[aria-current="page"][href*="/p/xvenv/"]').evaluate(el => {
                        const box = el.getBoundingClientRect();
                        return { x: box.x - (visualViewport?.offsetLeft || 0), width: box.width };
                    });
                    assert.ok(Math.abs(selected.x - name.x) <= 1 && Math.abs(selected.width - name.width) <= 1,
                        'The clicked name remains in the same position and width in the new sibling column.');
                    assert.ok(after.mainDocumentX > before.mainDocumentX, 'The new main column extends the canvas to the right.');
                    assert.equal(await page.evaluate(() => sessionStorage.getItem('banyan:canvas-navigation')), null, 'The one-navigation record is consumed.');
                    await page.screenshot({ path: path.join(artifactDir, `${source.replaceAll('/', '-')}-${width}-after.png`) });
                    await page.reload();
                    await waitForBreadcrumbSettled(page);
                    assert.ok(Math.abs((await readCanvas(page)).canvasOffsetX - after.canvasOffsetX) <= 1, 'Reload preserves the inherited position.');
                    await page.goBack();
                    await waitForBreadcrumbSettled(page);
                    assert.ok(Math.abs((await readCanvas(page)).canvasOffsetX - before.canvasOffsetX) <= 1, 'Back preserves the original source position.');
                    await page.goForward();
                    await waitForBreadcrumbSettled(page);
                    assert.ok(Math.abs((await readCanvas(page)).canvasOffsetX - after.canvasOffsetX) <= 1, 'Forward restores the product position.');
                    cases.push({ width, source, before, after, name, selected });
                }
            }
            return { cases };
        }
    })),
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
            assert.equal(initial.canvasOffsetX, 0, 'A direct visit starts at the canvas origin without revealing main automatically.');
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
            assert.ok(roots.nav.x >= 0 && roots.nav.right <= 390 && roots.rootCount === 14);
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
            await swipe(50, 120);
            await swipe(300, -120);
            const events = await page.evaluate(() => window.__canvasTouchStarts);
            assert.ok(events.some(event => event.trusted && event.region === 'prose'));
            assert.ok(events.some(event => event.trusted && event.region === 'root'));
            assert.ok(events.every(event => event.trusted));
            await page.screenshot({ path: path.join(artifactDir, 'mobile-reading-restored.png') });

            await swipe(210, 0, -120);
            await swipe(50, 180);
            const historyPosition = await canvasPosition();
            assert.ok(historyPosition.x > 0 && historyPosition.x < final.canvasOffsetX && historyPosition.y > 0,
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
                    ['article', articlePath], ['collection', '/zh/all/'], ['system', '/zh/updates/']
                ]) {
                    await gotoAndWait(page, baseUrl + target);
                    await waitForBreadcrumbSettled(page);
                    await nextPaint(page);
                    const state = await readCanvas(page);
                    const detail = JSON.stringify({ viewport, name, state });
                    assert.equal(state.rootCount, 14, detail);
                    assert.equal(state.obsoleteControls, 0, detail);
                    assert.equal(state.plainColumns, true, detail);
                    assert.ok(Math.abs(state.nav.width - 225) <= 1, detail);
                    assert.ok(state.columns.every(column => Math.abs(column.width - 225) <= 1), detail);
                    assert.ok(state.columnLinks.every(count => count > 0), detail);
                    assert.ok(state.columns.every(column => Math.abs(column.y - state.main.y) <= 1), detail);
                    assert.ok(Math.abs(state.nav.y - state.main.y) <= 1, detail);
                    assert.equal(state.canvasOffsetX, 0, 'Direct visits preserve the canvas origin: ' + detail);
                    assert.ok(state.main.width <= state.viewport + 1, detail);
                    if (viewport.width === 390) {
                        assert.ok(state.scrollWidth > state.viewport, detail);
                        assert.ok(state.nav.x >= 0 && state.nav.right <= state.viewport, detail);
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
                        'Scrolling left must reveal the complete visible navigation list.');
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

            await page.locator('.skip-link').focus();
            await page.keyboard.press('Enter');
            await page.waitForURL(url => url.hash === '#main');
            await nextPaint(page);
            const main = await page.locator('#main').boundingBox();
            assert.ok(main.x >= -1 && main.x < 390 && main.y >= -1 && main.y < 900,
                'Skip to content must bring the actual main column into view.');

            // Keyboard traversal leaves the complete root list for the next column.
            await gotoAndWait(page, `${baseUrl}/zh/updates/`);
            const order = await page.evaluate(() => {
                const rail = document.querySelector('.page-rail');
                const nav = rail.querySelector('[data-root-navigation]');
                const nextColumn = document.querySelector('.slot-breadcrumb') || document.querySelector('#main');
                const links = [...nav.querySelectorAll('a[href]')];
                links.at(-1).focus();
                return {
                    count: links.length,
                    before: !!(nav.compareDocumentPosition(nextColumn) & Node.DOCUMENT_POSITION_FOLLOWING),
                    focused: nav.contains(document.activeElement)
                };
            });
            assert.ok(order.count && order.before && order.focused, 'Root navigation stays in the first column in both DOM and visual order.');
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => !!document.activeElement.closest('.slot-breadcrumb, #main')), true,
                'Tab after the final root link proceeds to the next visible column.');
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
            await page.route('**/js/**/*.js', async route => {
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
                assert.ok(first.entryPending,
                    'The first parsed main must be captured before the source runtime settles.');
                assert.equal(first.breadcrumbColumnCount, final.columns.length);
                assert.ok(Math.abs(first.mainInlineStart - final.mainDocumentX) <= 1,
                    'Source resolution must not move the main track even when runtime scripts arrive late.');
                assert.equal(final.canvasOffsetX, 0, 'Slow source rendering must not reveal main or change the canvas origin.');
                cases.push({ viewport, first, final });
            }
            return { cases };
        }
    }
];
