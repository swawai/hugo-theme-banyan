// Exercise the real site with a temporary content overlay; never edit its content.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { resolveHugoCommand } from '../build/hugo-command.mjs';
import { createHugoEnv } from '../build/hugo-env.mjs';
import { createStaticSiteServer } from '../browser-regression/server.mjs';
import { gotoAndWait, waitForBreadcrumbSettled, suppressLanguageSuggestDialogScript } from '../browser-regression/helpers.mjs';

const root = process.cwd();
const work = fs.mkdtempSync(path.join(root, 'temp_workspace', 'collection-contract-'));
const rel = p => path.relative(root, p).replaceAll('\\', '/');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const overlay = path.join(work, 'content');
const langs = ['', '.zh', '.zh-tw'];
const prefixes = ['', '/zh', '/zh-tw'];
const imageBytes = fs.readFileSync('content/icp/0.webp');
const imageHash = createHash('sha256').update(imageBytes).digest('hex');
const ownImage = {image: `/media/content/d/contract-no-offer/badge.${imageHash}.webp`};
const inheritedImage = {image: `/media/content/d/contract-image/badge.${imageHash}.webp`, monochrome: true};
const logoBytes = fs.readFileSync('assets/site/pwa/favicon.svg');
const logoHash = createHash('sha256').update(logoBytes).digest('hex');
const assetImage = {image: `/site/pwa/favicon.${logoHash}.svg`};
const monochromeAsset = {...assetImage, monochrome: true};
const cases = [
    ['priced', 'icon: appearance-dark\nlastmod: 2026-08-01\ntags: [contract-dates]\nproducts: [free, paid, "Special Tools", "$5~$50", contract-dates, contract-name]\noffer: {amount: 25, currency: "$", value: "Paid and free are opaque labels"}'],
    ['missing', 'lastmod: 2026-08-02\ntags: [contract-dates/child]\nproducts: [free, paid, "Special Tools", contract-dates, contract-name]\noffer: {value: "Value without a price"}'],
    ['zero', 'icon: {text: "<b>EN</b>"}\nproducts: [free]\noffer: {amount: 0, currency: "$"}'],
    ['no-offer', 'icon: {image: "badge.webp"}\nproducts: [free]'],
    ['unclassified', 'icon: {image: "site/pwa/favicon.svg", monochrome: true}\noffer: {amount: 99, currency: "$", value: "Not a product"}'],
    ['empty', 'products: []'],
    ['blank', 'products: [""]']
];
for (const lang of langs) {
    for (const [name, field] of [['enabled', 'root_nav: true'], ['disabled', 'root_nav: false'], ['omitted', ''], ['string', 'root_nav: "true"']]) {
        write(path.join(overlay, `contract-nav-${name}/index${lang}.md`), `---\ntitle: Navigation ${name}\nslug: contract-nav-${name}\nlayout: page-article\nbuild: {list: local}\n${field}\n---\nDirectly accessible information page.\n`);
    }
    write(path.join(overlay, `products/contract-empty/_index${lang}.md`), '---\ntitle: Contract empty category\nicon: rss\n---\n');
    write(path.join(overlay, `products/contract-dates/_index${lang}.md`), '---\ntitle: Contract dates\nlist: directory\n---\n');
    write(path.join(overlay, `products/contract-name/_index${lang}.md`), '---\ntitle: Names only\nlist: name\n---\n');
    write(path.join(overlay, `contract-name-all/index${lang}.md`), '---\ntitle: All names\nslug: contract-name-all\nroot_nav: true\nlayout: page-collection\nlist: name\naggregate: /d\nslots: {breadcrumb: true}\n---\n');
    for (const term of ['contract-dates', 'contract-dates/child']) {
        write(path.join(overlay, `tags/${term}/_index${lang}.md`), `---\ntitle: ${term}\n---\n`);
    }
    write(path.join(overlay, `tags/untagged/_index${lang}.md`), '---\ntitle: Untagged\n---\n');
    const paid = fs.readFileSync(`content/products/paid/_index${lang}.md`, 'utf8');
    write(path.join(overlay, `products/paid/_index${lang}.md`), paid.replace('---', '---\nlist_icon_file: appearance-light'));
    for (const [name, fields] of cases) write(path.join(overlay, `d/contract-${name}/index${lang}.md`),
        `---\ntitle: "Contract ${name}"\nslug: contract-${name}\ndate: 2026-01-01\n${fields}\n---\nArticle body stays an article.\n`);
    write(path.join(overlay, `d/contract-override/_index${lang}.md`), '---\ntitle: Override\nroot_nav: true\nicon: info\nlist: all\nlist_icon_folder: rss\nlist_icon_file: appearance-auto\n---\n');
    write(path.join(overlay, `d/contract-override/child/_index${lang}.md`), '---\ntitle: Child inherits override\nlist_icon_file: theme\n---\n');
    write(path.join(overlay, `d/contract-override/child/item${lang}.md`), '---\ntitle: Child item\nslug: contract-child\n---\nChild.\n');
    write(path.join(overlay, `d/contract-override/direct${lang}.md`), '---\ntitle: Direct item\nslug: contract-direct\nlastmod: 2026-08-03\n---\nDirect.\n');
    write(path.join(overlay, `d/contract-override/child/nested/_index${lang}.md`), '---\ntitle: Nested\nlist_icon_file: ""\n---\n');
    write(path.join(overlay, `d/contract-override/child/nested/item${lang}.md`), '---\ntitle: Nested item\nslug: contract-nested\n---\nNested.\n');
    write(path.join(overlay, `d/contract-text/_index${lang}.md`), '---\ntitle: Text icons\nicon: {text: "©"}\nlist_icon_folder: {text: "Dir"}\nlist_icon_file: {text: "EN"}\n---\n');
    write(path.join(overlay, `d/contract-text/child/_index${lang}.md`), '---\ntitle: Child text icons\nlist_icon_file: product\n---\n');
    write(path.join(overlay, `d/contract-text/item${lang}.md`), '---\ntitle: Text item\nslug: contract-text\n---\nText.\n');
    write(path.join(overlay, `d/contract-text/child/item${lang}.md`), '---\ntitle: Text child\nslug: contract-text-child\n---\nText child.\n');
    write(path.join(overlay, `d/contract-image/_index${lang}.md`), '---\ntitle: Image icons\nlist_icon_file: {image: "badge.webp", monochrome: true}\nlist_icon_folder: {image: "site/pwa/favicon.svg", monochrome: false}\n---\n');
    write(path.join(overlay, `d/contract-image/child/_index${lang}.md`), '---\ntitle: Inherited image\n---\n');
    write(path.join(overlay, `d/contract-image/child/item${lang}.md`), '---\ntitle: Inherited image article\nslug: contract-image-child\n---\nImage.\n');
}
write(path.join(overlay, 'd/contract-no-offer/badge.webp'), imageBytes);
write(path.join(overlay, 'd/contract-image/badge.webp'), imageBytes);
const config = path.join(work, 'overlay.toml');
write(config, `[[module.mounts]]\nsource = "${rel(overlay)}"\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`);
const hugo = resolveHugoCommand({ cwd: root });
function build(view) {
    for (const lang of langs) {
        const source = fs.readFileSync(`themes/banyan/content/d/_index${lang}.md`, 'utf8');
        write(path.join(overlay, `d/_index${lang}.md`), source.replace('list: directory', `list: ${view}\nroot_nav: true\nicon: info`));
    }
    const output = path.join(work, view);
    const result = spawnSync(hugo, ['--config', `hugo.toml,${rel(config)}`, '--minify', '--destination', rel(output)],
        { cwd: root, env: createHugoEnv({ cwd: root }), encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const patch = spawnSync(process.execPath, ['themes/banyan/scripts/build/patch-csp.mjs', rel(output)],
        { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(patch.status, 0, patch.stdout + patch.stderr);
    return output;
}
function payload(output, lang, logical) {
    const versions = fs.readdirSync(path.join(output, '__fragments'));
    assert.equal(versions.length, 1);
    const data = JSON.parse(fs.readFileSync(path.join(output, '__fragments', versions[0], lang, logical, '_items.json'), 'utf8'));
    const rows = [];
    for (let offset = 0; offset < data.rv.length; offset += data.f.length) {
        rows.push({ ...data.c, ...Object.fromEntries(data.f.map((key, i) => [key, data.rv[offset + i]])) });
    }
    return { ...data, rows };
}
const builds = {};
const directoryMembers = new Map();
for (const view of ['directory', 'all', 'products', 'name']) {
    const output = builds[view] = build(view);
    for (const [index, lang] of ['en', 'zh', 'zh-tw'].entries()) {
        const current = payload(output, lang, 'd');
        const hrefs = current.rows.map(row => row.href).sort();
        if (view === 'directory') directoryMembers.set(lang, hrefs);
        else assert.deepEqual(hrefs, directoryMembers.get(lang), `${view} must not filter native directory members`);
        assert.equal(current.sv, view === 'directory' ? 'section' : view);
        assert.equal(payload(output, lang, 'd/wsl').sv, current.sv, 'undeclared section inherits');
        assert.equal(payload(output, lang, 'd/contract-override').sv, 'all');
        assert.equal(payload(output, lang, 'd/contract-override/child').sv, 'all', 'nearest declaration wins');
        const assertUpdated = (list, href, text, key) => {
            const row = payload(output, lang, list).rows.find(row => row.href === `${prefixes[index]}${href}`);
            assert(row, `${list} contains ${href}`);
            assert.equal(row.date_text, text, `${list}: display uses Lastmod`);
            assert.equal(row.sort_date, key, `${list}: sorting uses the displayed time`);
        };
        for (const list of ['all', 'products/contract-dates', ...(['products', 'name'].includes(view) ? [] : ['d'])]) {
            assertUpdated(list, '/p/contract-priced/', '2026-08-01', '20260801000000');
            assertUpdated(list, '/p/contract-missing/', '2026-08-02', '20260802000000');
            const dated = payload(output, lang, list).rows.filter(row => /\/p\/contract-(priced|missing)\//.test(row.href));
            assert.deepEqual(dated.map(row => row.date_text), ['2026-08-02', '2026-08-01'], 'default order uses Lastmod, not publication date or name');
        }
        assertUpdated('all', '/p/contract-no-offer/', '2026-01-01', '20260101000000'); // Hugo default falls back to date.
        assertUpdated('all', '/p/contract-direct/', '2026-08-03', '20260803000000'); // No publication date.
        assertUpdated('all', '/p/contract-child/', '—', ''); // No usable time at all.
        if (!['products', 'name'].includes(view)) assertUpdated('d', '/d/contract-override/', '2026-08-03', '20260803000000');
        assertUpdated('products', '/products/contract-dates/', '2026-08-02', '20260802000000');
        assertUpdated('products', '/products/contract-empty/', '—', '');
        assertUpdated('tags', '/tags/contract-dates/', '2026-08-02', '20260802000000');
        assertUpdated('tags/contract-dates', '/tags/contract-dates/child/', '2026-08-02', '20260802000000');
        assertUpdated('tags/contract-dates', '/p/contract-priced/', '2026-08-01', '20260801000000');
        assertUpdated('tags/contract-dates/child', '/p/contract-missing/', '2026-08-02', '20260802000000');
        const unassignedRow = payload(output, lang, 'tags/untagged').rows.find(row => row.href === `${prefixes[index]}/p/contract-unclassified/`);
        assert(unassignedRow, 'unassigned taxonomy term contains pages without taxonomy values');
        assert.equal(unassignedRow.key, 'contract-unclassified', 'unassigned taxonomy pages use the same stable collection key');
        const iconFor = (list, href) => payload(output, lang, list).rows.find(row => row.href === `${prefixes[index]}${href}`)?.icon;
        for (const list of ['d', 'all', 'products/free', 'all-products']) {
            assert.deepEqual(iconFor(list, '/p/contract-no-offer/'), ownImage, 'own image resolves against its article bundle in every list');
        }
        assert.deepEqual(iconFor('d/contract-image', '/d/contract-image/child/'), assetImage, 'directory defaults support global assets');
        for (const list of ['d', 'all']) {
            assert.deepEqual(iconFor(list, '/p/contract-unclassified/'), monochromeAsset, 'own monochrome image reuses a global asset without changing its URL');
        }
        assert.deepEqual(fs.readFileSync(path.join(output, assetImage.image)), logoBytes);
        assert.deepEqual(fs.readdirSync(path.join(output, 'site/pwa')).filter(name => name.startsWith('favicon.')), [`favicon.${logoHash}.svg`], 'favicon and content icons publish one shared resource');
        assert.deepEqual(iconFor('d/contract-image/child', '/p/contract-image-child/'), inheritedImage, 'inherited image keeps its declaring directory, not the child bundle');
        assert.deepEqual(fs.readFileSync(path.join(output, ownImage.image)), imageBytes, 'published hash matches the original bytes');
        assert.equal(fs.existsSync(path.join(output, 'icp/0.webp')), false, 'icon source is not also published at an unhashed URL');
        assert.deepEqual(iconFor('d', '/d/contract-text/'), {text: '©'});
        assert.deepEqual(iconFor('d/contract-text', '/d/contract-text/child/'), {text: 'Dir'});
        assert.deepEqual(iconFor('d/contract-text', '/p/contract-text/'), {text: 'EN'});
        assert.equal(iconFor('d/contract-text/child', '/p/contract-text-child/'), 'product', 'SVG overrides inherited text atomically');
        for (const list of ['d', 'all', 'products/free', 'all-products']) {
            assert.deepEqual(iconFor(list, '/p/contract-zero/'), {text: '<b>EN</b>'}, 'text icon case and literal markup survive the payload');
        }
        assert.equal(iconFor('d', '/p/contract-empty/'), 'file', 'a parent icon is not inherited by its articles');
        assert.equal(iconFor('d', '/d/contract-override/'), 'info', 'a directory may declare its own icon');
        assert.equal(iconFor('d/contract-override', '/d/contract-override/child/'), 'rss');
        assert.equal(iconFor('d/contract-override', '/p/contract-direct/'), 'appearance-auto');
        assert.equal(iconFor('d/contract-override/child', '/d/contract-override/child/nested/'), 'rss', 'folder default still inherits after a file-only override');
        assert.equal(iconFor('d/contract-override/child', '/p/contract-child/'), 'theme');
        assert.equal(iconFor('d/contract-override/child/nested', '/p/contract-nested/'), 'theme', 'blank declarations inherit');
        assert.equal(iconFor('products', '/products/contract-empty/'), 'rss', 'term own icon wins over the folder default');
        assert.equal(iconFor('products/free', '/p/contract-missing/'), 'product', 'term inherits taxonomy file default');
        assert.equal(iconFor('products/paid', '/p/contract-missing/'), 'appearance-light', 'a term can override its file default');
        assert.equal(iconFor('all-products', '/p/contract-missing/'), 'product', 'aggregate uses its own default');
        assert.equal(iconFor('all', '/p/contract-direct/'), 'file', 'aggregate does not inherit its target defaults');
        for (const list of ['d', 'all', 'products/free', 'products/paid', 'all-products']) {
            assert.equal(iconFor(list, '/p/contract-priced/'), 'appearance-dark', `own article icon wins in ${list}`);
        }
        const all = payload(output, lang, 'all-products');
        assert.equal(all.rows.filter(row => /\/p\/contract-/.test(row.href)).length, 4, 'native union includes four fixture products, once each');
        assert.equal(new Set(all.rows.map(row => row.href)).size, all.rows.length);
        assert(!all.rows.some(row => /\/p\/contract-(unclassified|empty|blank)\//.test(row.href)));
        const free = payload(output, lang, 'products/free');
        assert.equal(free.sv, 'products');
        assert.equal(free.rows.filter(row => /\/p\/contract-/.test(row.href)).length, 4);
        assert.equal(free.rows.find(row => row.href.includes('contract-priced')).price_text, '$25', 'category labels do not validate prices');
        assert.equal(free.rows.find(row => row.href.includes('contract-missing')).price_text, '—');
        assert.equal(free.rows.find(row => row.href.includes('contract-zero')).sort_price, '0');
        const categories = payload(output, lang, 'products');
        assert.equal(categories.sv, 'tree');
        assert(categories.rows.some(row => row.href === `${prefixes[index]}/products/contract-empty/` && row.count_text === '0'));
        for (const label of ['Special Tools', '$5~$50']) {
            const term = categories.rows.find(row => row.text === label);
            assert(term, `autogenerated term ${label}`);
            const logical = term.href.replace(new RegExp(`^${prefixes[index]}/`), '').replace(/\/$/, '');
            assert(payload(output, lang, decodeURI(logical)).rows.length > 0);
        }
        const html = fs.readFileSync(path.join(output, prefixes[index].slice(1), 'p/contract-missing/index.html'), 'utf8');
        assert(!/data-sortable=(?:"true"|true)/.test(html), 'article remains an article despite inherited list');
        for (const list of ['products/contract-name', 'contract-name-all', ...(view === 'name' ? ['d', 'd/wsl'] : [])]) {
            const names = payload(output, lang, list);
            assert.equal(names.sv, 'name');
            assert.equal(names.ds, 'name-asc');
            assert(names.rows.length > 0);
            assert(names.rows.every(row => !('sort_date' in row) && !('date_text' in row) && !('count_text' in row) && !('price_text' in row)), 'name payloads only contain name and shared navigation fields');
            const ranks = names.rows.map(row => Number(row.sort_name));
            assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), 'SSR name order agrees with its shipped sort ranks');
        }
    }
    console.log(`PASS collection membership, inheritance and Lastmod dates: ${view}, all three languages`);
}

const browser = await chromium.launch({ headless: true });
const server = await createStaticSiteServer({ rootDir: builds.directory });
await server.start();
const baseUrl = server.getBaseUrl();
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
    await context.addInitScript(suppressLanguageSuggestDialogScript());
    const page = await context.newPage();
    for (const [index, lang] of ['en', 'zh', 'zh-tw'].entries()) {
        await gotoAndWait(page, `${baseUrl}${prefixes[index]}/products/`);
        const names = await page.locator('.slot-main .collection-item-title').allTextContents();
        assert.deepEqual(names, payload(builds.directory, lang, 'products').rows.map(row => row.text), 'default category order agrees before and after hydration');
        assert.equal(await page.locator(`[data-root-href="${prefixes[index]}/d/"] use`).getAttribute('href'), '#icon-info', 'root navigation honors the same own icon');
        const nav = page.locator('[data-root-href*="/contract-nav-"]');
        assert.deepEqual(await nav.evaluateAll(nodes => nodes.map(node => node.dataset.rootHref)), [`${prefixes[index]}/contract-nav-enabled/`], 'Only boolean root_nav: true opts a root page into navigation.');
        assert.equal(await page.locator(`[data-root-href="${prefixes[index]}/d/contract-override/"]`).count(), 0, 'Opting in a child does not promote it to the content root.');
        for (const name of ['enabled', 'disabled', 'omitted', 'string']) {
            const response = await page.request.get(`${baseUrl}${prefixes[index]}/contract-nav-${name}/`);
            assert.equal(response.status(), 200, 'Navigation visibility must not disable page output.');
        }
    }
    for (const list of ['d', 'all', 'products/contract-dates']) {
        for (const direction of ['asc', 'desc']) {
            await gotoAndWait(page, `${baseUrl}/${list}/?sort=date-${direction}`);
            const links = '.slot-main .collection-item-link[href*="/p/contract-"]';
            const dates = await page.locator(links).evaluateAll(nodes => nodes
                .filter(node => /\/p\/contract-(priced|missing)\//.test(node.href))
                .map(node => node.closest('.cell-title').nextElementSibling.textContent.trim()));
            assert.deepEqual(dates, direction === 'asc' ? ['2026-08-01', '2026-08-02'] : ['2026-08-02', '2026-08-01']);
            assert.match(await page.locator('.slot-main [data-sort-field="date"]').textContent(), /Updated/);
            const ordered = await page.locator(links).evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
            await page.locator(`${links}[href*="/p/contract-missing/?"]`).click();
            await waitForBreadcrumbSettled(page);
            const pathOrder = await page.locator('.slot-breadcrumb .collection-item-link[href*="/p/contract-"]').evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
            assert.deepEqual(pathOrder, ordered, 'Lastmod sort survives entry into the article path column');
        }
    }
    console.log('PASS Lastmod ascending/descending display and article path order');
    for (const direction of ['asc', 'desc']) {
        await gotoAndWait(page, `${baseUrl}/products/free/?sort=price-${direction}`);
        const ordered = await page.locator('.slot-main .grid-products .collection-item-link').evaluateAll(links => links.map(link => ({
            href: new URL(link.href).pathname,
            price: link.closest('.cell-title').dataset.sortPrice ?? ''
        })));
        assert.equal(ordered.length, payload(builds.directory, 'en', 'products/free').rows.length);
        const firstMissing = ordered.findIndex(row => row.price === '');
        assert(firstMissing >= 0);
        assert(ordered.slice(firstMissing).every(row => row.price === ''), `unpriced last on price-${direction}`);
        const amounts = ordered.slice(0, firstMissing).map(row => Number(row.price));
        assert.deepEqual(amounts, [...amounts].sort((a, b) => direction === 'asc' ? a - b : b - a));
        const clicked = page.locator('.slot-main a[href*="/p/contract-missing/?"]');
        await clicked.click();
        await waitForBreadcrumbSettled(page);
        const selected = await page.locator('[data-root-href].is-current').getAttribute('data-root-href');
        assert.equal(selected, '/products/');
        const items = await page.locator('.slot-breadcrumb .collection-item-link[href*="/p/"]').evaluateAll(links => links.map(a => new URL(a.href).pathname));
        assert.deepEqual(items, ordered.map(row => row.href), 'path column order matches product table');
    }
    // Arbitrary auto terms must support article entry, not just compile a page.
    await gotoAndWait(page, `${baseUrl}/products/`);
    await page.locator('.slot-main a').filter({ hasText: '$5~$50' }).click();
    await page.locator('.slot-main a[href*="/p/contract-priced/?"]').click();
    await waitForBreadcrumbSettled(page);
    assert.equal(await page.locator('[data-root-href].is-current').getAttribute('data-root-href'), '/products/');
    await context.close();
    console.log('PASS missing-price order, shared path rows, arbitrary term article entry');

    // The paid-source icon is absent from the canonical rows, but its symbol
    // must already be available when first-paint/runtime rebuild those rows.
    const noJs = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    const staticPage = await noJs.newPage();
    await staticPage.goto(`${baseUrl}/p/contract-missing/`);
    assert.equal(await staticPage.locator('use[href="#icon-appearance-light"]').count(), 0);
    assert.equal(await staticPage.locator('symbol#icon-appearance-light').count(), 1, 'source-only SVG is packed without relying on SSR rows');
    await staticPage.goto(`${baseUrl}/d/contract-override/child/`);
    assert.equal(await staticPage.locator('.slot-breadcrumb a[href*="/d/contract-override/child/"] use').getAttribute('href'), '#icon-rss', 'SSR column projection preserves inherited icons');
    await staticPage.goto(`${baseUrl}/p/contract-text/`);
    assert.equal(await staticPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-text/"] .icon--text').textContent(), 'EN');
    await staticPage.goto(`${baseUrl}/products/free/`);
    assert.equal(await staticPage.locator('.slot-main a[href*="/p/contract-no-offer/"] img.icon--image').getAttribute('src'), ownImage.image);
    assert.equal(await staticPage.locator('.slot-main a[href*="/p/contract-no-offer/"] .icon--monochrome').count(), 0, 'ordinary images retain their colors');
    assert.equal(await staticPage.locator('.slot-main a[href*="/p/contract-zero/"] .icon--text').textContent(), '<b>EN</b>');
    assert.equal(await staticPage.locator('.icon--text b').count(), 0, 'text icons are escaped during SSR');
    await staticPage.goto(`${baseUrl}/p/contract-image-child/`);
    assert.equal(await staticPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-image-child/"] img.icon--image').getAttribute('src'), inheritedImage.image);
    assert.equal(await staticPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-image-child/"] .icon--monochrome').count(), 1, 'SSR preserves inherited monochrome');
    await staticPage.goto(`${baseUrl}/p/contract-unclassified/`);
    assert.equal(await staticPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-unclassified/"] img.icon--image').getAttribute('src'), assetImage.image);
    assert.equal(await staticPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-unclassified/"] .icon--monochrome').count(), 1, 'SSR preserves own monochrome');
    await noJs.close();

    const iconsContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 960 } });
    await iconsContext.addInitScript(suppressLanguageSuggestDialogScript());
    const iconsPage = await iconsContext.newPage();
    const selectedIcon = () => iconsPage.locator('.slot-breadcrumb a.is-current[href*="/p/contract-missing/"] use').getAttribute('href');
    await gotoAndWait(iconsPage, `${baseUrl}/products/free/?sort=name-desc`);
    await iconsPage.locator('.slot-main a[href*="/p/contract-missing/?"]').click();
    await waitForBreadcrumbSettled(iconsPage);
    assert.equal(await selectedIcon(), '#icon-product');
    await gotoAndWait(iconsPage, `${baseUrl}/p/contract-missing/?from=products/paid&sort=name-asc`);
    assert.equal(await selectedIcon(), '#icon-appearance-light');
    await iconsPage.reload();
    await waitForBreadcrumbSettled(iconsPage);
    assert.equal(await selectedIcon(), '#icon-appearance-light');
    await iconsPage.goBack();
    await waitForBreadcrumbSettled(iconsPage);
    assert.equal(await selectedIcon(), '#icon-product');
    await iconsPage.goForward();
    await waitForBreadcrumbSettled(iconsPage);
    assert.equal(await selectedIcon(), '#icon-appearance-light');
    for (const prefix of prefixes) {
        await gotoAndWait(iconsPage, `${baseUrl}${prefix}/all/?sort=name-asc`);
        await iconsPage.locator('.slot-main a[href*="/p/contract-unclassified/?"]').click();
        const selectedAsset = () => iconsPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-unclassified/"] img.icon--image.icon--monochrome');
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedAsset().getAttribute('src'), assetImage.image);
        await selectedAsset().evaluate(image => image.decode());
        await iconsPage.reload();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedAsset().getAttribute('src'), assetImage.image);
        await iconsPage.goBack();
        await iconsPage.goForward();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedAsset().getAttribute('src'), assetImage.image);
        await gotoAndWait(iconsPage, `${baseUrl}${prefix}/products/free/?sort=name-asc`);
        await iconsPage.locator('.slot-main a[href*="/p/contract-no-offer/?"]').click();
        const selectedImage = () => iconsPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-no-offer/"] img.icon--image');
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedImage().getAttribute('src'), ownImage.image);
        await selectedImage().evaluate(image => image.decode());
        await iconsPage.reload();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedImage().getAttribute('src'), ownImage.image);
        await iconsPage.goBack();
        await iconsPage.goForward();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedImage().getAttribute('src'), ownImage.image);
        await gotoAndWait(iconsPage, `${baseUrl}${prefix}/d/contract-image/child/`);
        await iconsPage.locator('.slot-main a[href*="/p/contract-image-child/?"]').click();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await iconsPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-image-child/"] img.icon--image.icon--monochrome').getAttribute('src'), inheritedImage.image);
        await gotoAndWait(iconsPage, `${baseUrl}${prefix}/products/free/?sort=name-asc`);
        await iconsPage.locator('.slot-main a[href*="/p/contract-zero/?"]').click();
        const selectedText = () => iconsPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-zero/"] .icon--text').textContent();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedText(), '<b>EN</b>');
        assert.equal(await iconsPage.locator('.icon--text b').count(), 0, 'runtime icons use textContent');
        await iconsPage.reload();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedText(), '<b>EN</b>');
        await iconsPage.goBack();
        await waitForBreadcrumbSettled(iconsPage);
        await iconsPage.goForward();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await selectedText(), '<b>EN</b>');
        await gotoAndWait(iconsPage, `${baseUrl}${prefix}/d/contract-text/`);
        await iconsPage.locator('.slot-main a[href*="/p/contract-text/?"]').click();
        await waitForBreadcrumbSettled(iconsPage);
        assert.equal(await iconsPage.locator('.slot-breadcrumb .is-current[href*="/p/contract-text/"] .icon--text').textContent(), 'EN');
    }
    await iconsContext.close();
    console.log('PASS inherited/own icons, source-only SVGs, SSR columns, reload and history');

    server.setRoot(builds.name);
    const namesContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1024, height: 700 } });
    await namesContext.addInitScript(suppressLanguageSuggestDialogScript());
    const namesPage = await namesContext.newPage();
    const paths = selector => namesPage.locator(selector).evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
    const nameGrid = '.slot-main [data-sortable="true"]';
    const mainLinks = `${nameGrid} .collection-item-link`;
    for (const [index, lang] of ['en', 'zh', 'zh-tw'].entries()) {
        const prefix = prefixes[index];
        for (const list of ['d', 'd/wsl', 'products/contract-name', 'contract-name-all']) {
            const address = `${baseUrl}${prefix}/${list}/`;
            await gotoAndWait(namesPage, address);
            const expected = payload(builds.name, lang, list).rows.map(row => row.href);
            const staticRows = await namesPage.evaluate(async href => {
                const html = await (await fetch(href)).text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const grid = doc.querySelector('.slot-main [data-sortable]');
                return { fields: [...grid.querySelectorAll('[data-sort-field]')].map(node => node.dataset.sortField),
                    items: [...grid.querySelectorAll('.collection-item-link')].map(node => new URL(node.getAttribute('href'), location.href).pathname),
                    nonNameCells: grid.querySelectorAll(':scope > :not(.cell-title)').length };
            }, address);
            assert.deepEqual(staticRows, {fields: ['name'], items: expected, nonNameCells: 0}, 'SSR renders only name cells and canonical name order');
            assert.deepEqual(await paths(mainLinks), expected, 'Hydration preserves SSR order');
            assert.equal(await namesPage.locator(nameGrid).getAttribute('data-sort-columns'), '1');
            assert.equal(await namesPage.locator(nameGrid).evaluate(grid => getComputedStyle(grid).gridTemplateColumns), '225px');
            await namesPage.locator(`${nameGrid} [data-sort-field="name"]`).click();
            await namesPage.waitForURL(url => url.searchParams.get('sort') === 'name-desc');
            const descending = [...expected].reverse();
            assert.deepEqual(await paths(mainLinks), descending, 'Single-column sorting reverses all names');
            const collectionUrl = namesPage.url();
            const articleLink = namesPage.locator(`${mainLinks}[href*="/p/"]`).first();
            const articlePath = await articleLink.evaluate(node => new URL(node.href).pathname);
            await articleLink.click();
            await waitForBreadcrumbSettled(namesPage);
            const column = `.slot-breadcrumb [data-breadcrumb-collection-href="${prefix}/${list}/"]`;
            const assertNameColumn = async () => {
                assert.equal(new URL(namesPage.url()).searchParams.get('from'), list);
                assert.deepEqual(await paths(`${column} .collection-item-link`), descending, 'Article path uses the same name list order');
                assert.deepEqual(await paths(`${column} .collection-item-link.is-current`), [articlePath]);
                assert.match(await namesPage.locator(`${column} .collection-column-sort`).textContent(), /↓/);
            };
            await assertNameColumn();
            await namesPage.reload();
            await waitForBreadcrumbSettled(namesPage);
            await assertNameColumn();
            await namesPage.goBack();
            await namesPage.waitForURL(collectionUrl);
            await waitForBreadcrumbSettled(namesPage);
            assert.deepEqual(await paths(mainLinks), descending);
            await namesPage.goForward();
            await waitForBreadcrumbSettled(namesPage);
            await assertNameColumn();
            await namesPage.locator(`${column} .collection-column-sort`).click();
            await namesPage.waitForFunction(selector => document.querySelector(selector)?.textContent.includes('↑'), `${column} .collection-column-sort`);
            assert.deepEqual(await paths(`${column} .collection-item-link`), expected, 'Path-column toggle uses name sorting too');
        }
    }
    await gotoAndWait(namesPage, `${baseUrl}/zh/d/`);
    await namesPage.screenshot({path: path.join(work, 'name-list-zh.png')});
    await gotoAndWait(namesPage, `${baseUrl}/zh/p/contract-missing/?from=products/contract-name&sort=name-desc`);
    await namesPage.screenshot({path: path.join(work, 'name-list-path-zh.png')});
    await namesContext.close();
    console.log('PASS name-only SSR, section inheritance, taxonomy/aggregate sources, ascending/descending sort, path columns and history in three languages');
} finally {
    await browser.close();
    await server.stop();
}
// Price metadata is optional, but a supplied amount must be usable for display/sort.
const invalidFile = path.join(overlay, 'd/contract-priced/index.md');
const validContent = fs.readFileSync(invalidFile, 'utf8');
for (const [name, content, message] of [
    ['currency', validContent.replace('currency: "$", ', ''), 'requires offer.currency'],
    ['amount', validContent.replace('amount: 25', 'amount: -1'), 'Invalid offer.amount'],
    ['icon', validContent.replace('icon: appearance-dark', 'icon: no-such-icon'), 'undefined icon'],
    ['article-default', validContent.replace('icon: appearance-dark', 'icon: appearance-dark\nlist_icon_file: product'), 'only supported on list pages'],
    ['text-empty', validContent.replace('icon: appearance-dark', 'icon: {text: " "}'), 'text must be a non-empty string'],
    ['text-number', validContent.replace('icon: appearance-dark', 'icon: {text: 12}'), 'text must be a non-empty string'],
    ['text-keys', validContent.replace('icon: appearance-dark', 'icon: {text: "©", svg: folder}'), 'object containing only text'],
    ['text-bare', validContent.replace('icon: appearance-dark', 'icon: "©"'), 'undefined icon'],
    ['text-monochrome', validContent.replace('icon: appearance-dark', 'icon: {text: "©", monochrome: true}'), 'image with optional monochrome'],
    ['image-monochrome-string', validContent.replace('icon: appearance-dark', 'icon: {image: "site/pwa/favicon.svg", monochrome: "true"}'), 'monochrome must be a boolean'],
    ['image-monochrome-number', validContent.replace('icon: appearance-dark', 'icon: {image: "site/pwa/favicon.svg", monochrome: 1}'), 'monochrome must be a boolean'],
    ['image-empty', validContent.replace('icon: appearance-dark', 'icon: {image: " "}'), 'image must be a non-empty string'],
    ['image-missing', validContent.replace('icon: appearance-dark', 'icon: {image: "missing.webp"}'), 'was not found in page bundle'],
    ['image-page-only', validContent.replace('icon: appearance-dark', 'icon: {image: "./site/pwa/favicon.svg"}'), 'cannot resolve page bundle asset'],
    ['image-remote', validContent.replace('icon: appearance-dark', 'icon: {image: "https://example.com/a.webp"}'), 'static and remote URLs are not supported'],
    ['image-static', validContent.replace('icon: appearance-dark', 'icon: {image: "/favicon.svg"}'), 'static and remote URLs are not supported'],
    ['image-text', validContent.replace('icon: appearance-dark', 'icon: {image: "not-an-image.txt"}'), 'must reference an image resource']
]) {
    write(path.join(overlay, 'd/contract-priced/not-an-image.txt'), 'Not an image.');
    write(invalidFile, content);
    const result = spawnSync(hugo, ['--config', `hugo.toml,${rel(config)}`, '--destination', rel(path.join(work, `invalid-${name}`))],
        { cwd: root, env: createHugoEnv({ cwd: root }), encoding: 'utf8', windowsHide: true });
    assert.notEqual(result.status, 0, `invalid ${name} must fail the build`);
    assert((result.stdout + result.stderr).includes(message));
}
console.log('PASS supplied price and icon declaration validation');
console.log(`Collection contract checks passed: ${rel(work)}`);
