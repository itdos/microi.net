import { shouldReuseRecordWorkbenchRoute } from "./record-id.js";

function parseJsonValue(value) {
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export function hasConfiguredPageTabs(value) {
    const tabs = parseJsonValue(value);
    if (!Array.isArray(tabs)) return false;
    const visibleTabs = tabs.filter((tab) => tab && tab.IsVisible !== false);
    return visibleTabs.length > 1
        || (visibleTabs.length === 1 && String(visibleTabs[0].Name || "").trim() !== "");
}

export function hasConfiguredModuleMetrics(value) {
    const schema = parseJsonValue(value);
    const views = Array.isArray(schema) ? schema : (Array.isArray(schema?.Views) ? schema.Views : []);
    return views.some((view) => {
        const scene = String(view?.Scene || view?.scene || "").toLowerCase();
        const metrics = view?.Layout?.Hero?.Metrics || view?.layout?.hero?.metrics;
        return (scene === "list" || scene === "card") && Array.isArray(metrics) && metrics.length > 0;
    });
}

export function buildPageTabQuery(query, tabName) {
    const nextQuery = { ...(query || {}) };
    const normalizedName = String(tabName || "").trim();
    if (normalizedName) nextQuery.Tab = normalizedName;
    else delete nextQuery.Tab;
    delete nextQuery.FormDataId;
    delete nextQuery.SysMenuId;
    delete nextQuery.Id;
    return nextQuery;
}

export function findPageTabTargetRoute(routes, targetSysMenuId) {
    const targetId = String(targetSysMenuId || "").trim();
    if (!targetId || !Array.isArray(routes)) return null;
    return routes.find((route) => {
        const meta = route?.meta || {};
        return String(meta.Id || meta.SysMenuId || route?.Id || "") === targetId;
    }) || null;
}

export function shouldReusePageTabRoute(view) {
    const meta = view?.meta || {};
    if (meta.microAppHost === true) return false;
    if (meta.pageTabsInPlace === true) return true;
    const query = view?.query || {};
    const isTableRoute = Boolean(meta.DiyTableId || meta.diyTableId);
    return isTableRoute && Object.prototype.hasOwnProperty.call(query, "Tab");
}

export function getPageTabRouteViewKey(route) {
    if (!route) return "";
    return shouldReusePageTabRoute(route) || shouldReuseRecordWorkbenchRoute(route)
        ? String(route.path || route.fullPath || "")
        : String(route.fullPath || route.path || "");
}
