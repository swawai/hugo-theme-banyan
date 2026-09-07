import path from 'node:path';

import {
    fail,
    forceServiceWorkerUpdate,
    getLayoutShiftValue,
    getMainInlineStart,
    getVisibleBreadcrumbColumnCount,
    gotoAndWait,
    readFirstMainLayout,
    readSecurityPolicyViolations,
    recordFirstMainLayoutScript,
    waitForBreadcrumbSettled,
    waitForServiceWorkerActive,
    waitForUpdateReady
} from './helpers.mjs';
import { relFromSite } from './paths.mjs';
import { systemPageScenarios } from './system-pages.mjs';
import { siteUpdateNavigationScenarios } from './site-update-navigation.mjs';
import { canvasScenarios } from './canvas.mjs';

const WIDE_VIEWPORT = { width: 1600, height: 1100 };
const BREADCRUMB_FIRST_FRAME_VIEWPORT = { width: 1280, height: 960 };
const EXPECTED_HOME_TITLE = process.env.BANYAN_BROWSER_HOME_TITLE || '';
const ARTICLE_PAGE_PATH = process.env.BANYAN_BROWSER_ARTICLE_PATH || '/about/';
const BREADCRUMB_PRODUCTS_PATH = process.env.BANYAN_BROWSER_BREADCRUMB_PRODUCTS_PATH || '/intent/explore/';
const BREADCRUMB_TAGS_PATH = process.env.BANYAN_BROWSER_BREADCRUMB_TAGS_PATH
    || '/zh/tags/tooling/devtools/';
const BREADCRUMB_TAGS_COLLECTION_HREF = process.env.BANYAN_BROWSER_BREADCRUMB_TAGS_COLLECTION_HREF
    || '/zh/tags/tooling/';
const RUNTIME_JSON_FETCH_PROBE_KEY = 'banyan:browser-regression:runtime-json-fetches';
const BREADCRUMB_FIRST_FRAME_PATH = process.env.BANYAN_BROWSER_BREADCRUMB_FIRST_FRAME_PATH
    || '/p/loop-engineering-digital-life-origin/';
const BREADCRUMB_FIRST_FRAME_FROM = process.env.BANYAN_BROWSER_BREADCRUMB_FIRST_FRAME_FROM
    || '/tags/tooling/';
const BREADCRUMB_WIDE_CANVAS_PATH = process.env.BANYAN_BROWSER_BREADCRUMB_WIDE_CANVAS_PATH
    || '/zh/p/wsl-guide/';
const BREADCRUMB_WIDE_CANVAS_FROM = process.env.BANYAN_BROWSER_BREADCRUMB_WIDE_CANVAS_FROM
    || '/tags/tooling/devtools/windows/wsl';
const BREADCRUMB_COLUMN_SORT_PATH = process.env.BANYAN_BROWSER_BREADCRUMB_COLUMN_SORT_PATH
    || '/zh/p/swaw-kit-git/';
const BREADCRUMB_MULTI_COLUMN_SORT_PATH = process.env.BANYAN_BROWSER_BREADCRUMB_MULTI_COLUMN_SORT_PATH
    || '/zh/p/swaw-kit-wsl-release/';
const BREADCRUMB_COLLECTION_SORT_PATH = process.env.BANYAN_BROWSER_BREADCRUMB_COLLECTION_SORT_PATH
    || '/zh/d/wsl/';
const COMPOSITE_SORT_PATH = process.env.BANYAN_BROWSER_COMPOSITE_SORT_PATH
    || '/zh/intent/explore/';

async function startBreadcrumbContinuityProbe(page, columnIndex = 0) {
    await page.evaluate((targetColumnIndex) => {
        const state = {
            blankObserved: false,
            minimumVisibleRows: Number.POSITIVE_INFINITY,
            running: true,
        };
        window.__banyanBreadcrumbContinuity = state;

        const sample = () => {
            if (!state.running) {
                return;
            }

            const columns = Array.from(document.querySelectorAll(
                '.slot-row-breadcrumb .grid-list--single'
            )).filter((column) => column.querySelector('.collection-column-header'));
            const column = columns[targetColumnIndex];
            const rail = document.querySelector('.slot-row-breadcrumb');
            const railStyle = rail ? getComputedStyle(rail) : null;
            const visibleRows = column
                ? Array.from(column.querySelectorAll('.collection-item-link'))
                    .filter((row) => {
                        const rect = row.getBoundingClientRect();
                        const style = getComputedStyle(row);
                        return rect.width > 0
                            && rect.height > 0
                            && style.display !== 'none'
                            && style.visibility !== 'hidden'
                            && Number(style.opacity || 1) > 0;
                    }).length
                : 0;

            state.minimumVisibleRows = Math.min(state.minimumVisibleRows, visibleRows);
            if (
                !column
                || visibleRows === 0
                || !railStyle
                || railStyle.display === 'none'
                || railStyle.visibility === 'hidden'
                || Number(railStyle.opacity || 1) === 0
            ) {
                state.blankObserved = true;
            }
            requestAnimationFrame(sample);
        };

        requestAnimationFrame(sample);
    }, columnIndex);
}

async function finishBreadcrumbContinuityProbe(page) {
    return page.evaluate(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => (
            requestAnimationFrame(resolve)
        )));
        const state = window.__banyanBreadcrumbContinuity;
        if (!state) {
            return {
                blankObserved: true,
                minimumVisibleRows: 0,
            };
        }
        state.running = false;
        return {
            blankObserved: state.blankObserved,
            minimumVisibleRows: Number.isFinite(state.minimumVisibleRows)
                ? state.minimumVisibleRows
                : 0,
        };
    });
}

async function runBreadcrumbSortInPlace(page, {
    action,
    columnIndex = 0,
}) {
    const documentMarker = await page.evaluate(() => {
        window.__banyanSortDocumentMarker = `${Date.now()}-${Math.random()}`;
        return window.__banyanSortDocumentMarker;
    });
    let navigationRequestCount = 0;
    const onRequest = (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
            navigationRequestCount += 1;
        }
    };

    page.on('request', onRequest);
    await startBreadcrumbContinuityProbe(page, columnIndex);

    let continuity;
    try {
        await action();
        await waitForBreadcrumbSettled(page);
    } finally {
        continuity = await finishBreadcrumbContinuityProbe(page);
        page.off('request', onRequest);
    }

    const markerAfter = await page.evaluate(() => (
        window.__banyanSortDocumentMarker || ''
    ));
    return {
        continuity,
        documentMarker,
        markerAfter,
        navigationRequestCount,
    };
}

function recordFirstBreadcrumbMenuStateScript(targetCollectionHref) {
    window.__banyanFirstBreadcrumbMenuOrder = null;
    window.__banyanFirstBreadcrumbHeaderSpacing = null;

    const findTarget = () => {
        const targetPath = new URL(targetCollectionHref, window.location.origin).pathname;
        return Array.from(document.querySelectorAll(
            '.slot-row-breadcrumb [data-breadcrumb-collection-href]'
        )).find((wrapper) => (
            new URL(wrapper.dataset.breadcrumbCollectionHref, window.location.origin).pathname
                === targetPath
        ));
    };

    const readOrder = () => {
        const target = findTarget();
        return target instanceof HTMLElement
            ? Array.from(target.querySelectorAll('a.breadcrumb-column-link'))
                .map((option) => (option.textContent || '').trim())
                .filter(Boolean)
            : [];
    };

    const readHeaderSpacing = () => {
        const target = findTarget();
        const header = target?.querySelector('.collection-column-header');
        const label = header?.querySelector('.collection-column-label');
        const separator = header?.querySelector('.collection-column-separator');
        const sort = header?.querySelector('.collection-column-sort');
        if (!(header instanceof HTMLElement)
            || !(label instanceof HTMLElement)
            || !(separator instanceof HTMLElement)
            || !(sort instanceof HTMLElement)
            || getComputedStyle(header).display === 'none') {
            return null;
        }

        const labelRect = label.getBoundingClientRect();
        const separatorRect = separator.getBoundingClientRect();
        const sortRect = sort.getBoundingClientRect();
        if (labelRect.width === 0 || separatorRect.width === 0 || sortRect.width === 0) {
            return null;
        }

        const round = (value) => Number(value.toFixed(3));
        return {
            labelToSeparator: round(separatorRect.left - labelRect.right),
            separatorToSort: round(sortRect.left - separatorRect.right)
        };
    };

    window.__banyanReadBreadcrumbMenuOrder = readOrder;
    window.__banyanReadBreadcrumbHeaderSpacing = readHeaderSpacing;
    const observer = new MutationObserver(() => {
        const order = readOrder();
        if (window.__banyanFirstBreadcrumbMenuOrder === null && order.length > 0) {
            window.__banyanFirstBreadcrumbMenuOrder = order;
        }

        const headerSpacing = readHeaderSpacing();
        if (window.__banyanFirstBreadcrumbHeaderSpacing === null && headerSpacing !== null) {
            window.__banyanFirstBreadcrumbHeaderSpacing = headerSpacing;
        }

        if (window.__banyanFirstBreadcrumbMenuOrder !== null
            && window.__banyanFirstBreadcrumbHeaderSpacing !== null) {
            observer.disconnect();
        }
    });
    observer.observe(document, { childList: true, subtree: true });
}

const GRID_LIST_COLUMN_CASES = [
    { id: 'section-wide', path: '/zh/d/', viewport: WIDE_VIEWPORT, compareBreadcrumb: true },
    { id: 'all-wide', path: '/zh/all/', viewport: WIDE_VIEWPORT, compareBreadcrumb: true },
    { id: 'intent-wide', path: '/zh/intent/', viewport: WIDE_VIEWPORT, compareBreadcrumb: true },
    { id: 'tags-wide', path: '/zh/tags/', viewport: WIDE_VIEWPORT, compareBreadcrumb: true },
    { id: 'section-medium', path: '/zh/d/', viewport: { width: 1024, height: 960 } },
    { id: 'section-mobile', path: '/zh/d/', viewport: { width: 390, height: 844 }, horizontalCanvas: true },
    { id: 'products-wide', path: '/zh/products/', viewport: WIDE_VIEWPORT, compareBreadcrumb: true }
];
const DESIGN_AUDIT_VIEWPORTS = [
    {
        id: 'mobile',
        title: 'Mobile',
        viewport: { width: 390, height: 844 }
    },
    {
        id: 'medium',
        title: 'Medium',
        viewport: { width: 1024, height: 960 }
    },
    {
        id: 'wide',
        title: 'Wide',
        viewport: { width: 1440, height: 1100 }
    }
];
const DESIGN_AUDIT_PAGES = [
    {
        id: 'home',
        path: '/',
        title: 'Home',
        waitForSelector: '.slot-main'
    },
    {
        id: 'products',
        path: '/products/',
        title: 'Products',
        waitForSelector: '.grid-list'
    },
    {
        id: 'article',
        path: ARTICLE_PAGE_PATH,
        title: 'Article',
        waitForSelector: '.article'
    }
];

function ensureTwoBuilds(upgradePair) {
    if (!upgradePair?.fromDir || !upgradePair?.toDir) {
        fail('SW upgrade scenarios require two built outputs under temp_workspace/public/.');
    }
}

async function readLanguageSettingsState(page) {
    return page.evaluate(() => {
        const picker = document.querySelector('[data-language-settings]');
        const context = JSON.parse(document.body?.dataset.languageContext || 'null');
        return {
            state: picker?.dataset.languageState || '',
            noTranslationMessage: context?.missing || '',
            languageSuggestionMessage: context?.suggestion || '',
            options: Array.from(picker?.querySelectorAll('[data-language-choice]') || [])
                .map((option) => ({
                    current: option.getAttribute('aria-current') || '',
                    disabled: option.getAttribute('aria-disabled') === 'true',
                    hasTranslation: option.dataset.hasTrans !== 'false',
                    href: option.getAttribute('href') || '',
                    tagName: option.tagName,
                    text: option.textContent?.trim() || '',
                    value: option.dataset.languageChoice || ''
                }))
        };
    });
}

async function installRuntimeJsonFetchProbe(page) {
    await page.addInitScript((storageKey) => {
        const readRecordedFetches = () => {
            try {
                const value = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
                return Array.isArray(value) ? value : [];
            } catch (error) {
                return [];
            }
        };
        const nativeFetch = window.fetch;
        window.__banyanRuntimeJsonFetches = readRecordedFetches();
        window.fetch = function instrumentedFetch(input, init) {
            try {
                const rawUrl = typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.href
                        : input?.url || '';
                const url = new URL(rawUrl, window.location.href);
                if (url.pathname.startsWith('/runtime/') && url.pathname.endsWith('.json')) {
                    window.__banyanRuntimeJsonFetches.push(url.pathname);
                    sessionStorage.setItem(storageKey, JSON.stringify(window.__banyanRuntimeJsonFetches));
                }
            } catch (error) { }

            return nativeFetch.call(this, input, init);
        };
    }, RUNTIME_JSON_FETCH_PROBE_KEY);
}

async function readRuntimeJsonFetchProbe(page) {
    return page.evaluate(() => [...(window.__banyanRuntimeJsonFetches || [])]);
}

async function resetRuntimeJsonFetchProbe(page) {
    await page.evaluate((storageKey) => {
        window.__banyanRuntimeJsonFetches = [];
        sessionStorage.setItem(storageKey, '[]');
    }, RUNTIME_JSON_FETCH_PROBE_KEY);
}

async function settleDesignAuditPage(page) {
    await waitForBreadcrumbSettled(page).catch(() => { });
    await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
}

async function readDesignAuditMetrics(page, viewportId) {
    return page.evaluate((activeViewportId) => {
        const rect = (selector) => {
            const node = document.querySelector(selector);
            if (!(node instanceof HTMLElement)) return null;
            const box = node.getBoundingClientRect();
            return {
                height: box.height,
                width: box.width,
                x: box.x,
                y: box.y
            };
        };
        const navLabels = Array.from(document.querySelectorAll('[data-root-navigation] a'))
            .map((node) => (node.textContent || '').trim())
            .filter(Boolean)
            .slice(0, 16);
        return {
            documentHeight: document.documentElement.scrollHeight,
            hasRailContext: (() => {
                const node = document.querySelector('[data-root-navigation]');
                return node instanceof HTMLElement && getComputedStyle(node).display !== 'none';
            })(),
            main: rect('.slot-main'),
            page: rect('.page'),
            pathname: location.pathname,
            rail: rect('.page-rail'),
            stage: rect('.page-stage'),
            title: document.title,
            navigation: rect('[data-root-navigation]'),
            navigationLabels: navLabels,
            viewportId: activeViewportId,
            visibleBreadcrumb: (() => {
                const node = document.querySelector('.slot-row-breadcrumb');
                if (!(node instanceof HTMLElement)) return false;
                const style = getComputedStyle(node);
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && node.getClientRects().length > 0;
            })()
        };
    }, viewportId);
}

function createDesignAuditScenario(pageConfig, viewportConfig) {
    return {
        id: `design-audit-${pageConfig.id}-${viewportConfig.id}`,
        kind: 'single',
        title: `Design Audit ${pageConfig.title} (${viewportConfig.title})`,
        viewport: viewportConfig.viewport,
        async run({ artifactDir, baseUrl, page }) {
            await gotoAndWait(page, `${baseUrl}${pageConfig.path}`);
            await page.waitForSelector(pageConfig.waitForSelector);
            await settleDesignAuditPage(page);

            const screenshotPath = path.join(artifactDir, 'capture.png');
            await page.screenshot({
                fullPage: true,
                path: screenshotPath
            });

            return {
                artifacts: {
                    screenshot: relFromSite(screenshotPath)
                },
                details: await readDesignAuditMetrics(page, viewportConfig.id),
                message: `Captured ${pageConfig.id} at ${viewportConfig.id}.`
            };
        }
    };
}

function readCspHeader(response) {
    return readResponseHeader(response, 'content-security-policy');
}

function readResponseHeader(response, headerName) {
    if (!response) {
        return '';
    }
    const headers = response.headers();
    return headers[headerName.toLowerCase()] || '';
}

function filterCspConsoleMessages(entries) {
    return entries.filter((entry) => {
        const text = `${entry.text || ''}`.toLowerCase();
        return text.includes('content security policy') || text.includes('csp');
    });
}

function filterPreloadCredentialConsoleMessages(entries) {
    return entries.filter((entry) => {
        const text = `${entry.text || ''}`.toLowerCase();
        return text.includes('preload')
            && text.includes('request credentials mode does not match');
    });
}

function createConsoleRecorder(page, entries) {
    page.on('console', (message) => {
        entries.push({
            text: message.text(),
            type: message.type()
        });
    });
}

function assertCspPolicy(headerValue, details = {}) {
    if (!headerValue) {
        fail('Response did not include Content-Security-Policy.', details);
    }
    if (!headerValue.includes("script-src 'self' 'report-sample'")) {
        fail('CSP is missing the expected script-src baseline.', {
            ...details,
            headerValue
        });
    }
}

function assertAdjacentSecurityHeaders(response, details = {}) {
    const permissionsPolicy = readResponseHeader(response, 'permissions-policy');
    if (!permissionsPolicy) {
        fail('Response did not include Permissions-Policy.', details);
    }
    for (const directive of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()']) {
        if (!permissionsPolicy.includes(directive)) {
            fail('Permissions-Policy is missing an expected denied capability.', {
                ...details,
                directive,
                permissionsPolicy
            });
        }
    }

    const hsts = readResponseHeader(response, 'strict-transport-security');
    if (!hsts) {
        fail('Response did not include Strict-Transport-Security.', details);
    }
    if (!/^max-age=300(?:\s*;|$)/i.test(hsts.trim())) {
        fail('Strict-Transport-Security should remain in the initial ramp-up stage.', {
            ...details,
            hsts
        });
    }
    if (/includeSubDomains|preload/i.test(hsts)) {
        fail('Strict-Transport-Security should not enable includeSubDomains or preload during ramp-up.', {
            ...details,
            hsts
        });
    }

    return {
        hsts,
        permissionsPolicy
    };
}

async function assertServiceWorkerNavigationPreloadDisabled(page) {
    const result = await page.evaluate(async () => {
        const response = await fetch('/sw.js', {
            cache: 'no-store',
            credentials: 'same-origin'
        }).catch(() => null);
        if (!response) {
            return { ok: false, status: 0, text: '' };
        }
        return {
            ok: response.ok,
            status: response.status,
            text: await response.text().catch(() => '')
        };
    });

    if (!result.ok) {
        fail('Unable to read generated sw.js for navigation preload guardrail.', {
            status: result.status
        });
    }
    if (/navigationPreload\s*\.\s*enable\s*\(/.test(result.text)) {
        fail('sw.js should not enable navigation preload while navigation caching is cache-first.');
    }
    if (!/navigationPreload[\s\S]{0,200}\.\s*disable\s*\(/.test(result.text)) {
        fail('sw.js should explicitly disable navigation preload to clean up older active registrations.');
    }
}

async function collectSecurityOutcome(page, response, consoleEntries, extraDetails = {}) {
    const csp = readCspHeader(response);
    assertCspPolicy(csp, extraDetails);
    const adjacentHeaders = assertAdjacentSecurityHeaders(response, extraDetails);

    await page.waitForTimeout(250);
    const violations = await readSecurityPolicyViolations(page);
    const cspConsoleMessages = filterCspConsoleMessages(consoleEntries);
    const preloadCredentialConsoleMessages = filterPreloadCredentialConsoleMessages(consoleEntries);
    if (violations.length > 0) {
        fail('Page triggered SecurityPolicyViolationEvent entries under enforced CSP.', {
            ...extraDetails,
            csp,
            violations
        });
    }
    if (cspConsoleMessages.length > 0) {
        fail('Page emitted CSP-related console messages under enforced CSP.', {
            ...extraDetails,
            consoleMessages: cspConsoleMessages,
            csp
        });
    }
    if (preloadCredentialConsoleMessages.length > 0) {
        fail('Page emitted preload credential mismatch console messages.', {
            ...extraDetails,
            consoleMessages: preloadCredentialConsoleMessages
        });
    }

    return {
        consoleMessageCount: consoleEntries.length,
        cspConsoleMessages,
        csp,
        ...adjacentHeaders,
        preloadCredentialConsoleMessages,
        violations
    };
}

export const designAuditScenarios = DESIGN_AUDIT_PAGES.flatMap((pageConfig) => (
    DESIGN_AUDIT_VIEWPORTS.map((viewportConfig) => createDesignAuditScenario(pageConfig, viewportConfig))
));

export const securityScenarios = [
    {
        id: 'security-csp-enforce-home',
        kind: 'single',
        title: 'Security: CSP Enforce Home',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl }) {
            const consoleEntries = [];
            createConsoleRecorder(page, consoleEntries);
            const response = await gotoAndWait(page, `${baseUrl}/`);
            await page.waitForSelector('.slot-main');

            return collectSecurityOutcome(page, response, consoleEntries, {
                path: '/'
            });
        }
    },
    {
        id: 'security-sw-navigation-preload-disabled',
        kind: 'single',
        title: 'Security: SW Navigation Preload Disabled',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/`);
            await assertServiceWorkerNavigationPreloadDisabled(page);

            return {
                message: 'sw.js disables navigation preload for cache-first navigations.'
            };
        }
    },
    {
        id: 'security-csp-enforce-breadcrumb-wide',
        kind: 'single',
        title: 'Security: CSP Enforce Breadcrumb Wide',
        viewport: WIDE_VIEWPORT,
        async run({ page, baseUrl }) {
            const consoleEntries = [];
            createConsoleRecorder(page, consoleEntries);
            const url = `${baseUrl}${BREADCRUMB_PRODUCTS_PATH}`;
            const response = await gotoAndWait(page, url);
            await page.waitForSelector('.slot-row-breadcrumb');
            await waitForBreadcrumbSettled(page);

            return collectSecurityOutcome(page, response, consoleEntries, {
                path: BREADCRUMB_PRODUCTS_PATH
            });
        }
    }
];

async function readBreadcrumbPrefetchSlotContract(page) {
    return page.evaluate(() => {
        const describeAnchor = (anchor) => ({
            className: anchor.getAttribute('class') || '',
            href: anchor.getAttribute('href') || '',
            slot: anchor.getAttribute('data-prefetch-slot') || '',
            text: (anchor.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
        });

        const breadcrumbAnchors = Array.from(document.querySelectorAll(
            '.slot-breadcrumb a.breadcrumb-column-link[href]'
        ));
        const slotRowAnchors = Array.from(document.querySelectorAll('.slot-row-breadcrumb a[href]'));
        const slotRowBreadcrumbMenuOptions = Array.from(document.querySelectorAll(
            '.slot-row-breadcrumb a.breadcrumb-column-link[href]'
        ));

        const breadcrumbInvalidAnchors = breadcrumbAnchors
            .filter((anchor) => anchor.getAttribute('data-prefetch-slot') !== 'crumb')
            .map(describeAnchor);
        const slotRowNavAnchors = slotRowAnchors
            .filter((anchor) => anchor.getAttribute('data-prefetch-slot') === 'nav')
            .map(describeAnchor);
        const slotRowBreadcrumbMenuOptionsWithoutCrumb = slotRowBreadcrumbMenuOptions
            .filter((anchor) => anchor.getAttribute('data-prefetch-slot') !== 'crumb')
            .map(describeAnchor);

        return {
            breadcrumbAnchorCount: breadcrumbAnchors.length,
            breadcrumbCrumbAnchorCount: breadcrumbAnchors.filter((anchor) => (
                anchor.getAttribute('data-prefetch-slot') === 'crumb'
            )).length,
            breadcrumbInvalidAnchors,
            slotRowAnchorCount: slotRowAnchors.length,
            slotRowBreadcrumbMenuOptionCount: slotRowBreadcrumbMenuOptions.length,
            slotRowBreadcrumbMenuOptionsWithoutCrumb,
            slotRowNavAnchors
        };
    });
}

export const scenarios = [
    ...canvasScenarios,
    ...systemPageScenarios,
    ...siteUpdateNavigationScenarios,
    {
        id: 'root-navigation-contract',
        kind: 'single',
        title: 'Root Navigation: One Complete List from Real Pages',
        serviceWorkers: 'block',
        viewport: WIDE_VIEWPORT,
        async run({ page, baseUrl }) {
            const rootPaths = ['d', 'intent', 'tags', 'all', 'product-categories', 'products',
                'language', 'appearance', 'my', 'site'];
            await gotoAndWait(page, `${baseUrl}/zh/all/`);
            const staticRoots = await page.evaluate(async (paths) => {
                const results = [];
                for (const prefix of ['/', '/zh/', '/zh-tw/']) {
                    const response = await fetch(prefix + 'all/');
                    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                    const navs = doc.querySelectorAll('[data-root-navigation]');
                    const nav = navs[0];
                    results.push({
                        prefix,
                        count: navs.length,
                        expected: paths.map((path) => prefix + path + '/'),
                        hrefs: [...doc.querySelectorAll('[data-root-href]')].map((link) => link.dataset.rootHref),
                        selected: [...doc.querySelectorAll('[data-root-href][aria-current="page"]')]
                            .map((link) => link.dataset.rootHref),
                        home: nav?.querySelector('.collection-list-header a')?.getAttribute('href'),
                        settings: [...doc.querySelectorAll('[data-root-href][data-settings-link]')]
                            .map((link) => link.dataset.rootHref),
                        rowContentCount: nav?.querySelectorAll('.cell-title > .collection-item-link > .collection-item-title').length,
                        oldControls: doc.querySelectorAll('[data-nav-utility-kind], [data-site-version-menu], [data-slot="primary_nav"]').length
                    });
                }
                return results;
            }, rootPaths);
            for (const state of staticRoots) {
                if (state.count !== 1 || JSON.stringify(state.hrefs) !== JSON.stringify(state.expected)
                    || JSON.stringify(state.selected) !== JSON.stringify([state.prefix + 'all/'])
                    || state.home !== state.prefix || state.rowContentCount !== 10 || state.oldControls !== 0
                    || JSON.stringify(state.settings) !== JSON.stringify(rootPaths.slice(6).map((path) => state.prefix + path + '/'))) {
                    fail('Every locale must SSR one weighted root list, its home header and four system links.', state);
                }
            }
            const layouts = [];
            for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 960 }, WIDE_VIEWPORT]) {
                await page.setViewportSize(viewport);
                const state = await page.evaluate(() => {
                    const nav = document.querySelector('[data-root-navigation]');
                    const links = [...nav.querySelectorAll('[data-root-href]')];
                    const footer = document.querySelector('.slot-footer');
                    return {
                        count: document.querySelectorAll('[data-root-navigation]').length,
                        links: links.length,
                        visible: links.every((link) => link.getClientRects().length > 0 && getComputedStyle(link).visibility !== 'hidden'),
                        navBottom: nav.getBoundingClientRect().bottom,
                        footerTop: footer?.getClientRects().length ? footer.getBoundingClientRect().top : null
                    };
                });
                if (state.count !== 1 || state.links !== 10 || !state.visible
                    || (state.footerTop !== null && state.footerTop < state.navBottom - 1)) {
                    fail('The complete root list must remain available without overlapping the footer.', { viewport, ...state });
                }
                layouts.push({ viewport, ...state });
            }
            return { staticRoots, layouts };
        }
    },
    {
        id: 'root-navigation-entry-ownership',
        kind: 'single',
        title: 'Root Selection from Valid Sources and Content Ancestry',
        serviceWorkers: 'block',
        viewport: WIDE_VIEWPORT,
        timeoutMs: 60000,
        async run({ page, baseUrl }) {
            const expectedRoots = ['d', 'intent', 'tags', 'all', 'product-categories', 'products',
                'language', 'appearance', 'my', 'site'].map((root) => `/zh/${root}/`);
            const assertSelection = async (expected) => {
                await waitForBreadcrumbSettled(page);
                const state = await page.evaluate(() => ({
                    roots: [...document.querySelectorAll('[data-root-href]')].map((link) => link.dataset.rootHref),
                    selected: [...document.querySelectorAll('[data-root-href].is-current')].map((link) => link.dataset.rootHref),
                    current: [...document.querySelectorAll('[data-root-href][aria-current="page"]')].map((link) => link.dataset.rootHref)
                }));
                const selected = expected ? [expected] : [];
                if (JSON.stringify(state.roots) !== JSON.stringify(expectedRoots)
                    || JSON.stringify(state.selected) !== JSON.stringify(selected)
                    || JSON.stringify(state.current) !== JSON.stringify(selected)) {
                    fail('Selection must change without replacing the complete root list.', { expected, url: page.url(), ...state });
                }
                return state;
            };
            const directCases = [
                ['/zh/p/xvenv/', '/zh/d/'],
                ['/zh/p/xvenv/?from=products/not-a-source', '/zh/d/'],
                ['/zh/about/', '/zh/site/'],
                ['/zh/changelog/', '/zh/site/'],
                ['/zh/wechat/', '/zh/site/'],
                ['/zh/language/?return=%2Fzh%2Fall%2F', '/zh/language/'],
                ['/zh/appearance/?return=%2Fzh%2Fall%2F', '/zh/appearance/'],
                ['/zh/my/?return=%2Fzh%2Fall%2F', '/zh/my/'],
                ['/zh/site/?return=%2Fzh%2Fall%2F', '/zh/site/'],
                ['/zh/', '']
            ];
            for (const [target, root] of directCases) {
                await gotoAndWait(page, baseUrl + target);
                await assertSelection(root);
            }

            const articlePath = '/zh/p/xvenv/';
            await gotoAndWait(page, baseUrl + articlePath);
            const sources = await page.evaluate(() => JSON.parse(document.body.dataset.entryBreadcrumbSources || '[]'));
            const sourceCases = ['all', 'tags', 'intent'].map((root) => sources.find((source) => (
                source.logical_path === `/${root}/` || source.logical_path.startsWith(`/${root}/`)
            )));
            if (sourceCases.some((source) => !source)) fail('The fixture product must expose all, tags and intent sources.', { sources });
            for (const source of sourceCases) {
                const target = new URL(articlePath, baseUrl);
                target.searchParams.set('from', source.logical_path.replace(/^\/|\/$/g, ''));
                await gotoAndWait(page, target.href);
                await assertSelection(source.root_item.href);
                await page.reload();
                await assertSelection(source.root_item.href);
            }
            await page.goBack();
            await assertSelection(sourceCases[1].root_item.href);
            await page.goForward();
            await assertSelection(sourceCases[2].root_item.href);

            // Keep source selection usable before external bundles finish loading.
            await page.addInitScript(() => {
                window.__banyanRootDomContentLoaded = false;
                document.addEventListener('DOMContentLoaded', () => { window.__banyanRootDomContentLoaded = true; });
            });
            await page.route('**/js/*.js', async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 1200));
                await route.continue();
            });
            const firstPaintCases = [
                ['/zh/p/xvenv/?from=product-categories/free', '/zh/product-categories/'],
                ['/zh/p/xvenv/?from=%2Fproduct-categories%2Ffree%2F', '/zh/product-categories/'],
                ['/zh/p/xvenv/', '/zh/d/'],
                ['/zh/p/xvenv/?from=products/not-a-source', '/zh/d/'],
                ['/zh/language/?return=' + encodeURIComponent('/zh/p/xvenv/?from=product-categories/free'), '/zh/language/']
            ];
            const firstPaintStates = [];
            for (const [target, expectedRoot] of firstPaintCases) {
                await page.goto(baseUrl + target, { waitUntil: 'commit' });
                await page.waitForSelector('.slot-main', { state: 'visible' });
                const firstPaint = await page.evaluate(() => ({
                    domContentLoaded: window.__banyanRootDomContentLoaded,
                    selected: [...document.querySelectorAll('[data-root-href].is-current')].map((link) => link.dataset.rootHref),
                    rootCount: document.querySelectorAll('[data-root-href]').length
                }));
                if (firstPaint.domContentLoaded || firstPaint.rootCount !== 10
                    || JSON.stringify(firstPaint.selected) !== JSON.stringify([expectedRoot])) {
                    fail('The complete root list and source selection must be correct before deferred scripts load.',
                        { target, expectedRoot, ...firstPaint });
                }
                await page.waitForLoadState('domcontentloaded');
                await assertSelection(expectedRoot);
                firstPaintStates.push({ target, ...firstPaint });
            }
            await page.unroute('**/js/*.js');
            return { directCases, firstPaintStates, sources: sourceCases.map((source) => source.logical_path) };
        }
    },
    {
        id: 'home-shell-smoke',
        kind: 'single',
        title: 'Home Shell Smoke',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/`);
            const title = await page.title();
            if (EXPECTED_HOME_TITLE && !title.includes(EXPECTED_HOME_TITLE)) {
                fail('Home page title did not contain the expected configured text.', {
                    expected: EXPECTED_HOME_TITLE,
                    title
                });
            }
            if (!EXPECTED_HOME_TITLE && !title) {
                fail('Home page title was empty.', { title });
            }
            const breadcrumbRuntimeCount = await page.locator('script[src*="breadcrumb-runtime"]').count();
            if (breadcrumbRuntimeCount !== 0) {
                fail('Home page should not load breadcrumb-runtime.', { breadcrumbRuntimeCount });
            }
            return {
                breadcrumbRuntimeCount,
                title
            };
        }
    },
    {
        id: 'products-category-entry-lineage',
        kind: 'single',
        title: 'Products Category and All Entry Lineage',
        viewport: WIDE_VIEWPORT,
        async run({ page, baseUrl }) {
            const categoriesPath = '/product-categories/';
            await gotoAndWait(page, `${baseUrl}${categoriesPath}`);
            const categoryHrefs = await page.locator('.slot-main .collection-item-link').evaluateAll(
                (links) => links.map((link) => new URL(link.href).pathname)
            );
            const expectedCategories = ['free', 'paid', 'first-party', 'third-party']
                .map((category) => `${categoriesPath}${category}/`);
            if (JSON.stringify(categoryHrefs) !== JSON.stringify(expectedCategories)) {
                fail('Product categories must be four siblings in page-weight order.', { categoryHrefs });
            }

            // Discover an existing product so the regression does not depend on a product slug.
            await gotoAndWait(page, `${baseUrl}/products/`);
            const productLink = page.locator('.slot-main .grid-products .collection-item-link').first();
            const productHref = await productLink.getAttribute('href');
            if (!productHref) fail('Product lineage verification requires one real product.');
            const productPath = new URL(productHref, baseUrl).pathname;
            const sources = await page.evaluate(async (href) => {
                const response = await fetch(href);
                const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                return JSON.parse(doc.body.dataset.entryBreadcrumbSources || '[]');
            }, productPath);
            const categorySource = sources.find((source) => source.provider === 'products'
                && source.logical_path.startsWith('/product-categories/'));
            if (!categorySource) fail('A real product must belong to a price and origin category.');

            const results = [];
            for (const collectionPath of ['/products/', categorySource.logical_path]) {
                await gotoAndWait(page, `${baseUrl}${collectionPath}?sort=price-desc`);
                const target = page.locator(`.slot-main .grid-products .collection-item-link[href^="${productPath}?"]`);
                await target.click();
                await page.waitForURL((url) => url.pathname === productPath);
                await waitForBreadcrumbSettled(page);
                const assertSelection = async () => {
                    const state = await page.evaluate(() => ({
                        from: new URL(location.href).searchParams.get('from'),
                        root: document.querySelector('[data-root-navigation] [data-root-href].is-current')?.dataset.rootHref,
                        selected: [...document.querySelectorAll('.slot-breadcrumb .collection-item-link.is-current')]
                            .map((link) => new URL(link.href).pathname),
                        categories: [...document.querySelectorAll('.slot-breadcrumb .collection-item-link')]
                            .map((link) => new URL(link.href).pathname)
                            .filter((href) => href.startsWith('/product-categories/')),
                        currentSort: document.querySelector('.slot-breadcrumb .collection-column-sort')?.textContent
                    }));
                    const expectedRoot = collectionPath === '/products/' ? '/products/' : categoriesPath;
                    if (state.from !== collectionPath.replace(/^\/|\/$/g, '')
                        || state.root !== expectedRoot
                        || !state.selected.includes(productPath)
                        || !state.currentSort?.includes('↓')) {
                        fail('Opening a product must preserve its source root, selected row and descending sort.', state);
                    }
                    if (expectedRoot === categoriesPath
                        && (JSON.stringify(state.categories) !== JSON.stringify(expectedCategories)
                            || !state.selected.includes(collectionPath))) {
                        fail('Category siblings and selection must survive entry breadcrumb hydration.', state);
                    }
                    return state;
                };
                results.push(await assertSelection());
                await page.reload();
                await waitForBreadcrumbSettled(page);
                await assertSelection();
                await page.goBack();
                await page.waitForURL((url) => url.pathname === collectionPath);
                if (new URL(page.url()).searchParams.get('sort') !== 'price-desc') {
                    fail('Back navigation must restore the product list sort.', { url: page.url() });
                }
                await page.goForward();
                await waitForBreadcrumbSettled(page);
                await assertSelection();
            }
            return { productPath, results };
        }
    },
    {
        id: 'breadcrumb-products-wide-stability',
        kind: 'single',
        title: 'Breadcrumb Wide Stability (Products)',
        viewport: WIDE_VIEWPORT,
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}${BREADCRUMB_PRODUCTS_PATH}`);
            await page.waitForSelector('.slot-row-breadcrumb');
            await waitForBreadcrumbSettled(page);
            const mainX1 = await getMainInlineStart(page);
            await page.waitForTimeout(800);
            const mainX2 = await getMainInlineStart(page);
            const cls = await getLayoutShiftValue(page);
            const delta = mainX1 !== null && mainX2 !== null ? Math.abs(mainX2 - mainX1) : null;
            if (delta !== null && delta > 1) {
                fail('Main column shifted after breadcrumb settled.', { mainX1, mainX2, delta });
            }
            if (cls > 0.1) {
                fail('Wide breadcrumb path caused excessive layout shift.', { cls });
            }
            return { cls, mainX1, mainX2, delta };
        }
    },
    {
        id: 'collection-composite-sort-direction',
        kind: 'single',
        title: 'Collection Composite Sort Direction',
        viewport: { width: 1280, height: 960 },
        async run({ page, baseUrl }) {
            const url = new URL(COMPOSITE_SORT_PATH, `${baseUrl}/`);
            await gotoAndWait(page, url.href);
            const gridSelector = '.slot-main [data-sortable="true"][data-sort-variant="tree"]';
            const dateToggleSelector = `${gridSelector} [data-sort-control="true"][data-sort-field="date"]`;
            await page.waitForSelector(dateToggleSelector);

            const readState = () => page.evaluate((selector) => {
                const grid = document.querySelector(selector);
                const rows = Array.from(
                    grid?.querySelectorAll('.cell-title:not(.header)') || []
                ).map((head) => ({
                    dateKey: head.getAttribute('data-sort-date') || '',
                    dateText: head.nextElementSibling?.textContent?.trim() || '',
                    title: head.querySelector('.collection-item-title')?.textContent?.trim() || '',
                }));
                return {
                    rows,
                    search: window.location.search,
                };
            }, gridSelector);

            const before = await readState();
            if (before.rows.length < 3 || before.rows.some((row) => !row.title)) {
                fail('Composite sorting scenario requires at least three named taxonomy rows.', {
                    before,
                    path: COMPOSITE_SORT_PATH,
                });
            }
            if (before.rows.some((row) => row.dateKey && !/^\d{14}$/.test(row.dateKey))) {
                fail('Taxonomy machine date keys must preserve second-level precision.', {
                    before,
                    path: COMPOSITE_SORT_PATH,
                });
            }

            const documentMarker = await page.evaluate(() => {
                window.__banyanCompositeSortMarker = `${Date.now()}-${Math.random()}`;
                return window.__banyanCompositeSortMarker;
            });
            let navigationRequestCount = 0;
            const onRequest = (request) => {
                if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
                    navigationRequestCount += 1;
                }
            };
            page.on('request', onRequest);

            try {
                await page.locator(dateToggleSelector).click();
                await page.waitForFunction(({ selector, beforeTitles }) => {
                    const titles = Array.from(
                        document.querySelector(selector)
                            ?.querySelectorAll('.cell-title:not(.header)') || []
                    ).map((head) => (
                        head.querySelector('.collection-item-title')?.textContent?.trim() || ''
                    ));
                    return new URL(window.location.href).searchParams.get('sort') === 'date-asc'
                        && JSON.stringify(titles) !== JSON.stringify(beforeTitles);
                }, {
                    selector: gridSelector,
                    beforeTitles: before.rows.map((row) => row.title),
                });

                const ascending = await readState();
                const expectedAscendingTitles = before.rows
                    .map((row) => row.title)
                    .reverse();
                if (
                    JSON.stringify(ascending.rows.map((row) => row.title))
                    !== JSON.stringify(expectedAscendingTitles)
                ) {
                    fail('Ascending sort must reverse the complete descending tuple.', {
                        ascending,
                        before,
                    });
                }

                await page.locator(dateToggleSelector).click();
                await page.waitForFunction(({ selector, expectedTitles }) => {
                    const titles = Array.from(
                        document.querySelector(selector)
                            ?.querySelectorAll('.cell-title:not(.header)') || []
                    ).map((head) => (
                        head.querySelector('.collection-item-title')?.textContent?.trim() || ''
                    ));
                    return !new URL(window.location.href).searchParams.has('sort')
                        && JSON.stringify(titles) === JSON.stringify(expectedTitles);
                }, {
                    selector: gridSelector,
                    expectedTitles: before.rows.map((row) => row.title),
                });
            } finally {
                page.off('request', onRequest);
            }

            const after = await readState();
            const markerAfter = await page.evaluate(() => (
                window.__banyanCompositeSortMarker || ''
            ));
            if (
                navigationRequestCount !== 0
                || markerAfter !== documentMarker
                || after.search !== before.search
                || JSON.stringify(after.rows) !== JSON.stringify(before.rows)
            ) {
                fail('Composite sorting must be reversible in the current document.', {
                    after,
                    before,
                    documentMarker,
                    markerAfter,
                    navigationRequestCount,
                });
            }

            return {
                after,
                before,
                navigationRequestCount,
                path: COMPOSITE_SORT_PATH,
            };
        }
    },
    {
        id: 'breadcrumb-wide-first-frame-stability',
        kind: 'single',
        title: 'Breadcrumb Wide First-frame Stability',
        viewport: BREADCRUMB_FIRST_FRAME_VIEWPORT,
        async run({ page, baseUrl }) {
            await page.addInitScript(recordFirstMainLayoutScript());
            const readDirectoryMeta = () => page.evaluate(() => {
                const node = document.querySelector('.post-taxonomy-path');
                return node ? {
                    ariaLabel: node.getAttribute('aria-label'),
                    html: node.innerHTML
                } : null;
            });

            const defaultUrl = new URL(BREADCRUMB_FIRST_FRAME_PATH, `${baseUrl}/`);
            await gotoAndWait(page, defaultUrl.href);
            await page.waitForSelector('.slot-row-breadcrumb');
            await waitForBreadcrumbSettled(page);
            const defaultColumnCount = await getVisibleBreadcrumbColumnCount(page);
            const defaultDirectoryMeta = await readDirectoryMeta();

            const transitionUrl = new URL(defaultUrl.href);
            transitionUrl.searchParams.set('from', BREADCRUMB_FIRST_FRAME_FROM);
            await gotoAndWait(page, transitionUrl.href);
            await page.waitForSelector('.slot-row-breadcrumb');

            const firstLayout = await readFirstMainLayout(page);
            await waitForBreadcrumbSettled(page);
            const finalMainInlineStart = await getMainInlineStart(page);
            const finalColumnCount = await getVisibleBreadcrumbColumnCount(page);
            const finalDirectoryMeta = await readDirectoryMeta();
            const delta = finalMainInlineStart === null
                ? null
                : Math.abs(finalMainInlineStart - firstLayout.mainInlineStart);
            if (!firstLayout.previewPending || !firstLayout.runtimePending) {
                fail('First-frame scenario did not capture a pending from-based breadcrumb.', {
                    firstLayout,
                    transitionUrl: transitionUrl.href
                });
            }
            if (defaultColumnCount === finalColumnCount) {
                fail('First-frame scenario requires different SSR/default and from-based breadcrumb column counts.', {
                    defaultColumnCount,
                    finalColumnCount,
                    from: BREADCRUMB_FIRST_FRAME_FROM,
                    path: BREADCRUMB_FIRST_FRAME_PATH
                });
            }
            if (firstLayout.breadcrumbColumnCount !== finalColumnCount) {
                fail('Breadcrumb skeleton did not reserve the final wide column count before main parsed.', {
                    defaultColumnCount,
                    finalColumnCount,
                    firstLayout
                });
            }
            if (delta === null || delta > 1) {
                fail('Main column shifted between its first parsed layout and the settled breadcrumb.', {
                    delta,
                    finalMainInlineStart,
                    firstLayout
                });
            }
            if (
                defaultDirectoryMeta === null
                || JSON.stringify(defaultDirectoryMeta) !== JSON.stringify(finalDirectoryMeta)
            ) {
                fail('Entry lineage must not rewrite static article directory metadata.', {
                    defaultDirectoryMeta,
                    finalDirectoryMeta,
                    transitionUrl: transitionUrl.href
                });
            }

            return {
                defaultColumnCount,
                delta,
                finalColumnCount,
                finalMainInlineStart,
                firstLayout,
                directoryMeta: finalDirectoryMeta,
                from: BREADCRUMB_FIRST_FRAME_FROM,
                path: BREADCRUMB_FIRST_FRAME_PATH
            };
        }
    },
    {
        id: 'breadcrumb-column-sort-toggle',
        kind: 'single',
        title: 'Breadcrumb Column Sort Toggle',
        viewport: { width: 1280, height: 960 },
        async run({ page, baseUrl }) {
            const url = new URL(BREADCRUMB_COLUMN_SORT_PATH, `${baseUrl}/`);
            url.searchParams.set('from', 'all');
            await gotoAndWait(page, url.href);
            await page.waitForSelector('.slot-breadcrumb .collection-column-header');
            await waitForBreadcrumbSettled(page);

            const readState = () => page.evaluate(() => {
                const panel = document.querySelector('.slot-breadcrumb .collection-list--column');
                const header = panel?.querySelector('.collection-column-header');
                const toggle = header?.querySelector('[data-collection-sort-toggle="true"]');
                const rows = Array.from(panel?.querySelectorAll('.collection-item-link') || []);
                const rowTitles = rows
                    .map((row) => row.querySelector('.collection-item-title')?.textContent?.trim() || '')
                    .filter(Boolean);
                return {
                    field: header?.querySelector('.collection-sort-label')?.textContent?.trim() || '',
                    indicator: header?.querySelector('.collection-sort-indicator')?.textContent?.trim() || '',
                    iconCount: panel?.querySelectorAll('.collection-item-icon-svg').length || 0,
                    embeddedSourceCount: document.querySelectorAll(
                        '[data-breadcrumb-collection-source]'
                    ).length,
                    firstTitle: rowTitles[0] || '',
                    href: toggle?.getAttribute('href') || '',
                    invalidPrefetchCount: Array.from(panel?.querySelectorAll('a') || [])
                        .filter((link) => link.dataset.prefetchSlot !== 'crumb')
                        .length,
                    label: header?.querySelector('.collection-column-label')?.textContent?.trim() || '',
                    rowCount: rows.length,
                    toggleFocused: document.activeElement === toggle,
                    wrappedRowCount: rows.filter((row) => row.getBoundingClientRect().height > 24).length,
                };
            });

            const before = await readState();
            if (!before.label || !before.field || before.indicator !== '↓') {
                fail('Column header must expose collection context and the active descending sort.', before);
            }
            if (before.iconCount !== before.rowCount || before.rowCount === 0) {
                fail('Column rows must share the collection-list icon anatomy.', before);
            }
            if (before.embeddedSourceCount > 0) {
                fail('Column source metadata must be resolved from the page registry instead of repeated per DOM.', before);
            }
            if (before.wrappedRowCount > 0) {
                fail('Wide column rows must remain single-line and scan-friendly.', before);
            }
            if (before.invalidPrefetchCount > 0) {
                fail('Column header and rows must keep breadcrumb prefetch ownership.', before);
            }

            const toggle = page.locator('.slot-breadcrumb [data-collection-sort-toggle="true"]');
            if (await toggle.count() !== 1) {
                fail('Column view must expose exactly one direction toggle for its active field.', before);
            }
            const inPlace = await runBreadcrumbSortInPlace(page, {
                action: async () => {
                    await toggle.click();
                    await page.waitForFunction((firstTitle) => {
                        const currentUrl = new URL(window.location.href);
                        const panel = document.querySelector(
                            '.slot-breadcrumb .collection-list--column'
                        );
                        const nextFirstTitle = panel
                            ?.querySelector('.collection-item-title')
                            ?.textContent
                            ?.trim() || '';
                        return currentUrl.searchParams.get('sorts') === 'date-asc'
                            && nextFirstTitle
                            && nextFirstTitle !== firstTitle;
                    }, before.firstTitle);
                },
            });
            const {
                continuity,
                documentMarker,
                markerAfter,
                navigationRequestCount,
            } = inPlace;
            const after = await readState();
            const currentUrl = new URL(page.url());

            if (after.field !== before.field || after.indicator !== '↑') {
                fail('Column toggle must keep the active field and change only its direction.', {
                    after,
                    before,
                    url: currentUrl.href
                });
            }
            if (
                currentUrl.searchParams.get('from') !== 'all'
                || currentUrl.searchParams.has('sort')
                || currentUrl.searchParams.get('sorts') !== 'date-asc'
            ) {
                fail('Column toggle URL did not preserve lineage and write the next sort direction.', {
                    after,
                    before,
                    url: currentUrl.href
                });
            }
            if (!after.firstTitle || after.firstTitle === before.firstTitle) {
                fail('Column rows did not reflect the toggled sort direction.', { after, before });
            }
            if (!after.toggleFocused) {
                fail('Column sorting must restore focus to the replacement toggle.', {
                    after,
                    before,
                });
            }
            if (
                navigationRequestCount !== 0
                || markerAfter !== documentMarker
                || continuity.blankObserved
                || continuity.minimumVisibleRows < 1
            ) {
                fail('Column sorting must update in place without navigation or a blank frame.', {
                    continuity,
                    documentMarker,
                    markerAfter,
                    navigationRequestCount,
                });
            }

            return {
                after,
                before,
                continuity,
                navigationRequestCount,
                url: currentUrl.href,
            };
        }
    },
    {
        id: 'breadcrumb-multi-column-sort-isolation',
        kind: 'single',
        title: 'Breadcrumb Multi-column Sort Isolation',
        viewport: { width: 1280, height: 960 },
        async run({ page, baseUrl }) {
            const initialUrl = new URL(BREADCRUMB_MULTI_COLUMN_SORT_PATH, `${baseUrl}/`);
            initialUrl.searchParams.set('from', 'd/wsl');

            const readColumns = () => page.evaluate(() => (
                Array.from(document.querySelectorAll('.slot-row-breadcrumb .grid-list--single'))
                    .filter((column) => column.querySelector('.collection-column-header'))
                    .map((column) => ({
                        indicator: column.querySelector('.collection-sort-indicator')?.textContent?.trim() || '',
                        label: column.querySelector('.collection-column-label')?.textContent?.trim() || '',
                        rows: Array.from(column.querySelectorAll('.collection-item-title'))
                            .map((item) => item.textContent?.trim() || '')
                            .filter(Boolean),
                        toggleHref: column.querySelector('[data-collection-sort-toggle="true"]')
                            ?.getAttribute('href') || '',
                    }))
            ));
            const openInitialState = async () => {
                await gotoAndWait(page, initialUrl.href);
                await page.waitForSelector('.slot-row-breadcrumb .collection-column-header');
                await waitForBreadcrumbSettled(page);
                const columns = await readColumns();
                if (columns.length !== 2 || columns.some((column) => column.indicator !== '↓')) {
                    fail('Multi-column sort scenario requires two independently descending columns.', {
                        columns,
                        url: page.url()
                    });
                }
                return columns;
            };

            const initialBeforeChild = await openInitialState();
            const childToggle = page.locator(
                '.slot-row-breadcrumb [data-collection-sort-toggle="true"]'
            ).nth(1);
            const childInPlace = await runBreadcrumbSortInPlace(page, {
                action: async () => {
                    await childToggle.click();
                    await page.waitForFunction((beforeRows) => {
                        const columns = Array.from(document.querySelectorAll(
                            '.slot-row-breadcrumb .grid-list--single'
                        )).filter((column) => (
                            column.querySelector('.collection-column-header')
                        ));
                        const rows = Array.from(
                            columns[1]?.querySelectorAll('.collection-item-title') || []
                        ).map((item) => item.textContent?.trim() || '').filter(Boolean);
                        return new URL(window.location.href).searchParams.get('sorts')
                                === '_,date-asc'
                            && JSON.stringify(rows) !== JSON.stringify(beforeRows);
                    }, initialBeforeChild[1]?.rows || []);
                },
                columnIndex: 1,
            });
            const {
                continuity: childContinuity,
                documentMarker: childDocumentMarker,
                markerAfter: childMarkerAfter,
                navigationRequestCount: childNavigationRequestCount,
            } = childInPlace;
            const afterChild = await readColumns();
            const childUrl = new URL(page.url());

            if (
                childUrl.searchParams.get('from') !== 'd/wsl'
                || childUrl.searchParams.has('sort')
                || childUrl.searchParams.get('sorts') !== '_,date-asc'
            ) {
                fail('Deepest column toggle must preserve lineage and update only its slot.', {
                    afterChild,
                    url: childUrl.href
                });
            }
            if (
                childNavigationRequestCount !== 0
                || childMarkerAfter !== childDocumentMarker
                || childContinuity.blankObserved
                || childContinuity.minimumVisibleRows < 1
            ) {
                fail('Deepest column sorting must stay visible in the same document.', {
                    childContinuity,
                    childDocumentMarker,
                    childMarkerAfter,
                    childNavigationRequestCount,
                });
            }
            if (
                afterChild[0]?.indicator !== '↓'
                || afterChild[1]?.indicator !== '↑'
                || JSON.stringify(afterChild[0]?.rows) !== JSON.stringify(initialBeforeChild[0]?.rows)
                || JSON.stringify(afterChild[1]?.rows) === JSON.stringify(initialBeforeChild[1]?.rows)
            ) {
                fail('Deepest column sorting leaked into its ancestor column.', {
                    after: afterChild,
                    before: initialBeforeChild,
                    url: childUrl.href
                });
            }

            const initialBeforeAncestor = await openInitialState();
            const ancestorToggle = page.locator(
                '.slot-row-breadcrumb [data-collection-sort-toggle="true"]'
            ).first();
            const ancestorInPlace = await runBreadcrumbSortInPlace(page, {
                action: async () => {
                    await ancestorToggle.click();
                    await page.waitForFunction((beforeRows) => {
                        const columns = Array.from(document.querySelectorAll(
                            '.slot-row-breadcrumb .grid-list--single'
                        )).filter((column) => (
                            column.querySelector('.collection-column-header')
                        ));
                        const rows = Array.from(
                            columns[0]?.querySelectorAll('.collection-item-title') || []
                        ).map((item) => item.textContent?.trim() || '').filter(Boolean);
                        return new URL(window.location.href).searchParams.get('sorts')
                                === 'date-asc,_'
                            && JSON.stringify(rows) !== JSON.stringify(beforeRows);
                    }, initialBeforeAncestor[0]?.rows || []);
                },
            });
            const {
                continuity: ancestorContinuity,
                documentMarker: ancestorDocumentMarker,
                markerAfter: ancestorMarkerAfter,
                navigationRequestCount: ancestorNavigationRequestCount,
            } = ancestorInPlace;
            const afterAncestor = await readColumns();
            const ancestorUrl = new URL(page.url());

            if (
                ancestorUrl.searchParams.get('from') !== 'd/wsl'
                || ancestorUrl.searchParams.has('sort')
                || ancestorUrl.searchParams.get('sorts') !== 'date-asc,_'
            ) {
                fail('Ancestor column toggle must preserve the full lineage and update only its slot.', {
                    afterAncestor,
                    url: ancestorUrl.href
                });
            }
            if (
                afterAncestor[0]?.indicator !== '↑'
                || afterAncestor[1]?.indicator !== '↓'
                || JSON.stringify(afterAncestor[0]?.rows) === JSON.stringify(initialBeforeAncestor[0]?.rows)
                || JSON.stringify(afterAncestor[1]?.rows) !== JSON.stringify(initialBeforeAncestor[1]?.rows)
            ) {
                fail('Ancestor column sorting failed or leaked into the deepest column.', {
                    after: afterAncestor,
                    before: initialBeforeAncestor,
                    url: ancestorUrl.href
                });
            }
            if (
                ancestorNavigationRequestCount !== 0
                || ancestorMarkerAfter !== ancestorDocumentMarker
                || ancestorContinuity.blankObserved
                || ancestorContinuity.minimumVisibleRows < 1
            ) {
                fail('Ancestor column sorting must stay visible in the same document.', {
                    ancestorContinuity,
                    ancestorDocumentMarker,
                    ancestorMarkerAfter,
                    ancestorNavigationRequestCount,
                });
            }

            return {
                afterAncestor,
                afterChild,
                ancestorContinuity,
                ancestorNavigationRequestCount,
                ancestorUrl: ancestorUrl.href,
                childContinuity,
                childNavigationRequestCount,
                childUrl: childUrl.href
            };
        }
    },
    {
        id: 'breadcrumb-collection-sort-isolation',
        kind: 'single',
        title: 'Breadcrumb and Collection Sort Isolation',
        viewport: { width: 1280, height: 960 },
        async run({ page, baseUrl }) {
            const url = new URL(BREADCRUMB_COLLECTION_SORT_PATH, `${baseUrl}/`);
            url.searchParams.set('from', 'd');
            url.searchParams.set('sort', 'date-asc');
            url.searchParams.set('sorts', 'date-asc');
            await gotoAndWait(page, url.href);
            await page.waitForSelector(
                '.slot-row-breadcrumb [data-collection-sort-toggle="true"]'
            );
            await waitForBreadcrumbSettled(page);

            const readState = () => page.evaluate(() => {
                const column = Array.from(document.querySelectorAll(
                    '.slot-row-breadcrumb .grid-list--single'
                )).find((candidate) => candidate.querySelector('.collection-column-header'));
                const mainGrid = document.querySelector(
                    '.slot-main [data-sortable="true"][data-sort-variant]'
                );
                return {
                    columnRows: Array.from(
                        column?.querySelectorAll('.collection-item-title') || []
                    ).map((item) => item.textContent?.trim() || '').filter(Boolean),
                    mainHrefs: Array.from(
                        mainGrid?.querySelectorAll('.cell-title:not(.header) .collection-item-link')
                            || []
                    ).map((item) => item.getAttribute('href') || '').filter(Boolean),
                    mainRows: Array.from(
                        mainGrid?.querySelectorAll('.cell-title:not(.header) .collection-item-title')
                            || []
                    ).map((item) => item.textContent?.trim() || '').filter(Boolean),
                };
            });

            const before = await readState();
            if (before.columnRows.length < 2 || before.mainRows.length < 2) {
                fail('Collection isolation scenario requires sortable column and main rows.', {
                    before,
                    url: page.url(),
                });
            }
            if (
                before.mainHrefs.length === 0
                || new URL(before.mainHrefs[0], url).searchParams.get('sorts')
                    !== 'date-asc,date-asc'
            ) {
                fail('Main entry links must retain both ancestor and active collection sorts.', {
                    before,
                    url: page.url(),
                });
            }

            const inPlace = await runBreadcrumbSortInPlace(page, {
                action: async () => {
                    await page.locator(
                        '.slot-row-breadcrumb [data-collection-sort-toggle="true"]'
                    ).first().click();
                    await page.waitForFunction((beforeRows) => {
                        const currentUrl = new URL(window.location.href);
                        const column = Array.from(document.querySelectorAll(
                            '.slot-row-breadcrumb .grid-list--single'
                        )).find((candidate) => (
                            candidate.querySelector('.collection-column-header')
                        ));
                        const rows = Array.from(
                            column?.querySelectorAll('.collection-item-title') || []
                        ).map((item) => item.textContent?.trim() || '').filter(Boolean);
                        return currentUrl.searchParams.get('sort') === 'date-asc'
                            && !currentUrl.searchParams.has('sorts')
                            && JSON.stringify(rows) !== JSON.stringify(beforeRows);
                    }, before.columnRows);
                },
            });
            const {
                continuity,
                documentMarker,
                markerAfter,
                navigationRequestCount,
            } = inPlace;

            const after = await readState();
            const currentUrl = new URL(page.url());

            if (
                currentUrl.searchParams.get('from') !== 'd'
                || currentUrl.searchParams.get('sort') !== 'date-asc'
                || currentUrl.searchParams.has('sorts')
            ) {
                fail('Breadcrumb toggle must preserve the collection sort and reset only sorts.', {
                    after,
                    before,
                    url: currentUrl.href,
                });
            }
            if (
                JSON.stringify(after.mainRows) !== JSON.stringify(before.mainRows)
                || JSON.stringify(after.columnRows) === JSON.stringify(before.columnRows)
            ) {
                fail('Breadcrumb sorting changed the main grid or failed to change its own column.', {
                    after,
                    before,
                });
            }
            if (
                after.mainHrefs.length === 0
                || new URL(after.mainHrefs[0], currentUrl).searchParams.get('sorts')
                    !== '_,date-asc'
            ) {
                fail('Main entry links must reflect the updated ancestor slot without losing active sort.', {
                    after,
                    before,
                });
            }
            if (
                navigationRequestCount !== 0
                || markerAfter !== documentMarker
                || continuity.blankObserved
                || continuity.minimumVisibleRows < 1
            ) {
                fail('Collection-page breadcrumb sorting must remain visible in the same document.', {
                    continuity,
                    documentMarker,
                    markerAfter,
                    navigationRequestCount,
                });
            }

            return {
                after,
                before,
                continuity,
                navigationRequestCount,
                url: currentUrl.href,
            };
        }
    },
    {
        id: 'breadcrumb-wide-horizontal-canvas',
        kind: 'single',
        title: 'Breadcrumb Wide Horizontal Canvas',
        viewport: { width: 1280, height: 960 },
        async run({ page, baseUrl }) {
            const url = new URL(BREADCRUMB_WIDE_CANVAS_PATH, `${baseUrl}/`);
            url.searchParams.set('from', BREADCRUMB_WIDE_CANVAS_FROM);
            await gotoAndWait(page, url.href);
            await page.waitForSelector('.slot-row-breadcrumb');
            await waitForBreadcrumbSettled(page);

            const geometry = await page.evaluate(() => {
                const breadcrumb = document.querySelector('.slot-row-breadcrumb');
                const main = document.querySelector('.slot-main');
                const scrollingElement = document.scrollingElement;
                const visibleColumns = Array.from(breadcrumb.querySelectorAll('.breadcrumb-column'))
                    .filter((column) => {
                        const rect = column.getBoundingClientRect();
                        const style = getComputedStyle(column);
                        return style.display !== 'none'
                            && style.visibility !== 'hidden'
                            && rect.width > 0
                            && rect.height > 0;
                    });
                const probe = document.createElement('div');
                probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;block-size:0;padding:0;border:0';
                document.body.appendChild(probe);
                const measureInline = (value) => {
                    probe.style.inlineSize = value;
                    return probe.getBoundingClientRect().width;
                };
                const expectedColumnInline = measureInline('15rem');
                const columnInline = measureInline('var(--breadcrumb-column-inline)');
                const gapInline = measureInline('var(--breadcrumb-gap-inline)');
                const mainInline = measureInline('var(--breadcrumb-main-inline)');
                const railCurrent = document.querySelector('[data-root-navigation] .is-current');
                const railRect = railCurrent?.getBoundingClientRect();
                const columnRects = visibleColumns.map((column) => column.getBoundingClientRect());
                const breadcrumbGaps = columnRects.slice(1).map((rect, index) => (
                    rect.left - columnRects[index].right
                ));
                probe.remove();

                return {
                    breadcrumbClientWidth: breadcrumb.clientWidth,
                    breadcrumbOffsetWidth: breadcrumb.offsetWidth,
                    breadcrumbScrollWidth: breadcrumb.scrollWidth,
                    breadcrumbGaps,
                    breadcrumbToMainGap: columnRects.length > 0
                        ? main.getBoundingClientRect().left - columnRects[columnRects.length - 1].right
                        : 0,
                    columnInline,
                    columnWidths: columnRects.map((rect) => rect.width),
                    documentClientWidth: scrollingElement?.clientWidth || 0,
                    documentScrollWidth: scrollingElement?.scrollWidth || 0,
                    expectedColumnInline,
                    gapInline,
                    mainInline,
                    mainWidth: main.getBoundingClientRect().width,
                    railToBreadcrumbGap: railRect && columnRects.length > 0
                        ? columnRects[0].left - railRect.right
                        : 0,
                    visibleColumnCount: visibleColumns.length
                };
            });

            if (geometry.visibleColumnCount < 5) {
                fail('Wide canvas scenario must expose at least five breadcrumb columns.', {
                    ...geometry,
                    from: BREADCRUMB_WIDE_CANVAS_FROM,
                    path: BREADCRUMB_WIDE_CANVAS_PATH
                });
            }
            const compressedColumns = geometry.columnWidths.filter((width) => (
                Math.abs(width - geometry.columnInline) > 1
            ));
            if (
                geometry.columnInline <= 0
                || Math.abs(geometry.columnInline - geometry.expectedColumnInline) > 1
                || compressedColumns.length > 0
            ) {
                fail('Wide breadcrumb columns must remain fixed at 15rem without compression.', {
                    ...geometry,
                    compressedColumns
                });
            }
            const unequalGaps = [
                geometry.railToBreadcrumbGap,
                ...geometry.breadcrumbGaps,
                geometry.breadcrumbToMainGap
            ].filter((gap) => Math.abs(gap - geometry.gapInline) > 0.1);
            if (geometry.gapInline <= 0 || unequalGaps.length > 0) {
                fail('Wide rail, breadcrumb columns, and main content must share one visual gap.', {
                    ...geometry,
                    unequalGaps
                });
            }
            if (geometry.mainInline <= 0 || geometry.mainWidth + 1 < geometry.mainInline) {
                fail('Wide canvas main track shrank below --breadcrumb-main-inline.', geometry);
            }
            if (geometry.documentScrollWidth <= geometry.documentClientWidth) {
                fail('Wide canvas overflow must reach the document scroller.', geometry);
            }
            if (geometry.breadcrumbScrollWidth > geometry.breadcrumbClientWidth + 1) {
                fail('Wide breadcrumb must not create its own horizontal scroller.', geometry);
            }

            return {
                ...geometry,
                from: BREADCRUMB_WIDE_CANVAS_FROM,
                path: BREADCRUMB_WIDE_CANVAS_PATH
            };
        }
    },
    {
        id: 'grid-list-name-column-contract',
        kind: 'single',
        title: 'Grid List Name Column Contract',
        viewport: WIDE_VIEWPORT,
        async run({ page, baseUrl }) {
            const results = [];
            for (const target of GRID_LIST_COLUMN_CASES) {
                await page.setViewportSize(target.viewport);
                await gotoAndWait(page, `${baseUrl}${target.path}`);
                await page.waitForSelector('.slot-main .grid-list > .cell-title');
                const geometry = await page.evaluate(() => {
                    const grid = document.querySelector('.slot-main .grid-list');
                    const nameCell = grid?.querySelector(':scope > .cell-title');
                    if (!(grid instanceof HTMLElement) || !(nameCell instanceof HTMLElement)) return null;

                    const probe = document.createElement('div');
                    probe.style.cssText = 'position:absolute;visibility:hidden;block-size:0;padding:0;border:0';
                    document.body.appendChild(probe);
                    const measure = (value) => {
                        probe.style.inlineSize = value;
                        return probe.getBoundingClientRect().width;
                    };
                    const result = {
                        breadcrumbInline: measure('var(--breadcrumb-column-inline)'),
                        documentClientInline: document.documentElement.clientWidth,
                        documentScrollInline: document.documentElement.scrollWidth,
                        nameInline: nameCell.getBoundingClientRect().width,
                        navigationInline: measure('var(--navigation-column-inline)')
                    };
                    probe.remove();
                    return result;
                });
                const expectedInline = geometry?.navigationInline;
                const invalid = !geometry
                    || expectedInline <= 0
                    || Math.abs(geometry.nameInline - expectedInline) > 1
                    || (target.compareBreadcrumb && Math.abs(geometry.breadcrumbInline - expectedInline) > 1)
                    || (target.horizontalCanvas && geometry.documentScrollInline <= geometry.documentClientInline);
                if (invalid) {
                    fail('Grid list name column contract failed.', { ...target, ...geometry, expectedInline });
                }
                results.push({ ...target, ...geometry, expectedInline });
            }
            return { cases: results };
        }
    },
    {
        id: 'collection-list-visual-alignment-contract',
        kind: 'single',
        title: 'Collection List Visual Alignment Contract',
        viewport: WIDE_VIEWPORT,
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/zh/all/`);
            await page.waitForSelector('.slot-main .collection-list--grid .collection-item-link');
            await page.locator('.slot-main .collection-list--grid .collection-item-link').first().hover();
            const grid = await page.evaluate(() => {
                const list = document.querySelector('.slot-main .collection-list--grid');
                const header = list?.querySelector('.collection-list-header');
                const headerText = header?.querySelector('a');
                const link = list?.querySelector('.collection-item-link');
                const icon = link?.querySelector('.collection-item-icon');
                if (!(list instanceof HTMLElement)
                    || !(header instanceof HTMLElement)
                    || !(headerText instanceof HTMLElement)
                    || !(link instanceof HTMLElement)
                    || !(icon instanceof HTMLElement)) return null;

                const headerRange = document.createRange();
                headerRange.selectNodeContents(headerText);
                const headerTextRect = headerRange.getBoundingClientRect();
                const linkStyle = getComputedStyle(link);
                const stateStyle = getComputedStyle(link, '::before');
                const separatorStyle = getComputedStyle(list, '::after');
                const headerTrackSize = Number.parseFloat(getComputedStyle(list).gridTemplateRows);
                return {
                    headerTrackSize,
                    headerTextBlockStart: headerTextRect.top,
                    iconInlineStart: icon.getBoundingClientRect().left,
                    linkBackground: linkStyle.backgroundColor,
                    linkBlockSize: link.getBoundingClientRect().height,
                    linkBlockStart: link.getBoundingClientRect().top,
                    linkInlineStart: link.getBoundingClientRect().left,
                    linkPaddingInlineStart: Number.parseFloat(linkStyle.paddingInlineStart),
                    listBlockStart: list.getBoundingClientRect().top,
                    separatorBlockStart: list.getBoundingClientRect().top
                        + Number.parseFloat(separatorStyle.top),
                    stateBackground: stateStyle.backgroundColor,
                    stateRadius: stateStyle.borderRadius
                };
            });

            const articleUrl = new URL(BREADCRUMB_COLUMN_SORT_PATH, `${baseUrl}/`);
            articleUrl.searchParams.set('from', 'all');
            await gotoAndWait(page, articleUrl.href);
            await page.waitForSelector('.slot-breadcrumb .collection-list--column');
            await waitForBreadcrumbSettled(page);
            await page.locator(
                '.slot-breadcrumb .collection-list--column .collection-item-link:not(.is-current)'
            ).first().hover();
            const column = await page.evaluate(() => {
                const list = document.querySelector('.slot-breadcrumb .collection-list--column');
                const header = list?.querySelector('.collection-column-header');
                const headerText = header?.querySelector('.collection-column-label');
                const link = list?.querySelector('.collection-item-link');
                const icon = link?.querySelector('.collection-item-icon');
                const hovered = list?.querySelector('.collection-item-link:hover');
                const current = list?.querySelector('.collection-item-link.is-current');
                if (!(list instanceof HTMLElement)
                    || !(header instanceof HTMLElement)
                    || !(headerText instanceof HTMLElement)
                    || !(link instanceof HTMLElement)
                    || !(icon instanceof HTMLElement)
                    || !(hovered instanceof HTMLElement)
                    || !(current instanceof HTMLElement)) return null;

                const headerRange = document.createRange();
                headerRange.selectNodeContents(headerText);
                const headerTextRect = headerRange.getBoundingClientRect();
                const linkStyle = getComputedStyle(link);
                const hoveredStyle = getComputedStyle(hovered);
                const hoverStateStyle = getComputedStyle(hovered, '::before');
                const currentStyle = getComputedStyle(current);
                const currentStateStyle = getComputedStyle(current, '::before');
                const rootCurrent = document.querySelector('[data-root-navigation] [data-root-href].is-current');
                const rootCurrentStyle = getComputedStyle(rootCurrent);
                const rootCurrentState = getComputedStyle(rootCurrent, '::before');
                const separatorStyle = getComputedStyle(list, '::after');
                const directCells = Array.from(list.children);
                const headerTrackSize = Number.parseFloat(getComputedStyle(list).gridTemplateRows);
                return {
                    directCellCount: directCells.length,
                    directCellsValid: directCells.every((cell) => cell.classList.contains('cell-title')),
                    headerTrackSize,
                    currentLinkBackground: currentStyle.backgroundColor,
                    currentStateBackground: currentStateStyle.backgroundColor,
                    currentStateShadow: currentStateStyle.boxShadow,
                    rootLinkBackground: rootCurrentStyle.backgroundColor,
                    rootStateBackground: rootCurrentState.backgroundColor,
                    rootStateShadow: rootCurrentState.boxShadow,
                    rootStateRadius: rootCurrentState.borderRadius,
                    rootBlockSize: rootCurrent.getBoundingClientRect().height,
                    rootInlineSize: rootCurrent.getBoundingClientRect().width,
                    columnInlineSize: current.getBoundingClientRect().width,
                    currentStateRadius: currentStateStyle.borderRadius,
                    headerTextBlockStart: headerTextRect.top,
                    hoverLinkBackground: hoveredStyle.backgroundColor,
                    hoverStateBackground: hoverStateStyle.backgroundColor,
                    hoverStateRadius: hoverStateStyle.borderRadius,
                    iconInlineStart: icon.getBoundingClientRect().left,
                    linkBlockSize: link.getBoundingClientRect().height,
                    linkBlockStart: link.getBoundingClientRect().top,
                    linkInlineStart: link.getBoundingClientRect().left,
                    linkPaddingInlineStart: Number.parseFloat(linkStyle.paddingInlineStart),
                    listBlockStart: list.getBoundingClientRect().top,
                    separatorBlockStart: list.getBoundingClientRect().top
                        + Number.parseFloat(separatorStyle.top),
                    singleGridContract: list.matches(
                        '.grid-list.grid-list--single.grid-list--headed.collection-list--column'
                    )
                };
            });

            const transparent = 'rgba(0, 0, 0, 0)';
            const invalid = !grid
                || !column
                || Math.abs(grid.listBlockStart - column.listBlockStart) > 1
                || Math.abs(grid.headerTextBlockStart - column.headerTextBlockStart) > 0.1
                || Math.abs(grid.headerTrackSize - column.headerTrackSize) > 0.1
                || Math.abs(grid.iconInlineStart - column.iconInlineStart) > 1
                || Math.abs(grid.linkInlineStart - column.linkInlineStart) > 1
                || Math.abs(grid.linkBlockStart - column.linkBlockStart) > 0.1
                || Math.abs(grid.linkBlockSize - column.linkBlockSize) > 0.1
                || Math.abs(grid.separatorBlockStart - column.separatorBlockStart) > 0.1
                || !column.singleGridContract
                || !column.directCellsValid
                || column.directCellCount < 2
                || grid.linkBlockStart <= grid.separatorBlockStart + 1
                || grid.linkPaddingInlineStart > 0.1
                || column.linkPaddingInlineStart > 0.1
                || grid.linkBackground !== transparent
                || column.hoverLinkBackground !== transparent
                || column.currentLinkBackground !== transparent
                || grid.stateBackground === transparent
                || grid.stateBackground !== column.hoverStateBackground
                || grid.stateRadius !== column.hoverStateRadius
                || column.currentStateBackground === transparent
                || column.currentStateShadow === 'none'
                || column.rootLinkBackground !== column.currentLinkBackground
                || column.rootStateBackground !== column.currentStateBackground
                || column.rootStateShadow !== column.currentStateShadow
                || column.rootStateRadius !== column.currentStateRadius
                || Math.abs(column.rootBlockSize - column.linkBlockSize) > 0.1
                || Math.abs(column.rootInlineSize - column.columnInlineSize) > 1;
            if (invalid) {
                fail('Collection list visual alignment contract failed.', { grid, column });
            }

            return { grid, column };
        }
    },
    {
        id: 'breadcrumb-prefetch-slot-contract',
        kind: 'single',
        title: 'Breadcrumb Prefetch Slot Contract',
        viewport: WIDE_VIEWPORT,
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/d/products/?sort=name-asc`);
            await page.waitForSelector('.slot-row-breadcrumb');
            await waitForBreadcrumbSettled(page);

            const state = await readBreadcrumbPrefetchSlotContract(page);
            if (state.breadcrumbAnchorCount === 0) {
                fail('Breadcrumb prefetch contract scenario did not find any breadcrumb anchors.', state);
            }
            if (state.breadcrumbInvalidAnchors.length > 0) {
                fail('Breadcrumb anchors must use data-prefetch-slot="crumb".', state);
            }
            if (state.slotRowNavAnchors.length > 0) {
                fail('slot-row-breadcrumb must not contain nav prefetch anchors.', state);
            }
            if (state.slotRowBreadcrumbMenuOptionCount === 0) {
                fail('Sorted breadcrumb page did not expose rebuilt breadcrumb menu options.', state);
            }
            if (state.slotRowBreadcrumbMenuOptionsWithoutCrumb.length > 0) {
                fail('Runtime rebuilt breadcrumb menu options must keep data-prefetch-slot="crumb".', state);
            }

            return state;
        }
    },
    {
        id: 'breadcrumb-tags-wide-stability',
        kind: 'single',
        title: 'Breadcrumb Wide Stability (Tags)',
        viewport: WIDE_VIEWPORT,
        async run({ page, baseUrl }) {
            await page.addInitScript(
                recordFirstBreadcrumbMenuStateScript,
                BREADCRUMB_TAGS_COLLECTION_HREF
            );

            await gotoAndWait(page, `${baseUrl}${BREADCRUMB_TAGS_PATH}`);
            await page.waitForSelector('.slot-row-breadcrumb');
            await waitForBreadcrumbSettled(page);
            const firstAndFinalState = await page.evaluate(() => ({
                firstOrder: window.__banyanFirstBreadcrumbMenuOrder,
                finalOrder: window.__banyanReadBreadcrumbMenuOrder?.() || [],
                firstHeaderSpacing: window.__banyanFirstBreadcrumbHeaderSpacing,
                finalHeaderSpacing: window.__banyanReadBreadcrumbHeaderSpacing?.() || null
            }));
            if (!Array.isArray(firstAndFinalState.firstOrder)
                || firstAndFinalState.firstOrder.length === 0
                || firstAndFinalState.finalOrder.length === 0) {
                fail('Tags breadcrumb scenario did not capture both menu states.', {
                    path: BREADCRUMB_TAGS_PATH,
                    targetCollectionHref: BREADCRUMB_TAGS_COLLECTION_HREF,
                    ...firstAndFinalState
                });
            }
            if (JSON.stringify(firstAndFinalState.firstOrder)
                !== JSON.stringify(firstAndFinalState.finalOrder)) {
                fail('Tags breadcrumb menu reordered after the client runtime settled.', {
                    path: BREADCRUMB_TAGS_PATH,
                    targetCollectionHref: BREADCRUMB_TAGS_COLLECTION_HREF,
                    ...firstAndFinalState
                });
            }
            if (!firstAndFinalState.firstHeaderSpacing
                || !firstAndFinalState.finalHeaderSpacing) {
                fail('Tags breadcrumb scenario did not capture both header spacing states.', {
                    path: BREADCRUMB_TAGS_PATH,
                    targetCollectionHref: BREADCRUMB_TAGS_COLLECTION_HREF,
                    ...firstAndFinalState
                });
            }
            const spacingDelta = {
                labelToSeparator: Math.abs(
                    firstAndFinalState.firstHeaderSpacing.labelToSeparator
                    - firstAndFinalState.finalHeaderSpacing.labelToSeparator
                ),
                separatorToSort: Math.abs(
                    firstAndFinalState.firstHeaderSpacing.separatorToSort
                    - firstAndFinalState.finalHeaderSpacing.separatorToSort
                )
            };
            if (spacingDelta.labelToSeparator > 0.1 || spacingDelta.separatorToSort > 0.1) {
                fail('Tags breadcrumb header spacing changed after the client runtime settled.', {
                    path: BREADCRUMB_TAGS_PATH,
                    targetCollectionHref: BREADCRUMB_TAGS_COLLECTION_HREF,
                    spacingDelta,
                    ...firstAndFinalState
                });
            }
            const mainX1 = await getMainInlineStart(page);
            await page.waitForTimeout(800);
            const mainX2 = await getMainInlineStart(page);
            const cls = await getLayoutShiftValue(page);
            const delta = mainX1 !== null && mainX2 !== null ? Math.abs(mainX2 - mainX1) : null;
            if (delta !== null && delta > 1) {
                fail('Main column shifted on tags-based breadcrumb path.', { mainX1, mainX2, delta });
            }
            if (cls > 0.1) {
                fail('Tags-based breadcrumb path caused excessive layout shift.', { cls });
            }
            return {
                cls,
                mainX1,
                mainX2,
                delta,
                spacingDelta,
                firstAndFinalState
            };
        }
    },
    {
        id: 'language-page-runtime-independent',
        kind: 'single',
        title: 'Language Page Without Runtime JSON',
        serviceWorkers: 'block',
        dialogPolicy: 'accept',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl, dialogs }) {
            await installRuntimeJsonFetchProbe(page);
            const blockedRuntimeRequests = [];
            await page.route('**/runtime/*.json', async (route) => {
                blockedRuntimeRequests.push(new URL(route.request().url()).pathname);
                await route.abort('failed');
            });

            await gotoAndWait(page, baseUrl + '/language/');
            await page.waitForSelector('[data-language-settings][data-language-state="ready"]');
            const initialState = await readLanguageSettingsState(page);
            if (initialState.options.length !== 3
                || initialState.options.some((option) => option.tagName !== 'A' || !option.href || option.disabled)) {
                fail('Language settings must expose usable static links when runtime JSON is unavailable.', initialState);
            }
            const targetOption = initialState.options.find((option) => option.value === 'zh');
            await page.locator('[data-language-choice="zh"]').click();
            await page.waitForURL((url) => url.pathname === new URL(targetOption.href, baseUrl).pathname);
            await page.waitForSelector('[data-language-settings][data-language-state="ready"]');
            const switchedState = await readLanguageSettingsState(page);
            const preferredLanguage = await page.evaluate(() => localStorage.getItem('preferred_lang'));
            if (!switchedState.options.some((option) => option.value === 'zh' && option.current === 'page')
                || preferredLanguage !== 'zh') {
                fail('Language navigation must mark and persist the selected language.', { switchedState, preferredLanguage });
            }

            await resetRuntimeJsonFetchProbe(page);
            await gotoAndWait(page, baseUrl + '/language/?return=' + encodeURIComponent('/prefetchdebug/'));
            await page.waitForSelector('[data-language-settings][data-language-state="ready"]');
            const missingTranslationState = await readLanguageSettingsState(page);
            const missingTarget = missingTranslationState.options.find((option) => option.value === 'zh');
            if (!missingTranslationState.noTranslationMessage
                || !missingTranslationState.languageSuggestionMessage
                || !missingTarget?.href || missingTarget.hasTranslation || missingTarget.disabled) {
                fail('Missing-translation choices must retain static labels, destination and prompt.', missingTranslationState);
            }
            const dialogCountBeforeMissingSelection = dialogs.length;
            await page.locator('[data-language-choice="zh"]').click();
            await page.waitForURL((url) => url.pathname === new URL(missingTarget.href, baseUrl).pathname);
            const missingDialogs = dialogs.slice(dialogCountBeforeMissingSelection);
            if (missingDialogs.length !== 1 || !missingDialogs[0].message.includes(missingTarget.text)) {
                fail('Missing-translation navigation must retain its localized confirmation.', { missingDialogs, missingTarget });
            }
            return {
                blockedRuntimeRequests: [...new Set(blockedRuntimeRequests)],
                runtimeFetches: await readRuntimeJsonFetchProbe(page),
                initialState, switchedState, missingTranslationState, missingDialogs
            };
        }
    },
    {
        id: 'sw-home-register',
        kind: 'single',
        title: 'SW Register Smoke (Home)',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/`);
            await waitForServiceWorkerActive(page);
            const state = await page.evaluate(async () => {
                const registration = await navigator.serviceWorker.getRegistration('/');
                return {
                    active: !!registration?.active,
                    installing: !!registration?.installing,
                    waiting: !!registration?.waiting
                };
            });
            if (!state.active) {
                fail('Home page did not get an active service worker registration.', state);
            }
            return state;
        }
    },
    {
        id: 'sw-update-language-page-static',
        kind: 'upgrade',
        title: 'Language Links While Site Update Waits',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl, server, upgradePair }) {
            ensureTwoBuilds(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, baseUrl + '/language/');
            await page.waitForSelector('[data-language-settings][data-language-state="ready"]');
            await waitForServiceWorkerActive(page);
            const beforeUpdate = await readLanguageSettingsState(page);
            if (beforeUpdate.options.length !== 3
                || beforeUpdate.options.some((option) => option.tagName !== 'A' || !option.href || option.disabled)) {
                fail('Language page must expose static language links before an update.', beforeUpdate);
            }

            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            const afterUpdateReady = await readLanguageSettingsState(page);
            if (JSON.stringify(afterUpdateReady.options) !== JSON.stringify(beforeUpdate.options)) {
                fail('A waiting worker must not replace or disable the language links.', { beforeUpdate, afterUpdateReady });
            }
            await page.locator('[data-language-choice="zh"]').click();
            await page.waitForURL((url) => url.pathname === '/zh/language/');
            await page.waitForSelector('[data-language-choice="zh"][aria-current="page"]');
            return { beforeUpdate, afterUpdateReady, target: page.url() };
        }
    }
];

export const upgradeScenarios = scenarios.filter((scenario) => scenario.kind === 'upgrade');
