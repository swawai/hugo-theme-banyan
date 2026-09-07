import { initRootNavigation } from './root-navigation.js';
import { initLanguagePreference } from './preferences/language.js';
import { initSettingsNavigation } from './preferences/settings-navigation.js';
import { initThemePreference } from './preferences/theme.js';

initRootNavigation();

document.addEventListener('DOMContentLoaded', () => {
    initSettingsNavigation();
    initThemePreference();
    initLanguagePreference();
});

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
