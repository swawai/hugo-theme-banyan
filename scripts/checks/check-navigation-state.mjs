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
        search: '',
    },
};

const breadcrumbSource = await importBrowserModule(breadcrumbSourceEntry, 'breadcrumb-source.js');
const breadcrumbItems = await importBrowserModule(breadcrumbItemsEntry, 'breadcrumb-items.js');
const breadcrumbPreview = await importBrowserModule(breadcrumbPreviewEntry, 'breadcrumb-preview.js');

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

const previewMenuCurrentItem = breadcrumbPreview.buildPreviewCurrentItem(
    {
        currentCollectionSource: {
            logical_path: '/intent/decide/',
            provider: 'taxonomy',
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
    previewMenuCurrentItem?.menu?.find((item) => item.current === true)?.title,
    'WSL automation management script',
    'entry preview should attach the full title to the visible current menu option'
);

const sourcePayload = JSON.stringify([{
    logical_path: '/intent/decide/',
    provider: 'taxonomy',
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
        provider: 'taxonomy',
        sort_variant: 'tree',
        default_sort: 'date-desc'
    }
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
            provider: 'taxonomy',
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
    selectedItem?.menu?.find((item) => item.text === 'WSL Toolkit')?.current,
    true,
    'current breadcrumb menu item should be highlighted when selected by pathname'
);
assert.equal(
    selectedItem?.menu?.find((item) => item.current === true)?.title,
    'WSL automation management script',
    'settled entry state should attach the full title to the visible current menu option'
);

console.log('Entry from checks passed.');
