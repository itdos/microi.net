function normalizeBaseUrl(value) {
    return String(value || "").replace(/\/+$/, "");
}

function normalizeEntryPath(value) {
    const path = String(value || "index.html").trim().replace(/^\/+/, "");
    return path || "index.html";
}

export function appendMicroAppVersionQuery(url, version) {
    const normalizedVersion = String(version || "").trim();
    if (!normalizedVersion) return String(url || "");

    const separator = String(url || "").includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(normalizedVersion)}`;
}

export function buildMicroAppEntryUrl({ apiBase = "", osClient, appKey, version = "" }) {
    const path = `/micro-app/${encodeURIComponent(String(osClient || "").trim())}/${encodeURIComponent(String(appKey || "").trim())}/${normalizeEntryPath("index.html")}`;
    return appendMicroAppVersionQuery(`${normalizeBaseUrl(apiBase)}${path}`, version);
}

const RESOLVE_FALLBACK_DENY_REASONS = new Set([
    "TENANT_MISMATCH",
    "MICRO_APP_NOT_AVAILABLE",
    "MICRO_APP_PAGE_NOT_FOUND",
    "MICRO_APP_PAGE_RESOLVE_FAILED",
    "MICRO_APP_VERSION_MISMATCH"
]);

export function shouldUseMicroAppResolveFallback(result, { requirePage = false, requestedVersion = "" } = {}) {
    if (requirePage || String(requestedVersion || "").trim()) return false;
    const code = Number(result?.Code);
    if (code === 1 || code === 2 || code === 1001 || code === 1002) return false;
    const reasonCode = String(result?.Data?.ReasonCode || result?.DataAppend?.ReasonCode || "").trim().toUpperCase();
    return !RESOLVE_FALLBACK_DENY_REASONS.has(reasonCode);
}
