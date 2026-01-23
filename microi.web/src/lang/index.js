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

export function getLanguage() {
    const chooseLanguage = localStorage.getItem("Microi.Lang");
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
