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
import { extractTemplateStyles, scopeTemplateCss } from "@/utils/table-template-style";

let templateScopeSeed = 0;
const TEMPLATE_STYLE_KEY = "__microiSafeTemplateStyle";
const TEMPLATE_SCOPE_KEY = "__microiSafeTemplateScope";

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!node || !node.hasAttribute || !node.hasAttribute("target")) return;
    const target = String(node.getAttribute("target") || "").toLowerCase();
    if (!["_blank", "_self", "_parent", "_top"].includes(target)) {
        node.removeAttribute("target");
        return;
    }
    if (target === "_blank") {
        node.setAttribute("rel", "noopener noreferrer");
    }
});

const DEFAULT_CONFIG = {
    // 显式禁止 script 与事件属性、危险标签
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "base", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "oninput", "onsubmit"],
    // 仅允许常规 URL 协议；阻止 javascript:、data: (除安全图片外)
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ADD_ATTR: ["target"],
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

function clearTemplateStyle(el) {
    if (el && el[TEMPLATE_STYLE_KEY] && el[TEMPLATE_STYLE_KEY].parentNode) {
        el[TEMPLATE_STYLE_KEY].parentNode.removeChild(el[TEMPLATE_STYLE_KEY]);
    }
    if (el) el[TEMPLATE_STYLE_KEY] = null;
}

function renderSafeHtml(el, binding) {
    const useTemplateStyle = binding && binding.arg === "template";
    clearTemplateStyle(el);

    if (!useTemplateStyle) {
        el.removeAttribute("data-microi-template-scope");
        el.innerHTML = sanitizeHtml(binding && binding.value);
        return;
    }

    const extracted = extractTemplateStyles(binding.value);
    if (!el[TEMPLATE_SCOPE_KEY]) {
        templateScopeSeed += 1;
        el[TEMPLATE_SCOPE_KEY] = `mci-tpl-${templateScopeSeed}`;
    }
    const scopeId = el[TEMPLATE_SCOPE_KEY];
    const scopeSelector = `[data-microi-template-scope="${scopeId}"]`;
    el.setAttribute("data-microi-template-scope", scopeId);
    el.innerHTML = sanitizeHtml(extracted.html);

    const scopedCss = scopeTemplateCss(extracted.css, scopeSelector);
    if (scopedCss && typeof document !== "undefined" && document.head) {
        const style = document.createElement("style");
        style.setAttribute("data-microi-template-style", scopeId);
        style.textContent = scopedCss;
        document.head.appendChild(style);
        el[TEMPLATE_STYLE_KEY] = style;
    }
}

/**
 * Vue 3 自定义指令 v-safe-html
 *  - bind/update 时调用 sanitize 后写入 innerHTML
 */
export const SafeHtmlDirective = {
    mounted(el, binding) {
        renderSafeHtml(el, binding);
    },
    updated(el, binding) {
        if (binding.value === binding.oldValue) return;
        renderSafeHtml(el, binding);
    },
    unmounted(el) {
        clearTemplateStyle(el);
        el.innerHTML = "";
    }
};

export default SafeHtmlDirective;
