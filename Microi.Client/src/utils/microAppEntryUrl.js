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
