export function fail(message, details = null) {
    const error = new Error(message);
    if (details) error.details = details;
    throw error;
}

export async function pollUntil(check, options = {}) {
    const timeoutMs = options.timeoutMs || 10000;
    const intervalMs = options.intervalMs || 250;
    const label = options.label || 'pollUntil';
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
        const result = await check();
        if (result) return result;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    fail(`${label} timed out after ${timeoutMs}ms.`);
}

export function recordLayoutShiftObserverScript() {
    return () => {
        window.__banyanLayoutShiftValue = 0;
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        window.__banyanLayoutShiftValue += entry.value;
                    }
                }
            });
            observer.observe({ type: 'layout-shift', buffered: true });
        } catch (error) { }
    };
}

export function recordFirstMainLayoutScript() {
    return () => {
        window.__banyanFirstMainLayout = null;

        let observer = null;
        const capture = () => {
            if (window.__banyanFirstMainLayout !== null) return true;

            const main = document.querySelector('.slot-main');
            if (!(main instanceof HTMLElement)) return false;

            const root = document.documentElement;
            const visibleBreadcrumbColumns = Array.from(
                document.querySelectorAll('.path-columns .path-column')
            ).filter((node) => {
                if (!(node instanceof HTMLElement)) return false;
                const style = window.getComputedStyle(node);
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && node.getClientRects().length > 0;
            });

            window.__banyanFirstMainLayout = {
                breadcrumbColumnCount: visibleBreadcrumbColumns.length,
                mainInlineStart: main.getBoundingClientRect().x + window.scrollX,
                entryPending: root.getAttribute('data-entry-breadcrumb-pending') === 'true'
            };
            observer?.disconnect();
            return true;
        };

        observer = new MutationObserver(capture);
        observer.observe(document, { childList: true, subtree: true });
        capture();
    };
}

export function recordSecurityPolicyViolationScript() {
    return () => {
        window.__banyanSecurityPolicyViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
            try {
                window.__banyanSecurityPolicyViolations.push({
                    blockedURI: event.blockedURI || '',
                    disposition: event.disposition || '',
                    effectiveDirective: event.effectiveDirective || '',
                    originalPolicy: event.originalPolicy || '',
                    sample: event.sample || '',
                    sourceFile: event.sourceFile || '',
                    statusCode: Number(event.statusCode || 0)
                });
            } catch (error) { }
        });
    };
}

export async function gotoAndWait(page, url) {
    const response = await page.goto(url, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => { });
    return response;
}

export async function waitForBreadcrumbSettled(page, timeoutMs = 8000) {
    await page.waitForFunction(() => {
        const root = document.documentElement;
        return !root.hasAttribute('data-entry-breadcrumb-pending')
            && !root.hasAttribute('data-breadcrumb-sort-pending');
    }, { timeout: timeoutMs });
}

export async function getLayoutShiftValue(page) {
    return page.evaluate(() => Number(window.__banyanLayoutShiftValue || 0));
}

export async function getMainInlineStart(page) {
    return page.locator('.slot-main').evaluate(node => node.getBoundingClientRect().x + window.scrollX);
}

export async function getVisibleBreadcrumbColumnCount(page) {
    return page.evaluate(() => Array.from(
        document.querySelectorAll('.path-columns .path-column')
    ).filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none'
            && style.visibility !== 'hidden'
            && node.getClientRects().length > 0;
    }).length);
}

export async function readFirstMainLayout(page, timeoutMs = 8000) {
    await page.waitForFunction(() => {
        const layout = window.__banyanFirstMainLayout;
        return layout !== null && Number.isFinite(layout?.mainInlineStart);
    }, { timeout: timeoutMs });

    return page.evaluate(() => ({ ...window.__banyanFirstMainLayout }));
}

export async function readSecurityPolicyViolations(page) {
    return page.evaluate(() => {
        const violations = window.__banyanSecurityPolicyViolations;
        return Array.isArray(violations) ? violations.slice() : [];
    });
}

export async function waitForServiceWorkerActive(page, timeoutMs = 10000) {
    await pollUntil(() => page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false;
        try {
            const registration = await navigator.serviceWorker.getRegistration('/');
            return registration?.active?.state === 'activated' && Boolean(navigator.serviceWorker.controller);
        } catch (error) {
            return false;
        }
    }), { timeoutMs, label: 'Service worker activation and page control' });
}

export async function forceServiceWorkerUpdate(page) {
    await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return;
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.update().catch(() => { })));
        } catch (error) { }
    });
}

export async function waitForUpdateReady(page, timeoutMs = 15000) {
    // waitForFunction treats a Promise as truthy; poll the resolved browser result instead.
    await pollUntil(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.waiting?.state === 'installed'),
        { timeoutMs, label: 'Waiting service worker' });
}
