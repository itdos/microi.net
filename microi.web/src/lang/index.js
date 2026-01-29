// Vue I18n v9 for Vue 3
import { createI18n } from "vue-i18n";
// Element Plus 语言包
import elementEnLocale from "element-plus/dist/locale/en.mjs";
import elementZhLocale from "element-plus/dist/locale/zh-cn.mjs";
import enLocale from "./en";
import zhLocale from "./zh";

const messages = {
    en: {
        ...enLocale,
        ...elementEnLocale
    },
    cn: {
        ...zhLocale,
        ...elementZhLocale
    },
    zh: {
        ...zhLocale,
        ...elementZhLocale
    },
    "zh-CN": {
        ...zhLocale,
        ...elementZhLocale
    },
    "zh-TW": {
        ...zhLocale,
        ...elementZhLocale
    }
};

// 获取语言设置（兼容新旧存储格式）
function getLangFromStorage() {
    // 优先从 microi.net 统一存储中获取
    try {
        const stored = localStorage.getItem("microi.net");
        if (stored) {
            const data = JSON.parse(stored);
            if (data.Lang) return data.Lang;
        }
    } catch {}
    // 兼容旧格式
    return localStorage.getItem("Microi.Lang");
}

export function getLanguage() {
    const chooseLanguage = getLangFromStorage();
    if (chooseLanguage) return chooseLanguage;

    // if has not choose language
    const language = (navigator.language || navigator.browserLanguage).toLowerCase();
    const locales = Object.keys(messages);
    for (const locale of locales) {
        if (language.indexOf(locale) > -1) {
            return locale;
        }
    }
    return "zh-CN";
}

const i18n = createI18n({
    legacy: true, // 使用 legacy 模式兼容 Options API
    locale: getLanguage(),
    messages,
    silentTranslationWarn: true,
    silentFallbackWarn: true,
    globalInjection: true // 全局注入 $t
});

export default i18n;
