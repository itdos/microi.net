const MAX_TEMPLATE_CSS_LENGTH = 20000;
const UNSAFE_CSS_PATTERN = /@import|@namespace|@charset|url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding|<\/?style/gi;

export function extractTemplateStyles(value) {
    const styles = [];
    const html = String(value || "").replace(/<(style|styles)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (match, tag, css) => {
        styles.push(css || "");
        return "";
    });
    return { html, css: styles.join("\n") };
}

function sanitizeDeclarations(declarations) {
    if (!declarations || UNSAFE_CSS_PATTERN.test(declarations)) {
        UNSAFE_CSS_PATTERN.lastIndex = 0;
        return "";
    }
    UNSAFE_CSS_PATTERN.lastIndex = 0;
    return declarations
        .split(";")
        .map(item => item.trim())
        .filter(item => {
            if (!item) return false;
            const colon = item.indexOf(":");
            if (colon < 1) return false;
            const property = item.substring(0, colon).trim();
            return /^(--[a-z0-9_-]+|[a-z-]+)$/i.test(property);
        })
        .join(";");
}

function prefixSelector(selector, scopeSelector) {
    const clean = selector.trim();
    if (!clean || clean.startsWith("@")) return "";
    if (/^(html|body|:root)(\b|\s|\.|#|:)/i.test(clean)) return "";
    if (clean === ":host") return scopeSelector;
    if (clean.startsWith(":host")) return clean.replace(/^:host/, scopeSelector);
    return `${scopeSelector} ${clean}`;
}

/**
 * Allow hover and other ordinary selectors without allowing a table template
 * to style the rest of the application. Unsupported at-rules are dropped.
 */
export function scopeTemplateCss(css, scopeSelector) {
    const source = String(css || "").slice(0, MAX_TEMPLATE_CSS_LENGTH).replace(/\/\*[\s\S]*?\*\//g, "");
    if (!source || !scopeSelector || UNSAFE_CSS_PATTERN.test(source)) {
        UNSAFE_CSS_PATTERN.lastIndex = 0;
        return "";
    }
    UNSAFE_CSS_PATTERN.lastIndex = 0;

    const rules = [];
    const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    while ((match = rulePattern.exec(source))) {
        const declarations = sanitizeDeclarations(match[2]);
        if (!declarations) continue;
        const selectors = match[1]
            .split(",")
            .map(selector => prefixSelector(selector, scopeSelector))
            .filter(Boolean);
        if (selectors.length) rules.push(`${selectors.join(",")} { ${declarations} }`);
    }
    return rules.join("\n");
}
