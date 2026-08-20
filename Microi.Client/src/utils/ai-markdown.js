import { marked } from "marked";
import { sanitizeHtml } from "@/utils/safe-html";

const MARKDOWN_OPTIONS = Object.freeze({
    async: false,
    breaks: true,
    gfm: true
});

/**
 * 将 AI 的 Markdown 回复转换为经过白名单净化的 HTML。
 * Markdown 是展示协议，不应要求模型退化为纯文本；任何原始 HTML 仍需经过 DOMPurify。
 */
export function renderAiMarkdown(value) {
    if (value === null || value === undefined || value === "") return "";
    try {
        return sanitizeHtml(marked.parse(String(value), MARKDOWN_OPTIONS));
    } catch (error) {
        console.warn("[ai-markdown] render failed:", error && error.message);
        return sanitizeHtml(String(value));
    }
}

export default renderAiMarkdown;
