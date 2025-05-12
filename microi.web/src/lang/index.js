import Vue from "vue";
import VueI18n from "vue-i18n";
// import Cookies from 'js-cookie'// by itdos.com
import elementEnLocale from "element-ui/lib/locale/lang/en"; // element-ui lang
import elementZhLocale from "element-ui/lib/locale/lang/zh-CN"; // element-ui lang
// import elementEsLocale from 'element-ui/lib/locale/lang/es'// element-ui lang
// import elementJaLocale from 'element-ui/lib/locale/lang/ja'// element-ui lang
import enLocale from "./en";
import zhLocale from "./zh";
// import esLocale from './es'
// import jaLocale from './ja'

Vue.use(VueI18n);

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
  //   es: {
  //     ...esLocale,
  //     ...elementEsLocale
  //   },
  //   ja: {
  //     ...jaLocale,
  //     ...elementJaLocale
  //   }
};
export function getLanguage() {
  //   const chooseLanguage = Cookies.get('language') // by itdos.com
  const chooseLanguage = localStorage.getItem("language");
  if (chooseLanguage) return chooseLanguage;

  // if has not choose language
  const language = (
    navigator.language || navigator.browserLanguage
  ).toLowerCase();
  const locales = Object.keys(messages);
  for (const locale of locales) {
    if (language.indexOf(locale) > -1) {
      return locale;
    }
  }
  return "zh-CN";
}
const i18n = new VueI18n({
  // set locale
  // options: en | zh | es
  locale: getLanguage(),
  // set locale messages
  messages,
  silentTranslationWarn: true // 去掉i18n 警告  by itdos
});

export default i18n;
