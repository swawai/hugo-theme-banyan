import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';

const siteRoot = process.cwd();
const navStateEntry = path.join(siteRoot, 'themes/banyan/assets/js/nav-state.js');
const breadcrumbItemsEntry = path.join(siteRoot, 'themes/banyan/assets/js/breadcrumb-items.js');
const breadcrumbPreviewEntry = path.join(siteRoot, 'themes/banyan/assets/js/breadcrumb-preview.js');
const breadcrumbSourceEntry = path.join(siteRoot, 'themes/banyan/assets/js/breadcrumb-source.js');
const collectionItemsEntry = path.join(siteRoot, 'themes/banyan/assets/js/collection-items.js');
const tempRoot = path.join(siteRoot, 'temp_workspace', 'check-navigation-state');

const navigationStateStub = `
export const navigationState = {
  fields: {
    entry_lineage: { name: "from", aliases: [], location: "query", cache_key: "ignore" },
    active_sort: { name: "sort", aliases: [], location: "query", cache_key: "ignore" },
    lineage_sorts: { name: "sorts", aliases: [], location: "query", cache_key: "ignore", placeholder: "_" }
  }
};
`;

async function importBrowserModule(entrypoint, outputName) {
    await fs.mkdir(tempRoot, { recursive: true });
    const outdir = await fs.mkdtemp(path.join(tempRoot, 'bundle-'));
    const moduleName = outputName.endsWith('.mjs') ? outputName : outputName.replace(/\.js$/i, '.mjs');
    const outfile = path.join(outdir, moduleName);
    await esbuild.build({
        entryPoints: [entrypoint],
        bundle: true,
        outfile,
        platform: 'browser',
        target: 'es2022',
        format: 'esm',
        plugins: [{
            name: 'navigation-state-params',
            setup(build) {
                build.onResolve({ filter: /^@params$/ }, () => ({
                    path: 'navigation-state-params',
                    namespace: 'navigation-state-params'
                }));
                build.onLoad({ filter: /.*/, namespace: 'navigation-state-params' }, () => ({
                    contents: navigationStateStub,
                    loader: 'js'
                }));
            }
        }]
    });

    return import(pathToFileURL(outfile).href);
}

function applySorts(module, inputUrl, tokens, defaultTokens = []) {
    const url = new URL(inputUrl);
    module.applySortsTokensToUrl(url, tokens, defaultTokens);
    return `${url.pathname}${url.search}${url.hash}`;
}

const navState = await importBrowserModule(navStateEntry, 'nav-state.js');

assert.equal(
    applySorts(
        navState,
        'https://example.test/zh/d/wsl/?sorts=date-desc,date-desc',
        ['date-desc', 'date-desc'],
        ['date-desc', 'date-desc']
    ),
    '/zh/d/wsl/',
    'default lineage sorts should be omitted from URLs'
);

assert.equal(
    applySorts(
        navState,
        'https://example.test/zh/p/example/?from=d&sorts=date-desc',
        ['date-desc'],
        ['date-desc']
    ),
    '/zh/p/example/?from=d',
    'default entry lineage sorts should be omitted while preserving from'
);

assert.equal(
    applySorts(
        navState,
        'https://example.test/zh/p/example/?from=products/first-party',
        ['', 'name-asc'],
        ['date-desc', 'name-asc']
    ),
    '/zh/p/example/?from=products/first-party',
    'placeholder/default lineage sorts should be omitted when every layer is default'
);

assert.equal(
    applySorts(
        navState,
        'https://example.test/zh/p/example/?from=d/wsl',
        ['name-asc', 'date-desc'],
        ['date-desc', 'date-desc']
    ),
    '/zh/p/example/?from=d/wsl&sorts=name-asc,date-desc',
    'non-default ancestor sort should keep the full lineage for depth alignment'
);

assert.equal(
    applySorts(
        navState,
        'https://example.test/zh/p/example/?from=d/wsl',
        ['', 'name-asc'],
        ['date-desc', 'date-desc']
    ),
    '/zh/p/example/?from=d/wsl&sorts=_,name-asc',
    'non-default descendant sort should keep placeholder alignment'
);

console.log('Navigation state checks passed.');

globalThis.window = {
    location: {
        origin: 'https://example.test',
        href: 'https://example.test/zh/p/example/?from=all',
        pathname: '/zh/p/example/',
        search: '',
        hash: '',
    },
};

window.location.search = '?from=d/wsl';
assert.deepEqual(
    navState.buildLineageSortsTokensForPath('/d/wsl/', '/d/', 'date-asc'),
    ['date-asc', ''],
    'ancestor sort updates should target their own full-lineage slot'
);
assert.deepEqual(
    navState.buildLineageSortsTokensForPath('/d/wsl/', '/d/wsl/', 'date-asc'),
    ['', 'date-asc'],
    'active sort updates should target the deepest full-lineage slot'
);

const breadcrumbSource = await importBrowserModule(breadcrumbSourceEntry, 'breadcrumb-source.js');
const breadcrumbItems = await importBrowserModule(breadcrumbItemsEntry, 'breadcrumb-items.js');
const breadcrumbPreview = await importBrowserModule(breadcrumbPreviewEntry, 'breadcrumb-preview.js');
const collectionItems = await importBrowserModule(collectionItemsEntry, 'collection-items.js');

const compositeRows = [
    {
        key: 'beta',
        href: '/zh/p/beta/',
        sort_group: '0',
        sort_name: 'Beta',
        sort_size: '2',
    },
    {
        key: 'alpha',
        href: '/zh/p/alpha/',
        sort_group: '0',
        sort_name: 'Alpha',
        sort_size: '2',
    },
    {
        key: 'gamma',
        href: '/zh/p/gamma/',
        sort_group: '0',
        sort_name: 'Gamma',
        sort_size: '10',
    },
];

function readCompositeOrder(token, rows = compositeRows) {
    window.location.search = `?sort=${token}`;
    window.location.href = `https://example.test/zh/all/${window.location.search}`;
    return collectionItems.sortItemsRows(rows, 'all').rows.map((row) => row.key);
}

const compositeAsc = readCompositeOrder('size-asc');
const compositeDesc = readCompositeOrder('size-desc');
assert.deepEqual(
    compositeAsc,
    ['alpha', 'beta', 'gamma'],
    'numeric primary ties should use the name field as the next ascending tuple component'
);
assert.deepEqual(
    compositeDesc,
    compositeAsc.slice().reverse(),
    'descending sort should reverse the complete primary/name tuple'
);

const stableKeyRows = [
    {
        key: 'second',
        href: '/zh/p/second/',
        sort_group: '0',
        sort_name: 'Same',
        sort_size: '2',
    },
    {
        key: 'first',
        href: '/zh/p/first/',
        sort_group: '0',
        sort_name: 'Same',
        sort_size: '2',
    },
];
assert.deepEqual(
    readCompositeOrder('size-asc', stableKeyRows),
    ['first', 'second'],
    'stable hrefs should make otherwise equal rows deterministic'
);
assert.deepEqual(
    readCompositeOrder('size-desc', stableKeyRows),
    ['second', 'first'],
    'stable hrefs should reverse with the rest of the descending tuple'
);

const preciseDateRows = [
    {
        key: 'same-day-later',
        href: '/zh/p/same-day-later/',
        sort_group: '0',
        sort_name: 'Same day later',
        sort_date: '20260726134731',
    },
    {
        key: 'next-day',
        href: '/zh/p/next-day/',
        sort_group: '0',
        sort_name: 'Next day',
        sort_date: '20260727000000',
    },
    {
        key: 'same-day-earlier',
        href: '/zh/p/same-day-earlier/',
        sort_group: '0',
        sort_name: 'Same day earlier',
        sort_date: '20260726120000',
    },
];
assert.deepEqual(
    readCompositeOrder('date-asc', preciseDateRows),
    ['same-day-earlier', 'same-day-later', 'next-day'],
    '14-digit publication date keys should preserve second-level ordering within one display date'
);
assert.deepEqual(
    readCompositeOrder('date-desc', preciseDateRows),
    ['next-day', 'same-day-later', 'same-day-earlier'],
    'descending publication date sorting should reverse the complete precise-date tuple'
);

window.location.href = 'https://example.test/zh/p/example/?from=all';
window.location.pathname = '/zh/p/example/';
window.location.search = '?from=all';

const allCollectionSource = {
    logical_path: '/all/',
    provider: 'collection',
    sort_variant: 'all',
    default_sort: 'date-desc',
    label: 'All',
    href: '/zh/all/',
};

assert.deepEqual(
    breadcrumbItems.getCollectionSortState(allCollectionSource),
    {
        collectionSource: {
            logicalPath: '/all/',
            provider: 'collection',
            sortVariant: 'all',
            defaultSort: 'date-desc',
            label: 'All',
            href: '/zh/all/',
        },
        sortVariant: 'all',
        sortToken: 'date-desc',
        field: 'date',
        order: 'desc',
        nextToken: 'date-asc',
        defaultSort: 'date-desc',
        sortsTokens: ['date-desc'],
        defaultSortsTokens: ['date-desc'],
    },
    'column header should expose the active field and direction without adding a field picker'
);

assert.equal(
    breadcrumbItems.buildCollectionSortToggleHref(allCollectionSource),
    '/zh/p/example/?from=all&sorts=date-asc',
    'column header should toggle only its lineage sort direction'
);

window.location.href = 'https://example.test/zh/p/example/?from=all&sort=name-desc&sorts=name-desc';
window.location.search = '?from=all&sort=name-desc&sorts=name-desc';
assert.equal(
    breadcrumbItems.buildCollectionSortToggleHref(allCollectionSource),
    '/zh/p/example/?from=all&sort=name-desc&sorts=name-asc',
    'column header should preserve the independent main sort while toggling its lineage slot'
);

window.location.href = 'https://example.test/zh/p/example/?from=d/wsl&sorts=name-asc,date-desc';
window.location.search = '?from=d/wsl&sorts=name-asc,date-desc';
assert.equal(
    breadcrumbItems.buildCollectionSortToggleHref({
        logical_path: '/d/wsl/',
        provider: 'collection',
        sort_variant: 'section',
        default_sort: 'date-desc',
        label: 'WSL',
        href: '/zh/d/wsl/',
    }),
    '/zh/p/example/?from=d/wsl&sorts=name-asc,date-asc',
    'nested column toggles should preserve ancestor sort state and replace only the current slot'
);

const directoryCollectionSource = {
    logical_path: '/d/',
    provider: 'collection',
    sort_variant: 'section',
    default_sort: 'date-desc',
    label: 'Directory',
    href: '/zh/d/',
};
const wslCollectionSource = {
    logical_path: '/d/wsl/',
    provider: 'collection',
    sort_variant: 'section',
    default_sort: 'date-desc',
    label: 'WSL',
    href: '/zh/d/wsl/',
};

window.location.href = 'https://example.test/zh/p/example/?from=d/wsl';
window.location.search = '?from=d/wsl';
assert.equal(
    breadcrumbItems.buildCollectionSortToggleHref(directoryCollectionSource),
    '/zh/p/example/?from=d/wsl&sorts=date-asc,_',
    'ancestor column toggles should preserve the full lineage and update only the ancestor slot'
);
assert.equal(
    breadcrumbItems.buildCollectionSortToggleHref(wslCollectionSource),
    '/zh/p/example/?from=d/wsl&sorts=_,date-asc',
    'active column toggles should update only the deepest lineage slot'
);

window.location.href = 'https://example.test/zh/p/example/?from=d/wsl&sort=date-asc&sorts=_,date-asc';
window.location.search = '?from=d/wsl&sort=date-asc&sorts=_,date-asc';
assert.equal(
    breadcrumbItems.getCollectionSortState(directoryCollectionSource)?.sortToken,
    'date-desc',
    'the active sort alias must not leak into an ancestor column'
);
assert.equal(
    breadcrumbItems.getCollectionSortState(wslCollectionSource)?.sortToken,
    'date-asc',
    'the deepest column should read its own lineage slot'
);

window.location.href = 'https://example.test/zh/d/wsl/?from=d&sort=name-asc';
window.location.pathname = '/zh/d/wsl/';
window.location.search = '?from=d&sort=name-asc';
assert.equal(
    breadcrumbItems.getCollectionSortState(directoryCollectionSource)?.sortToken,
    'date-desc',
    'a main-grid sort must not leak into a breadcrumb column without a lineage override'
);
assert.equal(
    breadcrumbItems.buildCollectionSortToggleHref(directoryCollectionSource),
    '/zh/d/wsl/?from=d&sort=name-asc&sorts=date-asc',
    'breadcrumb sorting should preserve the main-grid sort while updating only its lineage slot'
);

window.location.href = 'https://example.test/zh/d/wsl/?from=d&sort=name-asc&sorts=date-asc';
window.location.search = '?from=d&sort=name-asc&sorts=date-asc';
assert.equal(
    breadcrumbItems.buildCollectionSortToggleHref(directoryCollectionSource),
    '/zh/d/wsl/?from=d&sort=name-asc',
    'returning a breadcrumb column to its default should remove sorts without changing sort'
);

window.location.href = 'https://example.test/zh/tags/tooling/devtools/windows/wsl/';
window.location.pathname = '/zh/tags/tooling/devtools/windows/wsl/';
window.location.search = '';
assert.equal(
    breadcrumbItems.buildCollectionSortToggleHref(
        directoryCollectionSource,
        window.location.href,
        '/d/wsl/'
    ),
    '/zh/tags/tooling/devtools/windows/wsl/?from=d/wsl&sorts=date-asc,_',
    'a visible-lineage override should preserve every column slot when no from state exists yet'
);

window.location.href = 'https://example.test/zh/p/example/?from=intent/decide';
window.location.search = '?from=intent/decide';

assert.deepEqual(
    breadcrumbPreview.buildPreviewCurrentItem(
        {},
        'WSL Toolkit',
        'WSL automation management script',
        '/zh/p/wsl-automng/?from=intent/decide'
    ),
    {
        text: 'WSL Toolkit',
        title: 'WSL automation management script',
        href: '/zh/p/wsl-automng/?from=intent/decide',
        current: true,
    },
    'entry preview should keep compact visible text and the full title as separate fields'
);

const previewColumnCurrentItem = breadcrumbPreview.buildPreviewCurrentItem(
    {
        currentCollectionSource: {
            logical_path: '/intent/decide/',
            provider: 'collection',
            sort_variant: 'tree',
            default_sort: 'date-desc',
        },
        currentCollectionItems: {
            ds: 'date-desc',
            f: ['key', 'kind', 'href', 'text', 'sort_group', 'sort_name', 'sort_date', 'sort_count'],
            lp: '/intent/decide/',
            p: 'taxonomy',
            rv: [
                'wsl-automng', 'page', '/zh/p/wsl-automng/', 'WSL Toolkit', '1', 'WSL Toolkit', '20260624', '1341',
            ],
            sv: 'tree',
            v: 1,
        },
    },
    'WSL Toolkit',
    'WSL automation management script',
    '/zh/p/wsl-automng/?from=intent/decide'
);

assert.equal(
    previewColumnCurrentItem?.column_items?.find((item) => item.current === true)?.title,
    'WSL automation management script',
    'entry preview should attach the full title to the visible current column item'
);

const sourcePayload = JSON.stringify([{
    logical_path: '/intent/decide/',
    provider: 'collection',
    root_item: {
        href: '/zh/intent/',
        text: 'Intent',
        title: 'Reader Intent'
    },
    tail_items: [{
        href: '/zh/intent/decide/',
        text: 'Decide',
        title: 'Decision Support'
    }],
    current_collection_source: {
        logical_path: '/intent/decide/',
        provider: 'collection',
        sort_variant: 'tree',
        default_sort: 'date-desc',
        label: 'Decide',
        href: '/zh/intent/decide/'
    },
    levels: [{
        item: {
            href: '/zh/intent/decide/',
            text: 'Decide',
            title: 'Decision Support'
        },
        collection_source: {
            logical_path: '/intent/',
            provider: 'collection',
            sort_variant: 'tree',
            default_sort: 'date-desc',
            label: 'Intent',
            href: '/zh/intent/'
        }
    }]
}]);
const sources = breadcrumbSource.parseEntryBreadcrumbSources(sourcePayload);

assert.deepEqual(
    {
        rootText: sources[0]?.rootItem?.text,
        rootTitle: sources[0]?.rootItem?.title,
        termText: sources[0]?.tailItems?.[0]?.text,
        termTitle: sources[0]?.tailItems?.[0]?.title,
    },
    {
        rootText: 'Intent',
        rootTitle: 'Reader Intent',
        termText: 'Decide',
        termTitle: 'Decision Support',
    },
    'taxonomy root and term navigation should preserve compact text separately from full semantic titles'
);

assert.deepEqual(
    breadcrumbSource.parseEntrySelection(sources, '/intent/decide/'),
    {
        source: sources[0],
    },
    'short from should select the collection source without requiring an entry key tail'
);

assert.equal(
    breadcrumbSource.parseEntrySelection(sources, '/intent/decide/wsl-automng/'),
    null,
    'from values with an entry key tail should not be treated as valid navigation state'
);

for (const invalidFrom of ['/intent/', '/intent/unknown/', '/tags/decide/', '']) {
    assert.equal(
        breadcrumbSource.parseEntrySelection(sources, invalidFrom),
        null,
        'root selection must use an exact published source, never infer a root from an unregistered prefix'
    );
}

const collectionSourceIndex = breadcrumbSource.parseCollectionSourceIndex(sourcePayload);
assert.deepEqual(
    breadcrumbSource.pickCollectionSourceByHref(
        collectionSourceIndex,
        'https://example.test/zh/intent/?sort=date-asc#menu'
    ),
    {
        logicalPath: '/intent/',
        provider: 'collection',
        sortVariant: 'tree',
        defaultSort: 'date-desc',
        label: 'Intent',
        href: '/zh/intent/',
    },
    'collection href lookup should resolve ancestor metadata from the current page source registry'
);
assert.deepEqual(
    breadcrumbSource.pickCollectionSourceByHref(
        collectionSourceIndex,
        '/zh/intent/decide'
    ),
    {
        logicalPath: '/intent/decide/',
        provider: 'collection',
        sortVariant: 'tree',
        defaultSort: 'date-desc',
        label: 'Decide',
        href: '/zh/intent/decide/',
    },
    'collection href lookup should normalize trailing slashes and resolve the current collection'
);
assert.equal(
    breadcrumbSource.pickCollectionSourceByHref(collectionSourceIndex, '/zh/unknown/'),
    null,
    'collection href lookup must not infer metadata for sources absent from the current page registry'
);

assert.equal(
    breadcrumbItems.buildBreadcrumbRowHref(
        {
            key: 'wsl-automng',
            kind: 'page',
            href: '/zh/p/wsl-automng/',
            text: 'WSL管理脚本',
        },
        {
            logicalPath: '/intent/decide/',
            provider: 'collection',
        },
        {
            sortToken: '',
            defaultSort: 'date-desc',
            sortsTokens: [],
            defaultSortsTokens: ['date-desc', 'date-desc'],
        }
    ),
    '/zh/p/wsl-automng/?from=intent/decide',
    'entry hrefs should write collection-only from values'
);

globalThis.fetch = async () => ({
    ok: true,
    async json() {
        return {
            ds: 'date-desc',
            f: ['key', 'kind', 'href', 'text', 'sort_group', 'sort_name', 'sort_date', 'sort_count'],
            lp: '/intent/decide/',
            p: 'taxonomy',
            rv: [
                'xvenv', 'page', '/zh/p/xvenv/', 'Xvenv', '1', 'Xvenv', '20260626', '6402',
                'wsl-automng', 'page', '/zh/p/wsl-automng/', 'WSL Toolkit', '1', 'WSL Toolkit', '20260624', '1341',
            ],
            sv: 'tree',
            v: 1
        };
    }
});

const selectedItem = await breadcrumbItems.buildSelectedBreadcrumbItem(
    '/__fragments/v-test/zh/',
    sources[0],
    '/zh/p/wsl-automng/',
    'WSL automation management script'
);

assert.equal(
    selectedItem?.text,
    'WSL Toolkit',
    'short from should resolve the compact visible text from the selected row'
);
assert.equal(selectedItem?.current, true, 'selected row from pathname should be marked current');
assert.equal(
    selectedItem?.title,
    'WSL automation management script',
    'selected current item should preserve the full page title without expanding the compact collection payload'
);
assert.equal(
    selectedItem?.column_items?.find((item) => item.text === 'WSL Toolkit')?.current,
    true,
    'current breadcrumb column item should be highlighted when selected by pathname'
);
assert.equal(
    selectedItem?.column_items?.find((item) => item.current === true)?.title,
    'WSL automation management script',
    'settled entry state should attach the full title to the visible current column item'
);

console.log('Entry from checks passed.');
