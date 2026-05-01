/**
 * XSS 安全 HTML 净化工具
 *
 * 用法：
 *   1) 模板：<div v-safe-html="userContent"></div>   （已通过 main.js 注册）
 *   2) JS：  import { sanitizeHtml } from '@/utils/safe-html'
 *           el.innerHTML = sanitizeHtml(html)
 *
 * 替代 v-html 的不安全用法。所有 <script>、on* 事件、javascript:/data: 协议会被剔除。
 */
import DOMPurify from "dompurify";

const DEFAULT_CONFIG = {
    // 显式禁止 script 与事件属性、危险标签
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "base", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "oninput", "onsubmit"],
    // 仅允许常规 URL 协议；阻止 javascript:、data: (除安全图片外)
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    USE_PROFILES: { html: true }
};

/**
 * 净化 HTML
 * @param {string} dirty 原始 HTML
 * @param {object} [config] DOMPurify 自定义配置（合并到默认）
 * @returns {string} 安全 HTML
 */
export function sanitizeHtml(dirty, config) {
    if (dirty === null || dirty === undefined) return "";
    try {
        return DOMPurify.sanitize(String(dirty), { ...DEFAULT_CONFIG, ...(config || {}) });
    } catch (e) {
        console.warn("[safe-html] sanitize 失败：", e && e.message);
        return "";
    }
}

/**
 * Vue 3 自定义指令 v-safe-html
 *  - bind/update 时调用 sanitize 后写入 innerHTML
 */
export const SafeHtmlDirective = {
    mounted(el, binding) {
        el.innerHTML = sanitizeHtml(binding.value, binding.arg ? undefined : undefined);
    },
    updated(el, binding) {
        if (binding.value === binding.oldValue) return;
        el.innerHTML = sanitizeHtml(binding.value);
    },
    unmounted(el) {
        el.innerHTML = "";
    }
};

export default SafeHtmlDirective;
