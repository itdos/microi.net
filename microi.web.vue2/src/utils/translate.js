import i18n from '@/lang'

/**
 * 根据当前语言环境决定是否翻译
 * 在中文简体环境下，直接返回中文文本，不进行翻译
 * @param {string} key - 翻译键值
 * @param {string} zhText - 中文文本
 * @returns {string} 翻译后的文本或中文文本
 */
export function translate(key, zhText) {
  const currentLang = i18n.locale
  // 中文简体环境下直接返回中文文本
  if (currentLang === 'zh-CN' || currentLang === 'zh' || currentLang === 'cn') {
    return zhText
  }
  // 其他语言环境下使用翻译
  return i18n.t(key)
}
