import assert from 'node:assert/strict';
import { gotoAndWait } from './helpers.mjs';

export const presentationContractScenarios = [
    {
        id: 'collection-behavior-without-style-classes',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Sorting and Entry Navigation Are Independent of Style Classes',
        async run({ page, baseUrl }) {
            await gotoAndWait(page, baseUrl + '/zh/all/?sort=name-asc');
            const readRows = () => page.evaluate(() => {
                const cells = [...document.querySelector('[data-sortable]').children]
                    .filter(cell => cell.hasAttribute('data-collection-cell') && !cell.hasAttribute('data-collection-header'));
                const rows = [];
                for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4).map(cell => cell.textContent.trim()));
                return rows;
            });
            const before = await readRows();
            assert(before.length > 1);
            const dataCell = page.locator('[data-sortable] [data-collection-cell="date"]:not([data-collection-header])').first();
            assert.equal(await dataCell.evaluate(cell => {
                const rect = cell.getBoundingClientRect();
                return cell.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
            }), true, 'Date/value cells remain pointer targets for text selection and native title tooltips.');
            await page.evaluate(() => {
                const grid = document.querySelector('[data-sortable]');
                for (const node of [grid, ...grid.querySelectorAll('[class]')]) node.removeAttribute('class');
                window.sortWithoutCss = true;
            });
            await page.locator('[data-sortable] [data-sort-field="name"]').click();
            await page.waitForURL(url => url.searchParams.get('sort') === 'name-desc');
            assert.equal(await page.evaluate(() => window.sortWithoutCss), true, 'Sorting remains in place.');
            assert.deepEqual(await readRows(), before.reverse(), 'Every row keeps all its cells after sorting.');
            const entry = page.locator('[data-sortable] [data-collection-entry]').first();
            const target = new URL(await entry.getAttribute('href'), baseUrl);
            assert.equal(target.searchParams.get('from'), 'all');
            assert.equal(target.searchParams.get('sort'), 'name-desc');
            await entry.click();
            await page.waitForURL(target.href);
            await page.waitForSelector('[data-root-href="/zh/all/"].is-current');
            return { message: 'Style classes can change without breaking row sorting or entry context.' };
        }
    },
    {
        id: 'prose-scope-and-hover-contract',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Prose Links, Lists and Quotes Keep Their Own Layout',
        async run({ page, baseUrl }) {
            await gotoAndWait(page, baseUrl + '/zh/about/');
            await page.evaluate(() => {
                const prose = document.querySelector('.prose');
                prose.innerHTML = '<p><a id="test-link" href="#probe">Readable link text</a></p><ul><li>Ordinary words stay together in a paragraph.</li></ul><p id="test-long"><a href="#probe">https://example.invalid/' + 'longsegment'.repeat(25) + '</a></p><blockquote><p>Last quote keeps its top spacing.</p></blockquote>';
                prose.style.inlineSize = '230px';
            });
            for (const theme of ['light', 'dark']) {
                await page.evaluate(mode => document.documentElement.dataset.theme = mode, theme);
                await page.locator('#test-link').hover();
                const style = await page.evaluate(() => {
                    const prose = document.querySelector('.prose');
                    const link = getComputedStyle(document.querySelector('#test-link'));
                    const listItem = getComputedStyle(prose.querySelector('li'));
                    const quote = getComputedStyle(prose.querySelector('blockquote'));
                    const longLink = document.querySelector('#test-long');
                    return { opacity: link.opacity, wordBreak: listItem.wordBreak, display: listItem.display,
                        quoteTop: parseFloat(quote.marginBlockStart), quoteBottom: parseFloat(quote.marginBlockEnd),
                        longLinkFits: longLink.scrollWidth <= longLink.clientWidth + 1 };
                });
                assert.equal(style.opacity, '1');
                assert.equal(style.wordBreak, 'normal');
                assert.equal(style.display, 'list-item');
                assert(style.quoteTop > 0);
                assert.equal(style.quoteBottom, 0);
                assert(style.longLinkFits);
            }
            return { message: 'Light/dark links keep contrast, long URLs wrap, list words and final quote spacing remain intact.' };
        }
    },
    {
        id: 'settings-script-loading-boundary',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Settings Controllers Load Only with Their Pages',
        async run({ page, baseUrl }) {
            const cases = [
                ['/zh/', []], ['/zh/all/', []], ['/zh/about/', []], ['/zh/updates/', []],
                ['/zh/language/', ['/js/preferences/language-page.']],
                ['/zh/appearance/', ['/js/back-links.']], ['/zh/my/', ['/js/back-links.']],
                ['/zh/updates/check/', ['/js/updates/page.']]
            ];
            const controllers = ['/js/preferences/language-page.', '/js/back-links.', '/js/updates/page.'];
            for (const [route, expected] of cases) {
                await gotoAndWait(page, baseUrl + route);
                const scripts = await page.evaluate(() => [...document.scripts].filter(script => script.src).map(script => new URL(script.src).pathname));
                assert.deepEqual(controllers.filter(prefix => scripts.some(src => src.startsWith(prefix))).sort(), [...expected].sort(), route);
                assert.equal(await page.locator('body[data-language-context]').count(), 0, 'Translation links replace duplicate per-page language JSON.');
            }
            const commonCode = await page.evaluate(async () => {
                const scripts = [...document.scripts].filter(script => /\/js\/(main\.|sw-manager\.enable)/.test(script.src));
                return Promise.all(scripts.map(script => fetch(script.src).then(response => response.text())));
            });
            assert(commonCode.length >= 2);
            for (const source of commonCode) {
                assert(!source.includes('data-language-choice'), 'Language picker behavior stays out of global bundles.');
                assert(!source.includes('data-site-update-panel'), 'Update presentation stays out of the global SW engine.');
                assert(!source.includes('data-page-action'), 'Back controls stay page-local.');
            }
            return { message: 'Eight real pages have the expected controller boundaries.' };
        }
    }
];
