const FILE_REFERENCE_KEYS = [
    "Path",
    "path",
    "FilePathName",
    "filePathName",
    "Url",
    "url"
];

function unwrapFileReference(value, depth = 0) {
    if (value == null || depth > 5) return "";

    if (Array.isArray(value)) {
        for (const item of value) {
            const path = unwrapFileReference(item, depth + 1);
            if (path) return path;
        }
        return "";
    }

    if (typeof value === "object") {
        for (const key of FILE_REFERENCE_KEYS) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const path = unwrapFileReference(value[key], depth + 1);
                if (path) return path;
            }
        }
        return "";
    }

    const text = String(value).trim();
    if (!text) return "";

    if (text.startsWith("{") || text.startsWith("[")) {
        try {
            return unwrapFileReference(JSON.parse(text), depth + 1);
        } catch (error) {
            return text;
        }
    }

    return text;
}

/**
 * Resolve SysConfig.SysLogo across Microi's supported file-storage shapes:
 * a Path object, JSON object/array string, absolute URL, app-relative asset,
 * or HDFS path relative to FileServer.
 */
export function resolveLoginResourceUrl(value, getServerPath) {
    const path = unwrapFileReference(value);
    if (!path) return "";

    if (/^(?:https?:|data:|blob:)/i.test(path) || path.startsWith("//") || path.startsWith(".")) {
        return path;
    }

    const storagePath = path.startsWith("/") ? path : `/${path}`;
    if (typeof getServerPath !== "function") return storagePath;

    try {
        return String(getServerPath(storagePath, false) || "").trim();
    } catch (error) {
        return storagePath;
    }
}

export function resolveLoginSystemLogoUrl(value, getServerPath) {
    return resolveLoginResourceUrl(value, getServerPath);
}

export { unwrapFileReference };
