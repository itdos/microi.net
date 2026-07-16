function normalizeRoutePath(value, fallback = "/") {
    const routePath = String(value || fallback).trim() || fallback;
    return routePath.startsWith("/") ? routePath : "/" + routePath;
}

function encodeMicroRouteSuffix(value) {
    const routePath = normalizeRoutePath(value);
    if (routePath === "/") return "";
    return routePath
        .split("/")
        .filter(Boolean)
        .map((part) => encodeURIComponent(part))
        .join("/");
}

function isExternalRoutePath(value) {
    return /^(https?:)?\/\//i.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function isCanonicalMicroAppPath(value) {
    const routePath = normalizeRoutePath(value);
    return routePath === "/micro-app" || routePath.startsWith("/micro-app/");
}

/**
 * Installed MicroService menus may intentionally keep their historical URL in
 * sys_menu.Url. Treat that URL as the primary route and keep the canonical
 * /micro-app URL as an alias. Directly published entry URLs remain canonical.
 */
export function resolveMicroAppMenuPaths({
    menuUrl,
    legacyMenuUrl,
    friendlyPath
}) {
    const explicitLegacy = String(legacyMenuUrl || "").trim();
    const currentUrl = String(menuUrl || "").trim();
    let legacy = explicitLegacy;
    if (!legacy && currentUrl && !isExternalRoutePath(currentUrl) && !isCanonicalMicroAppPath(currentUrl)) {
        legacy = normalizeRoutePath(currentUrl);
    }
    return {
        legacyMenuUrl: legacy,
        primaryPath: legacy || normalizeRoutePath(friendlyPath || currentUrl)
    };
}

/**
 * A MicroApp menu may retain its historical URL while the same page is also
 * addressable by the canonical /micro-app/{key-or-id}/{route} URL. Vue Router
 * aliases keep both contracts on one route record and one host component.
 */
export function buildMicroAppRouteAliases({
    primaryPath,
    friendlyPath,
    serviceId,
    routePath
}) {
    const primary = normalizeRoutePath(primaryPath);
    const suffix = encodeMicroRouteSuffix(routePath);
    const candidates = [friendlyPath];
    if (serviceId) {
        candidates.push(`/micro-app/${encodeURIComponent(String(serviceId))}${suffix ? "/" + suffix : ""}`);
    }

    const aliases = [];
    const seen = new Set([primary]);
    candidates.forEach((value) => {
        if (!value) return;
        const alias = normalizeRoutePath(value);
        if (seen.has(alias)) return;
        seen.add(alias);
        aliases.push(alias);
    });
    return aliases;
}
