// Exercise the real site with a temporary content overlay; never edit its content.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
const cases = [
    ['priced', 'products: [free, paid, "Special Tools", "$5~$50"]\noffer: {amount: 25, currency: "$", value: "Paid and free are opaque labels"}'],
    ['missing', 'products: [free, "Special Tools"]\noffer: {value: "Value without a price"}'],
    ['zero', 'products: [free]\noffer: {amount: 0, currency: "$"}'],
    ['no-offer', 'products: [free]'],
    ['unclassified', 'offer: {amount: 99, currency: "$", value: "Not a product"}'],
    ['empty', 'products: []'],
    ['blank', 'products: [""]']
];
for (const lang of langs) {
    write(path.join(overlay, `products/contract-empty/_index${lang}.md`), '---\ntitle: Contract empty category\n---\n');
    for (const [name, fields] of cases) write(path.join(overlay, `d/contract-${name}/index${lang}.md`),
        `---\ntitle: "Contract ${name}"\nslug: contract-${name}\ndate: 2026-01-01\n${fields}\n---\nArticle body stays an article.\n`);
    write(path.join(overlay, `d/contract-override/_index${lang}.md`), '---\ntitle: Override\nlist: all\n---\n');
    write(path.join(overlay, `d/contract-override/child/_index${lang}.md`), '---\ntitle: Child inherits override\n---\n');
    write(path.join(overlay, `d/contract-override/child/item${lang}.md`), '---\ntitle: Child item\nslug: contract-child\n---\nChild.\n');
}
const config = path.join(work, 'overlay.toml');
write(config, `[[module.mounts]]\nsource = "${rel(overlay)}"\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`);
const hugo = resolveHugoCommand({ cwd: root });
function build(view) {
    for (const lang of langs) {
        const source = fs.readFileSync(`themes/banyan/content/d/_index${lang}.md`, 'utf8');
        write(path.join(overlay, `d/_index${lang}.md`), source.replace('list: directory', `list: ${view}`));
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
for (const view of ['directory', 'all', 'products']) {
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
    }
    console.log(`PASS collection membership and inheritance: ${view}, all three languages`);
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
    }
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
} finally {
    await browser.close();
    await server.stop();
}
// Price metadata is optional, but a supplied amount must be usable for display/sort.
const invalidFile = path.join(overlay, 'd/contract-priced/index.md');
const validContent = fs.readFileSync(invalidFile, 'utf8');
for (const [name, content, message] of [
    ['currency', validContent.replace('currency: "$", ', ''), 'requires offer.currency'],
    ['amount', validContent.replace('amount: 25', 'amount: -1'), 'Invalid offer.amount']
]) {
    write(invalidFile, content);
    const result = spawnSync(hugo, ['--config', `hugo.toml,${rel(config)}`, '--destination', rel(path.join(work, `invalid-${name}`))],
        { cwd: root, env: createHugoEnv({ cwd: root }), encoding: 'utf8', windowsHide: true });
    assert.notEqual(result.status, 0, `invalid ${name} must fail the build`);
    assert((result.stdout + result.stderr).includes(message));
}
console.log('PASS supplied price validation');
console.log(`Collection contract checks passed: ${rel(work)}`);
