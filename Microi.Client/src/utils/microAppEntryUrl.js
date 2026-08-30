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

const BUNDLED_MICRO_APP_PAGES = Object.freeze({
    "microi-platform-service": Object.freeze({
        "/create-empty-tenant": { pageKey: "create-empty-tenant", sourceFile: "src/CreateSaasTenant.vue" },
        "/app-store-data-selector": { pageKey: "app-store-data-selector", sourceFile: "src/AppStoreDataSelector.vue" },
        "/app-package-selector": { pageKey: "app-package-selector", sourceFile: "src/AppPackageSelector.vue" },
        "/offline-package-installer": { pageKey: "offline-package-installer", sourceFile: "src/OfflinePackageInstaller.vue" },
        "/database-backup": { pageKey: "database-backup", sourceFile: "src/DatabaseBackup.vue" },
        "/personal-settings": { pageKey: "personal-settings", sourceFile: "src/PersonalSettings.vue" },
        "/system-settings": { pageKey: "system-settings", sourceFile: "src/SystemSettings.vue" },
        "/system-observability": { pageKey: "system-observability", sourceFile: "src/SystemObservability.vue" },
        "/marketplace": { pageKey: "marketplace", sourceFile: "src/Marketplace.vue" }
    })
});

function normalizeMicroRoutePath(value) {
    const path = String(value || "").trim().split(/[?#]/, 1)[0].replace(/\/+$/, "");
    return path ? (path.startsWith("/") ? path : `/${path}`) : "/";
}

export function getBundledMicroAppPageFallback({ appKey, routePath, requestedVersion = "" } = {}) {
    if (String(requestedVersion || "").trim()) return null;
    const pages = BUNDLED_MICRO_APP_PAGES[String(appKey || "").trim().toLowerCase()];
    return pages?.[normalizeMicroRoutePath(routePath)] || null;
}

export function shouldUseBundledMicroAppPageFallback(result, options = {}) {
    if (!getBundledMicroAppPageFallback(options)) return false;
    const code = Number(result?.Code);
    if (code === 1 || code === 2 || code === 1001 || code === 1002) return false;
    const reasonCode = String(result?.Data?.ReasonCode || result?.DataAppend?.ReasonCode || "").trim().toUpperCase();
    return !new Set([
        "TENANT_MISMATCH",
        "MICRO_APP_NOT_AVAILABLE",
        "MICRO_APP_VERSION_MISMATCH"
    ]).has(reasonCode);
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
