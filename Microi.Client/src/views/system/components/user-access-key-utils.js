export const ACCESS_KEY_WILDCARD = "*";

export function normalizeAccessRoute(value) {
    let path = String(value || "").trim();
    if (!path) return "";
    // `/*` was produced by the first UI when a user typed `*`. Keep it as a
    // compatibility alias, but persist and expose only the canonical `*`.
    if (path === ACCESS_KEY_WILDCARD || path === "/*") return ACCESS_KEY_WILDCARD;

    try {
        if (/^https?:\/\//i.test(path)) {
            const url = new URL(path);
            path = url.hash && url.hash.startsWith("#/")
                ? url.hash.substring(1)
                : url.pathname;
        } else if (path.includes("#/")) {
            path = path.substring(path.indexOf("#/") + 1);
        }
        path = decodeURIComponent(path);
    } catch (_) {}

    if (!path.startsWith("/")) path = "/" + path;
    path = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
    return path;
}

export function isWildcardAccessScope(values) {
    return Array.isArray(values)
        && values.some((value) => normalizeAccessRoute(value) === ACCESS_KEY_WILDCARD);
}

export function isAccessRouteAllowed(values, route) {
    if (!Array.isArray(values)) return false;
    if (isWildcardAccessScope(values)) return true;
    const target = normalizeAccessRoute(route);
    return Boolean(target) && values.map(normalizeAccessRoute).includes(target);
}

export function buildAccessLoginUrl({ origin, pathname, osClient, loginPath }) {
    const rawPath = String(pathname || "/");
    const basePath = rawPath.endsWith("/")
        ? rawPath
        : rawPath.substring(0, rawPath.lastIndexOf("/") + 1);
    const tenantQuery = new URLSearchParams();
    if (String(osClient || "").trim()) {
        tenantQuery.set("OsClient", String(osClient).trim());
    }
    const hashPath = String(loginPath || "").replace(/^\/?#/, "#");
    return String(origin || "")
        + basePath
        + (tenantQuery.toString() ? "?" + tenantQuery.toString() : "")
        + hashPath;
}
