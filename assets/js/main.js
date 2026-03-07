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

document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;
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

        // 当前页面已有翻译的语言列表（由 Hugo 在 baseof.html 上以 data-trans-langs 注入）
        const curLang = (langSelect.dataset.curLang || document.documentElement.lang || '').toLowerCase();
        const transLangs = (langSelect.dataset.transLangs || '')
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);

        // 懒加载 i18n JSON（仅在需要时请求，内存缓存）
        const _i18nCache = {};
        async function getNoTransMsg(lang) {
            if (!_i18nCache[lang]) {
                try {
                    const res = await fetch('/' + lang + '/i18n.json');
                    if (res.ok) {
                        const data = await res.json();
                        _i18nCache[lang] = data.no_trans_msg;
                    }
                } catch (e) { /* 静默降级 */ }
            }
            return _i18nCache[lang] || 'This page is not available in [{lang}]. Redirect to the homepage?';
        }

        // 从 Hugo 生成的 /lang-list.json 读取站点支持语言列表，并动态构建下拉选项
        fetch('/lang-list.json', { credentials: 'same-origin' })
            .then(res => res && res.ok ? res.json() : [])
            .then(list => {
                if (!Array.isArray(list) || !list.length) return;

                const supportedLangs = [];
                list.forEach(item => {
                    const code = (item.code || '').toLowerCase();
                    const name = item.name || code;
                    if (!code) return;
                    supportedLangs.push(code);

                    const opt = document.createElement('option');
                    opt.value = code;
                    opt.textContent = name;
                    if (code === curLang) opt.selected = true;
                    opt.setAttribute('data-has-trans', transLangs.includes(code) ? 'true' : 'false');
                    langSelect.appendChild(opt);
                });

                if (!langSelect.options.length) return;
                updateFit(langSelect);

                langSelect.addEventListener('change', async () => {
                    try {
                        const option = langSelect.options[langSelect.selectedIndex];
                        const targetLang = (option.value || '').toLowerCase();
                        if (!targetLang) return;

                        const hasTrans = option.getAttribute('data-has-trans') === 'true';
                        if (!hasTrans) {
                            const tpl = await getNoTransMsg(targetLang);
                            const msg = tpl.replace('{lang}', option.text.trim());
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
                                localStorage.setItem('preferred_lang', code);
                            }
                            window.location.href = '/' + targetLang + '/';
                            return;
                        }

                        const code = normalizeLang(targetLang);
                        if (supportedLangs.includes(code)) {
                            localStorage.setItem('preferred_lang', code);
                        }

                        const curUrl = new URL(window.location.href);
                        const curSegs = curUrl.pathname.split('/').filter(Boolean);

                        if (curSegs.length > 0 && supportedLangs.includes(curSegs[0].toLowerCase())) {
                            curSegs[0] = targetLang;
                            curUrl.pathname = '/' + curSegs.join('/') + (curUrl.pathname.endsWith('/') ? '/' : '');
                            window.location.href = curUrl.href;
                        } else {
                            window.location.href = '/' + targetLang + '/';
                        }
                    } catch (e) {
                        const fallback = langSelect.options[langSelect.selectedIndex]?.value || 'en';
                        window.location.href = '/' + fallback + '/';
                    }
                });
            })
            .catch(() => { /* 如果语言列表加载失败，则语言切换器保持空白，静默降级 */ });
    }

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