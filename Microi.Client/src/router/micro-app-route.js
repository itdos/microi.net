function decodeSegment(value) {
    try { return decodeURIComponent(String(value || "")); }
    catch { return String(value || ""); }
}

function normalizeRoutePath(value) {
    const path = String(value || "/").trim().replace(/^#/, "");
    return path.startsWith("/") ? path : "/" + path;
}

export function buildMicroAppFriendlyPath({ osClient, appKey, routePath = "/" } = {}) {
    const tenant = String(osClient || "").trim();
    const key = String(appKey || "").trim();
    if (!tenant || !key) throw new Error("微服务路由缺少租户或 AppKey");
    const route = normalizeRoutePath(routePath);
    const suffixIndex = route.search(/[?#]/);
    const pathname = suffixIndex < 0 ? route : route.slice(0, suffixIndex);
    const queryAndHash = suffixIndex < 0 ? "" : route.slice(suffixIndex);
    const suffix = pathname.split("/").filter(Boolean).map(part => encodeURIComponent(decodeSegment(part))).join("/");
    return `/micro-app/${encodeURIComponent(tenant)}/${encodeURIComponent(key)}${suffix ? "/" + suffix : ""}${queryAndHash}`;
}

/**
 * 根据可信当前租户区分新租户/应用路由与历史应用/页面深链接。
 * 无明确格式标记的歧义地址保留旧语义，始终不能选择其他请求或会话租户。
 * 菜单坐标提示用于兼容 AppKey 与租户同名的历史地址。
 */
export function parseMicroAppPath(value, {
    osClient = "", appKeyHint = "", routePathHint = "", format = "auto",
    origin = "http://microi.invalid"
} = {}) {
    const result = { appKey: "", osClient: "", version: "", routePath: "",
        isEntryUrl: false, isFriendlyRoute: false, isTenantScoped: false };
    if (!value) return result;
    let raw = String(value).trim();
    if (raw.startsWith("#/")) raw = raw.slice(1);
    let parsed;
    try { parsed = new URL(raw, origin); } catch { return result; }
    // 完整浏览器地址从 # 读取宿主路由，API 资源入口仍使用 pathname。
    if (parsed.hash.startsWith("#/micro-app/")) parsed = new URL(parsed.hash.slice(1), origin);
    const segments = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean).map(decodeSegment);
    if (segments[0] !== "micro-app") return result;
    const indexHtmlIndex = segments.findIndex(segment => segment.toLowerCase() === "index.html");
    const currentTenant = String(osClient || "").trim();
    const hint = String(appKeyHint || "").trim();
    const legacySuffix = normalizeRoutePath(segments.slice(2).join("/"));
    const scopedSuffix = normalizeRoutePath(segments.slice(3).join("/"));
    const hintRoute = routePathHint ? normalizeRoutePath(routePathHint).split(/[?#]/, 1)[0] : "";
    const hintedLegacy = hint && segments[1] === hint && hintRoute && legacySuffix === hintRoute;
    const hintedScoped = hint && segments[2] === hint && hintRoute && scopedSuffix === hintRoute;
    const scoped = indexHtmlIndex >= 0 || format === "scoped"
        || (format !== "legacy" && segments.length >= 3 && !hintedLegacy
            && ((segments[1] || "").toLowerCase() === currentTenant.toLowerCase() || hintedScoped));
    result.isEntryUrl = indexHtmlIndex >= 0;
    result.isFriendlyRoute = !result.isEntryUrl;
    result.isTenantScoped = scoped;
    result.osClient = scoped ? (segments[1] || "") : "";
    result.appKey = segments[scoped ? 2 : 1] || "";
    if (result.isEntryUrl) {
        if (indexHtmlIndex > 3) result.version = segments[3] || "";
    } else {
        result.routePath = scoped ? scopedSuffix : legacySuffix;
    }
    result.version ||= parsed.searchParams.get("v") || parsed.searchParams.get("version") || "";
    // 带租户的友好路径决定应用和页面坐标；历史调用与静态入口继续兼容查询串页面。
    const queryRoute = parsed.searchParams.get("microRoute") || parsed.searchParams.get("routePath");
    if (queryRoute && (!scoped || result.isEntryUrl)) result.routePath = normalizeRoutePath(queryRoute);
    return result;
}

export function assertMicroAppTenant(config, currentOsClient) {
    if (!config?.isTenantScoped) return;
    const tenant = String(currentOsClient || "").trim();
    if (!tenant || String(config.osClient || "").toLowerCase() !== tenant.toLowerCase()) {
        const error = new Error("微服务路由租户与当前登录租户不一致，请在对应租户重新打开页面。");
        error.reasonCode = "TENANT_MISMATCH";
        throw error;
    }
}
