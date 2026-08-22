const PRIVATE_ASSET_PREFIX = "/__microi_richtext_private__/";
const SUPPORTED_TAG_PATTERN = /<(img|video|source|a)\b[^>]*>/giu;
const ATTRIBUTE_URL_PATTERN = /(^|\s)(src|href)\s*=\s*(["'])(.*?)\3/giu;

function toBoolean(value, fallback) {
    if (value === true || value === false) return value;
    if (value === 1 || value === "1" || value === "true" || value === "True") return true;
    if (value === 0 || value === "0" || value === "false" || value === "False") return false;
    return fallback;
}

function positiveNumber(value, fallback, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return fallback;
    return Math.min(maximum, number);
}

function decodeHtmlAttribute(value) {
    return String(value || "")
        .replace(/&amp;/giu, "&")
        .replace(/&quot;/giu, '"')
        .replace(/&#39;|&apos;/giu, "'");
}

function encodeHtmlAttribute(value, quote) {
    let result = String(value || "").replace(/&/gu, "&amp;");
    result = quote === "'"
        ? result.replace(/'/gu, "&#39;")
        : result.replace(/"/gu, "&quot;");
    return result;
}

function normalizePath(value) {
    return String(value || "").trim().replace(/\\/gu, "/");
}

function replaceSupportedAssetAttributes(html, callback) {
    return String(html || "").replace(SUPPORTED_TAG_PATTERN, (tag, rawTagName) => {
        const tagName = String(rawTagName || "").toLowerCase();
        return tag.replace(ATTRIBUTE_URL_PATTERN, (match, prefix, rawAttributeName, quote, rawValue) => {
            const attributeName = String(rawAttributeName || "").toLowerCase();
            const supported = tagName === "a" ? attributeName === "href" : attributeName === "src";
            if (!supported) return match;
            const replacement = callback({ tagName, attributeName, quote, rawValue });
            return replacement == null ? match : `${prefix}${replacement}`;
        });
    });
}

function normalizeMediaConfig(value, defaults) {
    const source = value && typeof value === "object" ? value : {};
    return {
        Enabled: toBoolean(source.Enabled, defaults.Enabled),
        MaxSize: positiveNumber(source.MaxSize, defaults.MaxSize, 2048),
        MaxCount: positiveNumber(source.MaxCount, defaults.MaxCount, 100),
        ...(defaults.Preview === undefined ? {} : {
            Preview: toBoolean(source.Preview, defaults.Preview),
            CompressMaxSize: positiveNumber(source.CompressMaxSize, defaults.CompressMaxSize, 10240),
            CompressMaxWidth: positiveNumber(source.CompressMaxWidth, defaults.CompressMaxWidth, 12000)
        }),
        ...(defaults.Accept === undefined ? {} : {
            Accept: String(source.Accept || defaults.Accept || "").trim()
        })
    };
}

/**
 * RichText 老字段没有上传配置。为避免历史页面在升级后把附件意外公开，缺省值固定为私有桶。
 */
export function normalizeRichTextConfig(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
        EditorProduct: source.EditorProduct || "WangEditor",
        Limit: toBoolean(source.Limit, true),
        Image: normalizeMediaConfig(source.Image, {
            Enabled: true,
            MaxSize: 20,
            MaxCount: 10,
            Preview: true,
            CompressMaxSize: 500,
            CompressMaxWidth: 1920
        }),
        Video: normalizeMediaConfig(source.Video, {
            Enabled: true,
            MaxSize: 200,
            MaxCount: 3
        }),
        File: normalizeMediaConfig(source.File, {
            Enabled: true,
            MaxSize: 100,
            MaxCount: 10,
            Accept: ""
        })
    };
}

export function buildRichTextPrivateAssetMarker(path) {
    const normalized = normalizePath(path);
    return normalized ? PRIVATE_ASSET_PREFIX + encodeURIComponent(normalized) : "";
}

export function getRichTextPrivateAssetPath(url) {
    const value = decodeHtmlAttribute(url).trim();
    let markerPath = value;
    try {
        const parsed = new URL(value);
        markerPath = parsed.pathname;
    } catch (error) {
        // 相对 marker 是标准持久化格式，无需依赖浏览器 origin。
    }
    if (!markerPath.startsWith(PRIVATE_ASSET_PREFIX)) return "";
    const encoded = markerPath.slice(PRIVATE_ASSET_PREFIX.length).split(/[?#]/u)[0];
    if (!encoded) return "";
    try {
        return normalizePath(decodeURIComponent(encoded));
    } catch (error) {
        return "";
    }
}

/** 只从 src/href 属性提取私有对象标识，正文中的普通文字不能成为授权依据。 */
export function collectRichTextPrivateAssetPaths(html) {
    const paths = [];
    const seen = new Set();
    replaceSupportedAssetAttributes(html, ({ rawValue }) => {
        const path = getRichTextPrivateAssetPath(rawValue);
        if (path && !seen.has(path)) {
            seen.add(path);
            paths.push(path);
        }
        return null;
    });
    return paths;
}

/** 把持久化的稳定对象标识换成本次打开页面可用的短期审计代理 URL。 */
export function hydrateRichTextPrivateAssetUrls(html, resolvedUrls) {
    const urlMap = resolvedUrls instanceof Map ? resolvedUrls : new Map(Object.entries(resolvedUrls || {}));
    return replaceSupportedAssetAttributes(html, ({ attributeName, quote, rawValue }) => {
        const path = getRichTextPrivateAssetPath(rawValue);
        const runtimeUrl = path ? urlMap.get(path) : "";
        return runtimeUrl
            ? `${attributeName}=${quote}${encodeHtmlAttribute(runtimeUrl, quote)}${quote}`
            : null;
    });
}

/** 编辑器运行时可以使用短效 URL，但提交到业务字段前必须还原为稳定标识。 */
export function canonicalizeRichTextAssetUrls(html, runtimeUrlMarkers) {
    const markerMap = runtimeUrlMarkers instanceof Map
        ? runtimeUrlMarkers
        : new Map(Object.entries(runtimeUrlMarkers || {}));
    return replaceSupportedAssetAttributes(html, ({ attributeName, quote, rawValue }) => {
        const runtimeUrl = decodeHtmlAttribute(rawValue);
        const marker = markerMap.get(runtimeUrl);
        return marker
            ? `${attributeName}=${quote}${encodeHtmlAttribute(marker, quote)}${quote}`
            : null;
    });
}

export const RICH_TEXT_PRIVATE_ASSET_PREFIX = PRIVATE_ASSET_PREFIX;
