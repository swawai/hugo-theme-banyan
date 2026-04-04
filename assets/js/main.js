// 针对微信安卓版：通过 WeixinJSBridge 强制覆盖字体大小并禁止用户修改，缓解字体缩放导致的页面跳变
(function () {
    if (typeof WeixinJSBridge == "object" && typeof WeixinJSBridge.invoke == "function") {
        handleFontSize();
    } else {
        if (document.addEventListener) {
            document.addEventListener("WeixinJSBridgeReady", handleFontSize, false);
        } else if (document.attachEvent) {
            document.attachEvent("WeixinJSBridgeReady", handleFontSize);
            document.attachEvent("onWeixinJSBridgeReady", handleFontSize);
        }
    }
    function handleFontSize() {
        try {
            WeixinJSBridge.invoke('setFontSizeCallback', { 'fontSize': 0 });
            WeixinJSBridge.on('menu:setfont', function () {
                WeixinJSBridge.invoke('setFontSizeCallback', { 'fontSize': 0 });
            });
        } catch (e) { }
    }
})();


const PREFERRED_LANG_KEY = 'preferred_lang';
const LANG_SUGGEST_HANDLED_KEY = 'lang-suggest-handled-v1';
const html = document.documentElement;

let runtimeManifestPromise = null;
let runtimeManifestCache = null;

function readRuntimeManifestUrl() {
    return document.body?.dataset.assetManifestUrl || '';
}

function getRuntimeManifest() {
    if (runtimeManifestCache) {
        return Promise.resolve(runtimeManifestCache);
    }

    if (!runtimeManifestPromise) {
        const manifestUrl = readRuntimeManifestUrl();
        if (!manifestUrl) {
            runtimeManifestCache = {};
            return Promise.resolve(runtimeManifestCache);
        }

        runtimeManifestPromise = fetch(manifestUrl, { credentials: 'include' })
            .then((res) => (res && res.ok ? res.json() : {}))
            .catch(() => ({}))
            .then((manifest) => {
                runtimeManifestCache = manifest && typeof manifest === 'object' ? manifest : {};
                return runtimeManifestCache;
            });
    }

    return runtimeManifestPromise;
}

function getRuntimeLangListUrl(manifest) {
    return typeof manifest?.langList === 'string' && manifest.langList ? manifest.langList : '';
}

function getRuntimeI18nUrl(manifest, lang, homeUrl) {
    const normalized = typeof lang === 'string' ? lang.toLowerCase() : '';
    const i18nMap = manifest && typeof manifest.i18n === 'object' ? manifest.i18n : null;
    if (i18nMap) {
        if (typeof i18nMap[normalized] === 'string' && i18nMap[normalized]) return i18nMap[normalized];
        if (normalized === 'zh-hk' || normalized === 'zh-mo') {
            if (typeof i18nMap['zh-tw'] === 'string' && i18nMap['zh-tw']) return i18nMap['zh-tw'];
        }
    }

    return '';
}



function readStorage(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (e) { }
}

function runAfterPageSettles(callback, delayMs) {
    let cancelled = false;
    let cleaned = false;

    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        window.removeEventListener('click', cancelOnInteract, true);
        window.removeEventListener('scroll', cancelOnInteract, true);
        window.removeEventListener('keydown', cancelOnInteract, true);
        window.removeEventListener('touchstart', cancelOnInteract, true);
    };
    const cancelOnInteract = () => {
        cancelled = true;
        cleanup();
    };
    const run = () => {
        window.setTimeout(() => {
            if (cancelled) return;
            cleanup();
            callback();
        }, delayMs);
    };

    window.addEventListener('click', cancelOnInteract, true);
    window.addEventListener('scroll', cancelOnInteract, true);
    window.addEventListener('keydown', cancelOnInteract, true);
    window.addEventListener('touchstart', cancelOnInteract, true);

    if (document.readyState === 'complete') {
        run();
        return;
    }

    window.addEventListener('load', run, { once: true });
}



void getRuntimeManifest();

async function injectSiteManifest() {
    try {
        const manifest = await getRuntimeManifest();
        const url = manifest?.siteManifest;
        if (!url) return;
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = url;
        link.setAttribute('fetchpriority', 'low');
        document.head.appendChild(link);
    } catch (e) { /* ignore */ }
}

const SORT_PARAM_KEY = 'sort';
const SORT_VARIANTS = {
    dir: {
        defaultToken: 'date-desc',
        grouped: true,
        fields: {
            name: { dataKey: 'sortName', type: 'string', defaultOrder: 'asc' },
            date: { dataKey: 'sortDate', type: 'number', defaultOrder: 'desc' },
            count: { dataKey: 'sortCount', type: 'number', defaultOrder: 'desc' }
        }
    },
    all: {
        defaultToken: 'date-desc',
        grouped: false,
        fields: {
            name: { dataKey: 'sortName', type: 'string', defaultOrder: 'asc' },
            date: { dataKey: 'sortDate', type: 'number', defaultOrder: 'desc' },
            size: { dataKey: 'sortSize', type: 'number', defaultOrder: 'desc' },
            path: { dataKey: 'sortPath', type: 'string', defaultOrder: 'asc' }
        }
    },
    tree: {
        defaultToken: 'date-desc',
        grouped: true,
        fields: {
            name: { dataKey: 'sortName', type: 'string', defaultOrder: 'asc' },
            date: { dataKey: 'sortDate', type: 'number', defaultOrder: 'desc' },
            count: { dataKey: 'sortCount', type: 'number', defaultOrder: 'desc' }
        }
    },
    products: {
        defaultToken: 'name-asc',
        grouped: false,
        fields: {
            name: { dataKey: 'sortName', type: 'string', defaultOrder: 'asc' },
            price: { dataKey: 'sortPrice', type: 'number', defaultOrder: 'desc' },
            value: { dataKey: 'sortValue', type: 'string', defaultOrder: 'asc' }
        }
    }
};

function parseSortToken(token) {
    const value = typeof token === 'string' ? token.trim().toLowerCase() : '';
    if (!value) return { field: '', order: '' };
    const parts = value.split('-');
    if (parts.length !== 2) return { field: '', order: '' };
    const [field, order] = parts;
    if (order !== 'asc' && order !== 'desc') return { field: '', order: '' };
    return { field, order };
}

function getNormalizedSortToken(token, variantName) {
    const variant = SORT_VARIANTS[variantName];
    if (!variant) return '';
    const parsed = parseSortToken(token);
    if (!parsed.field || !variant.fields[parsed.field]) return variant.defaultToken;
    return `${parsed.field}-${parsed.order}`;
}

function toggleSortOrder(order) {
    return order === 'asc' ? 'desc' : 'asc';
}

function readCurrentSortToken(variantName) {
    const url = new URL(window.location.href);
    return getNormalizedSortToken(url.searchParams.get(SORT_PARAM_KEY), variantName);
}

function buildSortHref(token, defaultToken) {
    const url = new URL(window.location.href);
    if (!token || token === defaultToken) url.searchParams.delete(SORT_PARAM_KEY);
    else url.searchParams.set(SORT_PARAM_KEY, token);
    return `${url.pathname}${url.search}${url.hash}`;
}

function writeSortToken(token, defaultToken, replace) {
    const url = new URL(window.location.href);
    if (!token || token === defaultToken) url.searchParams.delete(SORT_PARAM_KEY);
    else url.searchParams.set(SORT_PARAM_KEY, token);

    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function readRowValue(rowHead, fieldConfig) {
    if (!rowHead || !fieldConfig) return '';
    const raw = rowHead.dataset?.[fieldConfig.dataKey] ?? '';
    if (fieldConfig.type === 'number') {
        const numeric = Number(raw);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    return String(raw);
}

function readOriginalRowIndex(row) {
    const raw = row?.head?.dataset?.sortOriginalIndex ?? '';
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : row.index;
}

function compareRowValues(left, right, fieldConfig, order) {
    const leftValue = readRowValue(left.head, fieldConfig);
    const rightValue = readRowValue(right.head, fieldConfig);
    let result = 0;

    if (fieldConfig.type === 'number') {
        result = leftValue - rightValue;
    } else {
        result = String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    if (result !== 0) return order === 'asc' ? result : -result;

    // Keep ties in the original SSR order so default descending sorts do not
    // reshuffle same-value rows on page load.
    return readOriginalRowIndex(left) - readOriginalRowIndex(right);
}

function isGridCell(node) {
    return !!node && node.nodeType === 1 && Array.from(node.classList || []).some((className) => className.startsWith('cell-'));
}

function collectSortableRows(grid, columnCount) {
    const rowCells = Array.from(grid.children).filter((child) => isGridCell(child) && !child.classList.contains('header'));
    const rows = [];

    for (let index = 0, offset = 0; offset + columnCount <= rowCells.length; index += 1, offset += columnCount) {
        const cells = rowCells.slice(offset, offset + columnCount);
        const head = cells[0];
        if (head?.dataset && head.dataset.sortOriginalIndex === undefined) {
            head.dataset.sortOriginalIndex = String(index);
        }
        rows.push({ index, head, cells });
    }

    return { rows, rowCells };
}

function updateSortControls(grid, variantName, currentToken) {
    const variant = SORT_VARIANTS[variantName];
    const current = parseSortToken(currentToken);
    const controls = grid.querySelectorAll('a[data-sort-control="true"]');

    controls.forEach((control) => {
        const field = (control.dataset.sortField || '').toLowerCase();
        const defaultOrder = (control.dataset.sortDefaultOrder || 'asc').toLowerCase();
        const active = field === current.field;
        const nextOrder = active ? toggleSortOrder(current.order) : defaultOrder;
        const nextToken = `${field}-${nextOrder}`;
        const indicator = control.querySelector('.sort-indicator');
        const titleAsc = control.dataset.sortTitleAsc || '';
        const titleDesc = control.dataset.sortTitleDesc || '';
        const actionLabel = nextOrder === 'asc' ? titleAsc : titleDesc;

        control.href = buildSortHref(nextToken, variant.defaultToken);
        control.dataset.sortActive = active ? 'true' : 'false';
        if (actionLabel) {
            control.title = actionLabel;
            control.setAttribute('aria-label', actionLabel);
        }

        if (indicator) {
            indicator.textContent = active ? (current.order === 'asc' ? '↑' : '↓') : '↨';
        }
    });
}

function applySortableGrid(grid) {
    const variantName = (grid.dataset.sortVariant || '').toLowerCase();
    const variant = SORT_VARIANTS[variantName];
    const columnCount = Number(grid.dataset.sortColumns || 0);
    if (!variant || !columnCount) return;

    const currentToken = readCurrentSortToken(variantName);
    const current = parseSortToken(currentToken);
    const fieldConfig = variant.fields[current.field];
    if (!fieldConfig) return;

    const { rows, rowCells } = collectSortableRows(grid, columnCount);
    if (!rows.length) {
        updateSortControls(grid, variantName, currentToken);
        return;
    }

    const sortedRows = rows.slice().sort((left, right) => {
        if (variant.grouped) {
            const leftGroup = Number(left.head?.dataset?.sortGroup || 0);
            const rightGroup = Number(right.head?.dataset?.sortGroup || 0);
            if (leftGroup !== rightGroup) {
                return current.order === 'asc' ? leftGroup - rightGroup : rightGroup - leftGroup;
            }
        }

        return compareRowValues(left, right, fieldConfig, current.order);
    });

    const nextCells = [];
    sortedRows.forEach((row) => {
        row.cells.forEach((cell) => nextCells.push(cell));
    });

    const orderChanged = nextCells.length !== rowCells.length || nextCells.some((cell, index) => cell !== rowCells[index]);
    if (orderChanged) {
        const fragment = document.createDocumentFragment();
        nextCells.forEach((cell) => fragment.appendChild(cell));
        grid.appendChild(fragment);
    }

    updateSortControls(grid, variantName, currentToken);
}

function applySortableGrids() {
    document.querySelectorAll('[data-sortable="true"][data-sort-variant]').forEach((grid) => {
        applySortableGrid(grid);
    });
}

function initSortableGrids() {
    applySortableGrids();

    document.addEventListener('click', (event) => {
        const control = event.target.closest('a[data-sort-control="true"]');
        if (!control) return;

        const grid = control.closest('[data-sortable="true"][data-sort-variant]');
        if (!grid) return;

        const variantName = (grid.dataset.sortVariant || '').toLowerCase();
        const variant = SORT_VARIANTS[variantName];
        const field = (control.dataset.sortField || '').toLowerCase();
        const defaultOrder = (control.dataset.sortDefaultOrder || 'asc').toLowerCase();
        const current = parseSortToken(readCurrentSortToken(variantName));
        const nextOrder = current.field === field ? toggleSortOrder(current.order) : defaultOrder;
        const nextToken = `${field}-${nextOrder}`;

        if (!variant || !variant.fields[field]) return;

        event.preventDefault();
        writeSortToken(nextToken, variant.defaultToken, false);
        applySortableGrids();
    });

    window.addEventListener('popstate', () => {
        applySortableGrids();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    injectSiteManifest();
    const themeSelect = document.getElementById('theme-select');
    const langSelect = document.getElementById('lang-select');
    const updateFit = (el) => {
        const wrapper = el?.parentElement?.classList.contains('select-fit') ? el.parentElement : null;
        if (wrapper) wrapper.setAttribute('data-value', el.options[el.selectedIndex]?.text || '');
    };
    if (langSelect) {
        // 区域方言归并映射（业务规则，与语言数量无关）
        const normalizeLang = (code) => {
            code = (code || '').toLowerCase();
            if (code === 'zh-hk' || code === 'zh-mo') return 'zh-tw';
            return code;
        };
        const normalizePath = (path) => {
            if (!path) return '/';
            return path.startsWith('/') ? path : '/' + path;
        };
        const normalizeHomeUrl = (url, code) => {
            let home = url || '/' + code + '/';
            try {
                home = new URL(home, window.location.origin).pathname || '/';
            } catch (e) {
                home = normalizePath(home);
            }
            home = normalizePath(home);
            if (home !== '/' && !home.endsWith('/')) home += '/';
            return home;
        };

        // 当前页面已有翻译的语言列表（由 Hugo 在 baseof.html 上以 data-trans-langs 注入）
        const curLang = (langSelect.dataset.curLang || document.documentElement.lang || '').toLowerCase();
        const transLangs = (langSelect.dataset.transLangs || '')
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);

        // 懒加载 i18n JSON（仅在需要时请求，内存缓存）
        const _i18nCache = {};
        async function getI18nMessages(lang, homeUrl) {
            if (!_i18nCache[lang]) {
                try {
                    const manifest = await getRuntimeManifest();
                    const url = getRuntimeI18nUrl(manifest, lang, homeUrl);
                    if (!url) {
                        _i18nCache[lang] = {};
                        return _i18nCache[lang];
                    }
                    const res = await fetch(url, { credentials: 'same-origin' });
                    if (res.ok) {
                        _i18nCache[lang] = await res.json();
                    }
                } catch (e) { /* 静默降级 */ }
            }
            return _i18nCache[lang] || {};
        }
        async function getI18nMessage(lang, homeUrl, key, fallback) {
            const messages = await getI18nMessages(lang, homeUrl);
            return messages[key] || fallback;
        }
        function formatMessage(template, replacements) {
            return template
                .replace(/\[\{(\w+)\}\]/g, (match, key) => (key in replacements ? replacements[key] : match))
                .replace(/\{(\w+)\}/g, (match, key) => (key in replacements ? replacements[key] : match));
        }
        function detectBrowserLang(supportedLangs) {
            const candidates = Array.isArray(navigator.languages) && navigator.languages.length
                ? navigator.languages
                : [navigator.language || navigator.userLanguage || ''];

            for (const candidate of candidates) {
                const code = normalizeLang((candidate || '').toLowerCase());
                if (!code) continue;
                if (supportedLangs.includes(code)) return code;

                const prefix = code.split('-')[0];
                if (prefix && supportedLangs.includes(prefix)) return prefix;
            }

            return '';
        }

        // 通过运行时 manifest 读取站点支持语言列表，并动态构建下拉选项
        getRuntimeManifest()
            .then((manifest) => {
                const url = getRuntimeLangListUrl(manifest);
                if (!url) return [];
                return fetch(url, { credentials: 'same-origin' })
                    .then((res) => (res && res.ok ? res.json() : []))
                    .catch(() => []);
            })
            .then(list => {
                if (!Array.isArray(list) || !list.length) return;

                const supportedLangs = [];
                const langHomes = {};
                const langNames = {};
                list.forEach(item => {
                    const code = (item.code || '').toLowerCase();
                    const name = item.name || code;
                    if (!code) return;
                    const homeUrl = normalizeHomeUrl(item.url, code);
                    supportedLangs.push(code);
                    langHomes[code] = homeUrl;
                    langNames[code] = name;

                    const opt = document.createElement('option');
                    opt.value = code;
                    opt.textContent = name;
                    if (code === curLang) opt.selected = true;
                    opt.setAttribute('data-has-trans', transLangs.includes(code) ? 'true' : 'false');
                    langSelect.appendChild(opt);
                });

                if (!langSelect.options.length) return;
                updateFit(langSelect);

                const defaultLang = supportedLangs.find(code => langHomes[code] === '/') || supportedLangs[0] || 'en';
                const getHomeUrl = (lang) => langHomes[lang] || (lang === defaultLang ? '/' : '/' + lang + '/');
                const toRelativePath = (pathname) => {
                    const path = normalizePath(pathname);
                    const currentHome = getHomeUrl(curLang);
                    if (currentHome !== '/') {
                        const currentRoot = currentHome.slice(0, -1);
                        if (path === currentRoot || path === currentHome) return '/';
                        if (path.startsWith(currentHome)) {
                            const rest = path.slice(currentHome.length);
                            return rest ? '/' + rest : '/';
                        }
                    }
                    return path;
                };
                const buildTargetUrl = (lang, relativePath) => {
                    const home = getHomeUrl(lang);
                    if (!relativePath || relativePath === '/') return home;
                    const rest = relativePath.replace(/^\/+/, '');
                    return home === '/' ? '/' + rest : home + rest;
                };
                const suggestBrowserLanguage = async () => {
                    if (readStorage(PREFERRED_LANG_KEY) || readStorage(LANG_SUGGEST_HANDLED_KEY)) return;

                    const targetLang = detectBrowserLang(supportedLangs);
                    if (!targetLang || targetLang === curLang) return;
                    if (!transLangs.includes(targetLang)) return;

                    const targetHome = getHomeUrl(targetLang);
                    const currentName = langNames[curLang] || curLang;
                    const targetName = langNames[targetLang] || targetLang;
                    const template = await getI18nMessage(
                        targetLang,
                        targetHome,
                        'lang_suggest_msg',
                        'This page is currently in [{current}]. Your browser language appears to be [{target}]. Switch to [{target}]?'
                    );
                    const message = formatMessage(template, {
                        current: currentName,
                        target: targetName
                    });

                    runAfterPageSettles(() => {
                        const shouldSwitch = window.confirm(message);
                        writeStorage(LANG_SUGGEST_HANDLED_KEY, '1');
                        if (!shouldSwitch) return;

                        writeStorage(PREFERRED_LANG_KEY, targetLang);
                        const curUrl = new URL(window.location.href);
                        const relativePath = toRelativePath(curUrl.pathname);
                        curUrl.pathname = buildTargetUrl(targetLang, relativePath);
                        window.location.href = curUrl.href;

                    }, 800);
                };

                langSelect.addEventListener('change', async () => {
                    try {
                        const option = langSelect.options[langSelect.selectedIndex];
                        const targetLang = (option.value || '').toLowerCase();
                        if (!targetLang) return;

                        const hasTrans = option.getAttribute('data-has-trans') === 'true';
                        const targetHome = getHomeUrl(targetLang);
                        if (!hasTrans) {
                            const tpl = await getI18nMessage(
                                targetLang,
                                targetHome,
                                'no_trans_msg',
                                'This page is not available in [{lang}]. Redirect to the homepage?'
                            );
                            const msg = formatMessage(tpl, { lang: option.text.trim() });
                            if (!window.confirm(msg)) {
                                // 用户取消：恢复为当前语言
                                for (let i = 0; i < langSelect.options.length; i++) {
                                    if (langSelect.options[i].value.toLowerCase() === curLang) {
                                        langSelect.selectedIndex = i;
                                        updateFit(langSelect);
                                        break;
                                    }
                                }
                                return;
                            }
                            // 确认后直接跳转目标语言首页
                            const code = normalizeLang(targetLang);
                            if (supportedLangs.includes(code)) {
                                writeStorage(PREFERRED_LANG_KEY, code);
                            }
                            window.location.href = targetHome;

                            return;
                        }

                        const code = normalizeLang(targetLang);
                        if (supportedLangs.includes(code)) {
                            writeStorage(PREFERRED_LANG_KEY, code);
                        }

                        const curUrl = new URL(window.location.href);
                        const relativePath = toRelativePath(curUrl.pathname);
                        curUrl.pathname = buildTargetUrl(targetLang, relativePath);
                        window.location.href = curUrl.href;

                    } catch (e) {
                        const fallback = langSelect.options[langSelect.selectedIndex]?.value || 'en';
                        window.location.href = normalizeHomeUrl(langHomes[fallback], fallback);

                    }
                });

                suggestBrowserLanguage();
            })
            .catch(() => { /* 如果语言列表加载失败，则语言切换器保持空白，静默降级 */ });
    }

    initSortableGrids();
    updateFit(langSelect);
    if (!themeSelect) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const setTheme = (mode) => html.setAttribute('data-theme', mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode);

    const saved = localStorage.getItem('theme-preference') || 'auto';
    themeSelect.value = saved;
    setTheme(saved);
    updateFit(themeSelect);

    // 当系统主题变化且处于 auto 模式时，动态响应
    const handleMedia = () => { if (themeSelect.value === 'auto') setTheme('auto'); };
    if (media?.addEventListener) media.addEventListener('change', handleMedia);
    else if (media?.addListener) media.addListener(handleMedia);

    themeSelect.addEventListener('change', () => {
        const mode = themeSelect.value;
        localStorage.setItem('theme-preference', mode);
        setTheme(mode);
        updateFit(themeSelect);
    });
});

