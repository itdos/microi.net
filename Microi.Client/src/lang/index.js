// Vue I18n v9 for Vue 3
// 統一管理多語言：簡體中文 / 繁體中文 / 英語 / 日本語
import { createI18n } from "vue-i18n";

// Element Plus 語言包
import elementEnLocale from "element-plus/dist/locale/en.mjs";
import elementZhLocale from "element-plus/dist/locale/zh-cn.mjs";
import elementZhTwLocale from "element-plus/dist/locale/zh-tw.mjs";
import elementJaLocale from "element-plus/dist/locale/ja.mjs";

import enLocale from "./en";
import zhLocale from "./zh";
import zhTwLocale from "./zh-tw";
import jaLocale from "./ja";

/**
 * 支持的語言列表（含 ISO code、顯示名、Element Plus locale 對應）
 * 對應關係統一以「BCP 47 風格」為準：zh-CN / zh-TW / en / ja
 */
export const SUPPORTED_LOCALES = [
    { value: "zh-CN", label: "简体中文", element: elementZhLocale },
    { value: "zh-TW", label: "繁體中文", element: elementZhTwLocale },
    { value: "en", label: "English", element: elementEnLocale },
    { value: "ja", label: "日本語", element: elementJaLocale }
];

const messages = {
    "zh-CN": { ...zhLocale, ...elementZhLocale },
    "zh-TW": { ...zhTwLocale, ...elementZhTwLocale },
    en: { ...enLocale, ...elementEnLocale },
    ja: { ...jaLocale, ...elementJaLocale }
};

/**
 * 將任意舊值/瀏覽器值規範化為 SUPPORTED_LOCALES 中的標準 code
 * 兼容舊版本可能寫入的：cn / zh / zh-cn / zh_CN / en-US / ja-JP / zh-tw 等
 */
export function normalizeLocale(raw) {
    if (!raw) return "";
    const v = String(raw).trim().replace("_", "-").toLowerCase();
    if (v === "cn" || v === "zh" || v === "zh-cn" || v === "zh-hans" || v === "zh-hans-cn") return "zh-CN";
    if (v === "zh-tw" || v === "zh-hk" || v === "zh-hant" || v === "zh-hant-tw" || v === "zh-mo") return "zh-TW";
    if (v === "ja" || v === "ja-jp" || v.startsWith("ja-")) return "ja";
    if (v === "en" || v.startsWith("en-")) return "en";
    const found = SUPPORTED_LOCALES.find((l) => l.value.toLowerCase() === v);
    return found ? found.value : "";
}

/** 統一的本地存儲鍵 */
export const LANG_STORAGE_KEY = "Microi.Lang";

/** 從各種歷史存儲位置讀取語言設定（兼容舊版） */
function getLangFromStorage() {
    try {
        const direct = localStorage.getItem(LANG_STORAGE_KEY);
        const n1 = normalizeLocale(direct);
        if (n1) return n1;
        const stored = localStorage.getItem("microi.net");
        if (stored) {
            const data = JSON.parse(stored);
            const n2 = normalizeLocale(data && data.Lang);
            if (n2) return n2;
        }
    } catch {}
    try {
        const n3 = normalizeLocale(localStorage.getItem("language") || localStorage.getItem("lang"));
        if (n3) return n3;
    } catch {}
    return "";
}

export function getLanguage() {
    const stored = getLangFromStorage();
    if (stored) return stored;
    try {
        const browser = (navigator.language || navigator.browserLanguage || "").toString();
        const n = normalizeLocale(browser);
        if (n) return n;
    } catch {}
    return "zh-CN";
}

/** 取得指定 locale 對應的 Element Plus 語言包 */
export function getElementLocale(locale) {
    const n = normalizeLocale(locale) || "zh-CN";
    const found = SUPPORTED_LOCALES.find((l) => l.value === n);
    return (found && found.element) || elementZhLocale;
}

const initLocale = getLanguage();

const i18n = createI18n({
    legacy: true,
    locale: initLocale,
    fallbackLocale: ["zh-CN", "en"],
    messages,
    silentTranslationWarn: true,
    silentFallbackWarn: true,
    missingWarn: false,
    fallbackWarn: false,
    globalInjection: true
});

/**
 * 統一的全局語言切換入口
 * - 規範化 locale
 * - 同步寫入 localStorage
 * - 觸發 window 'microi:lang-change' 事件，供 ElConfigProvider 等響應式組件監聽
 */
export function setI18nLocale(locale) {
    const n = normalizeLocale(locale) || "zh-CN";
    if (i18n.global.locale && typeof i18n.global.locale === "object" && "value" in i18n.global.locale) {
        i18n.global.locale.value = n;
    } else {
        i18n.global.locale = n;
    }
    try { localStorage.setItem(LANG_STORAGE_KEY, n); } catch {}
    try { document.documentElement.setAttribute("lang", n); } catch {}
    try { window.dispatchEvent(new CustomEvent("microi:lang-change", { detail: { locale: n } })); } catch {}
    return n;
}

try { document.documentElement.setAttribute("lang", initLocale); } catch {}

export default i18n;
