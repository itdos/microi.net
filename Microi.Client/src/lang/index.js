// Vue I18n v9 for Vue 3
// 前端只内置简体中文 / 繁体中文 / 英语。其它语言从后端 diy_lang 缓存词条包加载。
import { createI18n } from "vue-i18n";
import { isEmbeddedWebosWindowRuntime } from "../utils/webos-embedded-runtime.js";

// Element Plus 語言包
import elementEnLocale from "element-plus/dist/locale/en.mjs";
import elementZhLocale from "element-plus/dist/locale/zh-cn.mjs";
import elementZhTwLocale from "element-plus/dist/locale/zh-tw.mjs";

import enLocale from "./en";
import zhLocale from "./zh";
import zhTwLocale from "./zh-tw";

/**
 * 支持的语言列表。label 固定显示中文，避免在系统设置里看不懂目标语言。
 * 非 zh-CN / zh-TW / en 的固定词条由后端 diy_lang 语言包补齐。
 */
export const SUPPORTED_LOCALES = [
    { value: "zh-CN", label: "简体中文", element: elementZhLocale },
    { value: "zh-TW", label: "繁体中文", element: elementZhTwLocale },
    { value: "en", label: "英语", element: elementEnLocale },
    { value: "ja", label: "日语", element: elementEnLocale },
    { value: "ko", label: "韩语", element: elementEnLocale },
    { value: "vi", label: "越南语", element: elementEnLocale },
    { value: "th", label: "泰语", element: elementEnLocale },
    { value: "id", label: "印尼语", element: elementEnLocale },
    { value: "ms", label: "马来语", element: elementEnLocale },
    { value: "tl", label: "菲律宾语", element: elementEnLocale },
    { value: "my", label: "缅甸语", element: elementEnLocale },
    { value: "hi", label: "印地语", element: elementEnLocale },
    { value: "ur", label: "乌尔都语", element: elementEnLocale },
    { value: "ar", label: "阿拉伯语", element: elementEnLocale },
    { value: "fr", label: "法语", element: elementEnLocale },
    { value: "de", label: "德语", element: elementEnLocale },
    { value: "es", label: "西班牙语", element: elementEnLocale },
    { value: "pt", label: "葡萄牙语", element: elementEnLocale },
    { value: "it", label: "意大利语", element: elementEnLocale },
    { value: "nl", label: "荷兰语", element: elementEnLocale },
    { value: "tr", label: "土耳其语", element: elementEnLocale },
    { value: "pl", label: "波兰语", element: elementEnLocale },
    { value: "uk", label: "乌克兰语", element: elementEnLocale },
    { value: "ru", label: "俄语", element: elementEnLocale }
];

export const DEFAULT_SYS_LOCALES = ["zh-CN", "zh-TW", "en"];

const messages = {
    "zh-CN": { ...zhLocale, ...elementZhLocale },
    "zh-TW": { ...zhTwLocale, ...elementZhTwLocale },
    en: { ...enLocale, ...elementEnLocale }
};

function createFallbackLocaleMessage() {
    return { ...enLocale, ...elementEnLocale };
}

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
    if (v === "jp") return "ja";
    if (v === "ko" || v === "ko-kr" || v === "kr" || v.startsWith("ko-")) return "ko";
    if (v === "vi" || v === "vi-vn" || v === "vn" || v.startsWith("vi-")) return "vi";
    if (v === "th" || v === "th-th" || v.startsWith("th-")) return "th";
    if (v === "id" || v === "id-id" || v === "in" || v === "indonesian" || v.startsWith("id-")) return "id";
    if (v === "ms" || v === "ms-my" || v === "malay" || v.startsWith("ms-")) return "ms";
    if (v === "tl" || v === "fil" || v === "fil-ph" || v === "tagalog" || v === "filipino" || v.startsWith("tl-")) return "tl";
    if (v === "my" || v === "my-mm" || v === "burmese" || v === "myanmar") return "my";
    if (v === "hi" || v === "hi-in" || v.startsWith("hi-")) return "hi";
    if (v === "ur" || v === "ur-pk" || v === "ur-in" || v.startsWith("ur-")) return "ur";
    if (v === "ar" || v.startsWith("ar-")) return "ar";
    if (v === "ru" || v === "ru-ru" || v.startsWith("ru-")) return "ru";
    if (v === "de" || v === "de-de" || v.startsWith("de-")) return "de";
    if (v === "fr" || v === "fr-fr" || v.startsWith("fr-")) return "fr";
    if (v === "es" || v === "es-es" || v.startsWith("es-")) return "es";
    if (v === "pt" || v === "pt-pt" || v === "pt-br" || v.startsWith("pt-")) return "pt";
    if (v === "it" || v === "it-it" || v.startsWith("it-")) return "it";
    if (v === "nl" || v === "nl-nl" || v.startsWith("nl-")) return "nl";
    if (v === "tr" || v === "tr-tr" || v.startsWith("tr-")) return "tr";
    if (v === "pl" || v === "pl-pl" || v.startsWith("pl-")) return "pl";
    if (v === "uk" || v === "uk-ua" || v.startsWith("uk-")) return "uk";
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

export function getStoredLanguage() {
    return getLangFromStorage();
}

export function parseEnabledLocales(raw) {
    let items = [];
    if (Array.isArray(raw)) {
        items = raw;
    } else if (raw && typeof raw === "object") {
        items = Object.values(raw);
    } else if (raw) {
        const text = String(raw).trim();
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                items = parsed;
            } else if (parsed && typeof parsed === "object") {
                items = Object.values(parsed);
            }
        } catch {
            items = text.split(/[,;]+/);
        }
    }
    if (!items.length) {
        items = DEFAULT_SYS_LOCALES;
    }
    const result = [];
    items.forEach((item) => {
        let rawValue = item;
        if (item && typeof item === "object") {
            rawValue = item.Key || item.key || item.Value || item.value || item.Id || item.id || "";
        }
        rawValue = String(rawValue || "").split("|")[0];
        const locale = normalizeLocale(rawValue);
        if (locale && !result.includes(locale) && SUPPORTED_LOCALES.some((l) => l.value === locale)) {
            result.push(locale);
        }
    });
    return result.length ? result : DEFAULT_SYS_LOCALES.slice();
}

export function getSupportedLocalesBySysLangs(raw) {
    const enabled = parseEnabledLocales(raw);
    return SUPPORTED_LOCALES.filter((item) => enabled.includes(item.value));
}

export function resolveSysLocale(sysConfig, preferred) {
    const hasSysConfig = sysConfig && Object.keys(sysConfig).length > 0;
    if (!hasSysConfig) {
        const preferredLocale = normalizeLocale(preferred);
        if (preferredLocale) {
            return preferredLocale;
        }
        return "zh-CN";
    }
    const enabled = parseEnabledLocales(sysConfig && sysConfig.SysLangs);
    const candidates = [
        preferred,
        sysConfig && sysConfig.SysLang,
        enabled[0],
        "zh-CN"
    ];
    for (const candidate of candidates) {
        const locale = normalizeLocale(candidate);
        if (locale && enabled.includes(locale)) {
            return locale;
        }
    }
    return enabled[0] || "zh-CN";
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
    return (found && found.element) || elementEnLocale;
}

const initLocale = getLanguage();
if (!messages[initLocale]) {
    messages[initLocale] = createFallbackLocaleMessage();
}

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

export function ensureLocaleMessage(locale) {
    const n = normalizeLocale(locale) || "zh-CN";
    try {
        const current = i18n.global.getLocaleMessage ? i18n.global.getLocaleMessage(n) : i18n.global.messages[n];
        if (!current || Object.keys(current).length === 0) {
            const base = messages[n] || createFallbackLocaleMessage();
            if (i18n.global.setLocaleMessage) {
                i18n.global.setLocaleMessage(n, base);
            } else {
                i18n.global.messages[n] = base;
            }
        }
    } catch {}
    return n;
}

/**
 * 統一的全局語言切換入口
 * - 規範化 locale
 * - 同步寫入 localStorage
 * - 觸發 window 'microi:lang-change' 事件，供 ElConfigProvider 等響應式組件監聽
 */
export function setI18nLocale(locale) {
    const n = normalizeLocale(locale) || "zh-CN";
    ensureLocaleMessage(n);
    if (i18n.global.locale && typeof i18n.global.locale === "object" && "value" in i18n.global.locale) {
        i18n.global.locale.value = n;
    } else {
        i18n.global.locale = n;
    }
    if (!isEmbeddedWebosWindowRuntime()) {
        try { localStorage.setItem(LANG_STORAGE_KEY, n); } catch {}
        try { localStorage.setItem("language", n); } catch {}
        try { localStorage.setItem("lang", n); } catch {}
        try {
            const storage = JSON.parse(localStorage.getItem("microi.net") || "{}");
            storage.Lang = n;
            localStorage.setItem("microi.net", JSON.stringify(storage));
        } catch {}
    }
    try { document.documentElement.setAttribute("lang", n); } catch {}
    try { window.dispatchEvent(new CustomEvent("microi:lang-change", { detail: { locale: n } })); } catch {}
    return n;
}

try { document.documentElement.setAttribute("lang", initLocale); } catch {}

export default i18n;
