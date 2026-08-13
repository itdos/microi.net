// Pinia Store - Permission
import { defineStore } from "pinia";
import { asyncRoutes, constantRoutes } from "@/router";
import { DiyApi, DiyCommon, DiyTable, DiyMyWork, DiyFlowIndex } from "@/utils/microi.net.import";
import Layout from "@/layout";
import { DiyOsClient } from "@/utils/itdos.osclient";
import _ from "underscore";
import { buildMicroAppRouteAliases, resolveMicroAppMenuPaths } from "@/router/micro-app-route-alias";
// Vue Router 4 支持直接使用 () => import() 形式，不需要 defineAsyncComponent

/**
 * Use meta.role to determine if the current user has permission
 */
function hasPermission(roles, route) {
    if (route.meta && route.meta.roles) {
        return roles.some((role) => route.meta.roles.includes(role));
    } else {
        return true;
    }
}

// 路径映射表：服务器返回的路径 -> 实际文件路径
const pathMappings = {
    // workflow 相关映射
    "/microi.net/workflow/": "/diy/workflow/",
    "/microi/workflow/": "/diy/workflow/",
    // page-engine 相关映射
    "/page-engine/page-renderer": "/page-engine/renderer",
    // form 相关映射
    "/microi.net/diy-form-page": "/diy/diy-form-page",
    "/diy/diy-components/iframe": "/form-engine/diy-components/iframe",
    "/micro-app/host": "/micro-app/host",
    // system 相关映射
    "/itdos/system/sys-log": "/system/sys-log",
    "/itdos/system/sys-monitor": "/system/sys-monitor",
    "/itdos/system/sysrole-manage": "/system/sysrole-manage",
    "/itdos/system/sysdept-manage": "/system/sysdept-manage",
    "/itdos/system/sysuser-manage": "/system/sysuser-manage",
    "/diy/diy-table-rowlist": "/diy/diy-table",
    "/diy/left-right/LeftTreeJoinRightForm" : "/form-engine/left-right/LeftTreeJoinRightForm"
};

// 已知不存在的组件路径（静默处理，不打印警告）
const ignoredPaths = ["/microi.printengine/", "/diy/form-designer", "/diy/form-renderer", "/page-engine/print-designer"];

function normalizeComponentPath(componentPath) {
    let normalized = componentPath;

    // 应用路径映射
    for (const [from, to] of Object.entries(pathMappings)) {
        if (normalized.includes(from)) {
            normalized = normalized.replace(from, to);
            break;
        }
    }

    return normalized;
}

// 检查是否应该忽略此路径的警告
function shouldIgnoreWarning(componentPath) {
    return false;
    return ignoredPaths.some((ignoredPath) => componentPath.includes(ignoredPath));
}

function normalizeIframeRouteUrl(url) {
    if (DiyCommon.IsNull(url)) return "";
    var rawUrl = String(url).trim();
    if (rawUrl.startsWith("/iframe/")) {
        rawUrl = rawUrl.replace("/iframe/", "");
    }
    try {
        rawUrl = decodeURIComponent(rawUrl);
    } catch (error) { }
    return "/iframe/" + encodeURIComponent(rawUrl);
}

function isExternalRoutePath(routePath) {
    return /^(https?:)?\/\//i.test(routePath) || /^[a-z][a-z0-9+.-]*:/i.test(routePath);
}

export function normalizeMenuRoutePath(url, fallback = "/") {
    let routePath = DiyCommon.IsNull(url) ? fallback : String(url).trim();
    if (DiyCommon.IsNull(routePath)) routePath = fallback;
    routePath = String(routePath || "").trim();
    if (!routePath) return "/";

    if (routePath.startsWith("/#/")) {
        routePath = routePath.substring(2);
    } else if (routePath.startsWith("#/")) {
        routePath = routePath.substring(1);
    } else if (routePath.startsWith("#")) {
        routePath = routePath.substring(1);
    }

    if (!routePath) return "/";
    if (isExternalRoutePath(routePath)) return routePath;
    return routePath.startsWith("/") ? routePath : "/" + routePath;
}

function isIframeMenu(item) {
    return item && (item.OpenType === "Iframe" || item.OpenType === "iframe" || (item.Url && item.Url.startsWith("/iframe/")));
}

function isMicroAppMenu(item) {
    if (!item) return false;
    const openType = String(item.OpenType || "").toLowerCase();
    const isLegacyMicroService = item.IsMicroiService === true
        || item.IsMicroiService === 1
        || item.IsMicroiService === "1"
        || String(item.IsMicroiService || "").toLowerCase() === "true";
    return openType === "microapp"
        || openType === "micro-app"
        || openType === "micro_app"
        || openType === "microservice"
        || openType === "micro-service"
        || openType === "micro_service"
        || isLegacyMicroService
        || (!DiyCommon.IsNull(item.ComponentPath) && String(item.ComponentPath).indexOf("/micro-app/host") > -1);
}

function isMenuVisible(item) {
    return item && item.Display !== 0 && item.Display !== "0" && !item.hidden;
}

function getVisibleMenuChildren(item) {
    if (!item || !Array.isArray(item._Child)) return [];
    return item._Child.filter((child) => isMenuVisible(child));
}

function repairOfficialMenuTitle(item) {
    if (!item || String(item.Name || "").trim()) return;
    const menuId = String(item.Id || "").toLowerCase();
    const menuUrl = normalizeMenuRoutePath(item.Url || "", "").toLowerCase();
    if (menuId === "61b7faee-35b2-4571-add2-5231a355f368" || menuUrl === "/microi-store") {
        // Compatibility for tenants affected by the historical upgrade sparse-
        // write bug. The server upgrade repairs the row permanently; this keeps
        // navigation and tags readable before that repair has run.
        item.Name = "应用商城";
    }
}

function safeDecode(value) {
    if (DiyCommon.IsNull(value)) return "";
    try {
        return decodeURIComponent(String(value).replace(/\+/g, "%20"));
    } catch (error) {
        return String(value);
    }
}

function normalizeMicroRoutePath(value) {
    const routePath = safeDecode(value || "/").trim();
    if (!routePath || routePath === "/") return "/";
    return routePath.startsWith("/") ? routePath : "/" + routePath;
}

function encodeMicroRoutePath(value) {
    const routePath = normalizeMicroRoutePath(value);
    if (routePath === "/") return "";
    return routePath
        .split("/")
        .filter(Boolean)
        .map((part) => encodeURIComponent(part))
        .join("/");
}

function parseMicroAppUrl(value) {
    const result = {
        appKey: "",
        routePath: "",
        version: "",
        isEntryUrl: false,
        isFriendlyRoute: false
    };
    if (DiyCommon.IsNull(value)) return result;

    const rawUrl = safeDecode(value).trim();
    let parsedUrl = null;
    try {
        parsedUrl = new URL(rawUrl, window.location.origin);
    } catch (error) {
        parsedUrl = null;
    }

    const pathname = (parsedUrl ? parsedUrl.pathname : rawUrl.split(/[?#]/)[0]).replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] !== "micro-app") return result;

    const indexHtmlIndex = segments.findIndex((segment) => segment.toLowerCase() === "index.html");
    if (indexHtmlIndex > -1) {
        result.isEntryUrl = true;
        result.appKey = safeDecode(segments[2] || "");
        if (indexHtmlIndex > 3) {
            result.version = safeDecode(segments[3] || "");
        }
    } else {
        result.isFriendlyRoute = true;
        result.appKey = safeDecode(segments[1] || "");
        result.routePath = normalizeMicroRoutePath(segments.slice(2).map(safeDecode).join("/"));
    }

    if (parsedUrl) {
        const routePath = parsedUrl.searchParams.get("microRoute") || parsedUrl.searchParams.get("routePath") || "";
        if (routePath) result.routePath = normalizeMicroRoutePath(routePath);
    }

    return result;
}

function buildMicroAppMenuPath(item) {
    const parsedUrl = parseMicroAppUrl(item.Url);
    const appKey = item.MicroServiceKey || item.MsKey || item.AppKey || parsedUrl.appKey || DiyCommon.GuidRemoveSing(item.MicroServiceId || item.Id);
    const routePath = normalizeMicroRoutePath(item.MicroServiceRoutePath || parsedUrl.routePath || "/");
    const encodedRoutePath = encodeMicroRoutePath(routePath);
    return `/micro-app/${encodeURIComponent(appKey)}${encodedRoutePath ? "/" + encodedRoutePath : ""}`;
}

function appendMicroAppMeta(meta, item) {
    const friendlyConfig = parseMicroAppUrl(item.MicroAppFriendlyUrl || "");
    const resolvedAppKey = item.MicroServiceKey
        || item.MsKey
        || item.AppKey
        || friendlyConfig.appKey
        || (item.MicroServiceId ? DiyCommon.GuidRemoveSing(item.MicroServiceId) : "");
    meta.OpenType = item.OpenType;
    meta.Url = item.LegacyMenuUrl ? "" : item.Url;
    meta.LegacyMenuUrl = item.LegacyMenuUrl;
    meta.UrlApiEngineId = item.UrlApiEngineId;
    meta.ComponentPath = item.ComponentPath;
    meta.MicroAppUrl = item.MicroAppUrl;
    meta.MicroAppUrlApiEngineId = item.MicroAppUrlApiEngineId;
    meta.MicroServiceId = item.MicroServiceId;
    meta.MicroServiceKey = item.MicroServiceKey;
    meta.MsKey = item.MsKey;
    meta.AppKey = resolvedAppKey;
    meta.MicroAppFriendlyUrl = item.MicroAppFriendlyUrl;
    meta.MicroServicePageId = item.MicroServicePageId;
    meta.MicroServiceRoutePath = item.MicroServiceRoutePath;
    meta.RoutePath = item.MicroServiceRoutePath;
    meta.ModuleEngineKey = item.ModuleEngineKey;
    if (isMicroAppMenu(item)) {
        // Vue only owns the short-lived host component. The micro-app runtime
        // is the single state-cache owner and restores the child by stable tab
        // identity; this avoids detached Vue hosts racing on route changes.
        meta.keepAlive = false;
        meta.microAppHost = true;
        meta.microAppCacheMode = "runtime-keep-alive";
    }
    return meta;
}

function GetComponent(item) {
    if (DiyCommon.IsNull(item.ComponentPath)) {
        return null;
    }
    if (item.ComponentPath.indexOf("micro-app/host") > -1) {
        return () => import("@/views/micro-app/host.vue");
    }
    // 如果是微服务，也要返回 Null
    if (item.IsMicroiService) {
        return null;
    }
    // 修复老数据
    if (item.ComponentPath.indexOf("/itdos/diy/") > -1) {
        item.ComponentPath = item.ComponentPath.replace("/itdos/diy/", "/diy/");
    }
    if (item.ComponentPath.length > 7 && item.ComponentPath.substring(0, 7) == "/views/") {
        item.ComponentPath = item.ComponentPath.replace("/views/", "/");
    }
    if (item.ComponentPath.indexOf("diy-table-rowlist") > -1) {
        return DiyTable;
    }
    if (item.ComponentPath.indexOf("microi/workflow/my-work") > -1) {
        return DiyMyWork;
    }
    if (item.ComponentPath.indexOf("microi/workflow/index") > -1) {
        return DiyFlowIndex;
    }
    if (item.ComponentPath.indexOf("diy/diy-table") > -1) {
        return DiyTable;
    }
    if (item.ComponentPath.indexOf("micro-app/host") > -1) {
        return () => import("@/views/micro-app/host.vue");
    }

    // 标准化组件路径
    const componentPath = normalizeComponentPath(item.ComponentPath);

    // Vite: 使用 import.meta.glob 实现动态导入
    // 注意：glob 的键是相对于项目根目录的路径
    const modules = import.meta.glob("/src/views/**/*.vue");

    // 构建可能的路径
    const possiblePaths = [
        `/src/views${componentPath}.vue`,
        `/src/views${componentPath}/index.vue`,
        // 尝试移除 .vue 后缀再添加
        `/src/views${componentPath.replace(".vue", "")}.vue`,
        `/src/views${componentPath.replace(".vue", "")}/index.vue`
    ];

    for (const path of possiblePaths) {
        if (modules[path]) {
            // Vue Router 4 直接返回动态导入函数，不需要 defineAsyncComponent
            return modules[path];
        }
    }

    // 调试：打印可用的模块路径以帮助诊断
    // console.log('Available modules:', Object.keys(modules).filter(k => k.includes(componentPath.split('/').pop())));

    // 只在非忽略路径时打印警告
    if (!shouldIgnoreWarning(item.ComponentPath) && !shouldIgnoreWarning(componentPath)) {
        console.warn(`Component not found: ${item.ComponentPath} (normalized: ${componentPath})`);
    }
    return null;
}

/**
 * 递归生成左侧菜单模块  --by itdos.com
 */
function GetMenuGridComponent() {
    return () => import("@/views/system/menu-children-grid.vue");
}

function buildMeta(item, extra = {}) {
    var menuBadgeOptions = {};
    if (item.MenuBadgeConfig && typeof item.MenuBadgeConfig === "object") {
        menuBadgeOptions = item.MenuBadgeConfig;
    } else if (typeof item.MenuBadgeConfig === "string" && item.MenuBadgeConfig.trim()) {
        try {
            menuBadgeOptions = JSON.parse(item.MenuBadgeConfig);
        } catch (error) {
            menuBadgeOptions = {};
        }
    }
    return appendMicroAppMeta({
        Id: item.Id,
        DiyTableId: item.DiyTableId,
        Display: item.Display,
        AppDisplay : item.AppDisplay,
        MenuBadgeConfig: Object.assign({}, menuBadgeOptions, {
            Enabled: item.MenuBadgeEnabled,
            ApiEngineKey: item.MenuBadgeApiEngineKey || menuBadgeOptions.ApiEngineKey
        }),
        UrlParam: item.UrlParam,
        title: item.Name,
        icon: item.IconClass ? item.IconClass : "",
        ...extra
    }, item);
}

function buildLeafRoute(item) {
    const component = GetComponent(item);
    const routePath = normalizeMenuRoutePath(item.Url, "/menu-" + DiyCommon.GuidRemoveSing(item.Id));
    const menu = {
        Id: item.Id,
        Display: item.Display,
        AppDisplay : item.AppDisplay,
        UrlParam: item.UrlParam,
        Link: item.Link,
        path: routePath,
        name: "menu_" + DiyCommon.GuidRemoveSing(item.Id),
        meta: buildMeta(item)
    };
    if (component != null) {
        menu.component = component;
    }
    if (isMicroAppMenu(item)) {
        const aliases = buildMicroAppRouteAliases({
            primaryPath: routePath,
            friendlyPath: item.MicroAppFriendlyUrl,
            serviceId: item.MicroServiceId,
            routePath: item.MicroServiceRoutePath
        });
        if (aliases.length) {
            menu.alias = aliases;
        }
    }
    return menu;
}

function buildHiddenMenuGridRoute(item) {
    return {
        Id: "grid_" + item.Id,
        Display: 0,
        AppDisplay: 0,
        hidden: true,
        path: normalizeMenuRoutePath(item.Url, "/menu-" + DiyCommon.GuidRemoveSing(item.Id)),
        component: GetMenuGridComponent(),
        name: "menu_grid_" + DiyCommon.GuidRemoveSing(item.Id),
        meta: buildMeta(item, {
            SourceMenuId: item.Id,
            title: item.Name
        })
    };
}

function MenuBuild(result, data, isFater) {
    data.forEach((item) => {
        try {
            repairOfficialMenuTitle(item);
            // 如果有子菜单，即使没有 Url 也要处理（作为父级文件夹）
            const hasChildren = item._Child && item._Child.length > 0;

            // 如果没有 Url 且没有子菜单，跳过
            if (DiyCommon.IsNull(item.Url) && !hasChildren) {
                return;
            }

            // 如果有 Url，处理 Url
            if (!DiyCommon.IsNull(item.Url)) {
                item.Url = String(item.Url || "").trim();

                // 跳过外部链接（http/https 开头的 URL 不应该添加为路由）
                if (!isIframeMenu(item) && isExternalRoutePath(item.Url)) {
                    // 外部链接不需要添加为路由，直接跳过
                    return;
                }
            } else {
                // 父级文件夹没有 Url，生成一个虚拟路径
                item.Url = "/folder-" + DiyCommon.GuidRemoveSing(item.Id);
            }

            if (item.ComponentPath) {
                item.ComponentPath = String(item.ComponentPath || "").trim();
                if (item.ComponentPath.indexOf("?") > -1) {
                    item.UrlParam = item.ComponentPath.split("?")[1];
                    item.ComponentPath = item.ComponentPath.replace(/\?.*/, "");
                }
            }
            if (isIframeMenu(item)) {
                item.ComponentPath = "/form-engine/diy-components/iframe";
                if (item.UrlApiEngineId) {
                    item.Url = "/iframe/" + item.UrlApiEngineId;
                } else {
                    item.Url = normalizeIframeRouteUrl(item.Url);
                }
            } else if (isMicroAppMenu(item)) {
                const parsedMicroAppUrl = parseMicroAppUrl(item.Url);
                item.MicroAppUrl = parsedMicroAppUrl.isEntryUrl || item.Url?.startsWith("http://") || item.Url?.startsWith("https://") ? item.Url : "";
                item.MicroAppUrlApiEngineId = item.UrlApiEngineId;
                item.MicroServiceRoutePath = normalizeMicroRoutePath(item.MicroServiceRoutePath || parsedMicroAppUrl.routePath || "/");
                item.ComponentPath = "/micro-app/host";
                item.MicroAppFriendlyUrl = buildMicroAppMenuPath(item);
                const microAppMenuPaths = resolveMicroAppMenuPaths({
                    menuUrl: item.Url,
                    legacyMenuUrl: item.LegacyMenuUrl,
                    friendlyPath: item.MicroAppFriendlyUrl
                });
                item.LegacyMenuUrl = microAppMenuPaths.legacyMenuUrl;
                item.Url = microAppMenuPaths.primaryPath;
            } else {
                if (item.Url.indexOf("?") > -1) {
                    item.UrlParam = item.Url.split("?")[1];
                    item.Url = item.Url.replace(/\?.*/, "");
                }
            }

            item.Url = normalizeMenuRoutePath(item.Url, "/folder-" + DiyCommon.GuidRemoveSing(item.Id));

            // 将 _Child 下为空的 Url 干掉
            if (item._Child && item._Child.length > 0) {
                item._Child = _.filter(item._Child, function (child) {
                    return !DiyCommon.IsNull(child.Url) || (child._Child && child._Child.length > 0);
                });
            }

            var component = null;
            var menu = {};
            var visibleChildren = getVisibleMenuChildren(item);

            // 定义 component
            if (isFater) {
                component = Layout;
                menu = {
                    Id: item.Id,
                    Display: item.Display,
                    AppDisplay : item.AppDisplay,
                    UrlParam: item.UrlParam,
                    Link: item.Link,
                    name: "parent_menu_" + DiyCommon.GuidRemoveSing(item.Id),
                    path: normalizeMenuRoutePath(item.Url, "/menu-" + DiyCommon.GuidRemoveSing(item.Id)),
                    component: component,
                    meta: buildMeta(item),
                    children: []
                };

                // 如果没有下级，或只有一个下级
                if (visibleChildren.length === 0) {
                    menu.children = [buildLeafRoute(item)];
                    result.push(menu);
                }
                // 如果有多个下级
                else if (visibleChildren.length === 1) {
                    menu.alwaysShow = true;
                    menu.children.push(buildHiddenMenuGridRoute(item));
                    MenuBuild(menu.children, item._Child, false);
                    result.push(menu);
                }
                else {
                    menu.alwaysShow = true;
                    menu.children.push(buildHiddenMenuGridRoute(item));
                    MenuBuild(menu.children, item._Child, false);
                    result.push(menu);
                }
            }
            // 如果不是第一级
            else {
                // 如果没有下级
                if (visibleChildren.length === 0) {
                    menu = buildLeafRoute(item);
                    result.push(menu);
                } else {
                    // Vite 动态导入 - Vue Router 4 直接使用动态导入函数
                    component = GetMenuGridComponent();
                    menu = {
                        Id: item.Id,
                        Display: item.Display,
                        AppDisplay : item.AppDisplay,
                        UrlParam: item.UrlParam,
                        Link: item.Link,
                        alwaysShow: true,
                        path: normalizeMenuRoutePath(item.Url, "/menu-" + DiyCommon.GuidRemoveSing(item.Id)),
                        component: component,
                        name: "parent_menu_" + DiyCommon.GuidRemoveSing(item.Id),
                        meta: buildMeta(item, { SourceMenuId: item.Id }),
                        children: []
                    };
                    MenuBuild(menu.children, item._Child, false);
                    result.push(menu);
                }
            }
        } catch (error) {
            console.log("MenuBuild Error：");
            console.log(error);
        }
    });
}

function isUsableMenuRoute(route) {
    if (!route) return false;
    const name = String(route.name || "");
    if (!name.startsWith("parent_menu_") && !name.startsWith("menu_")) return false;
    if (name.startsWith("menu_grid_")) return false;
    if (route.hidden || route.Display === 0 || route.Display === "0") return false;

    const routePath = normalizeMenuRoutePath(route.path);
    if (!routePath || routePath === "/" || isExternalRoutePath(routePath)) return false;
    if (routePath.indexOf(":") > -1 || routePath.indexOf("*") > -1) return false;
    return true;
}

function isGeneratedMicroiRoute(route) {
    if (!route) return false;
    const name = String(route.name || "");
    if (name.startsWith("parent_menu_") || name.startsWith("menu_") || name.startsWith("menu_grid_")) {
        return true;
    }
    const id = String(route.Id || route.meta?.Id || "");
    return id.startsWith("grid_");
}

function resolveRoutePath(parentPath, routePath) {
    const rawPath = String(routePath == null ? "" : routePath).trim();
    if (!rawPath) return normalizeMenuRoutePath(parentPath || "/");
    if (isExternalRoutePath(rawPath) || rawPath.startsWith("/")) {
        return normalizeMenuRoutePath(rawPath);
    }
    const basePath = normalizeMenuRoutePath(parentPath || "/").replace(/\/$/, "");
    return normalizeMenuRoutePath(basePath + "/" + rawPath);
}

export function hasAccessibleRoutePath(routes, targetPath, parentPath = "") {
    if (!Array.isArray(routes)) return false;
    const normalizedTarget = normalizeMenuRoutePath(targetPath || "/");
    for (const route of routes) {
        if (!route) continue;
        const currentPath = resolveRoutePath(parentPath, route.path);
        if (
            isGeneratedMicroiRoute(route)
            && !route.hidden
            && route.Display !== 0
            && route.Display !== "0"
            && currentPath === normalizedTarget
        ) {
            return true;
        }
        if (hasAccessibleRoutePath(route.children, normalizedTarget, currentPath)) {
            return true;
        }
    }
    return false;
}

export function getFirstValidRoutePath(routes) {
    if (!Array.isArray(routes)) return "";
    for (const route of routes) {
        if (isUsableMenuRoute(route)) {
            return normalizeMenuRoutePath(route.path);
        }
        const childRoutePath = getFirstValidRoutePath(route && route.children);
        if (childRoutePath) return childRoutePath;
    }
    return "";
}

/**
 * Filter asynchronous routing tables by recursion
 */
export function filterAsyncRoutes(routes, roles) {
    const res = [];

    routes.forEach((route) => {
        const tmp = { ...route };
        if (hasPermission(roles, tmp)) {
            if (tmp.children) {
                tmp.children = filterAsyncRoutes(tmp.children, roles);
            }
            res.push(tmp);
        }
    });

    return res;
}

export const usePermissionStore = defineStore("permission", {
    state: () => ({
        routes: [],
        addRoutes: []
    }),

    actions: {
        setRoutes(routes) {
            this.addRoutes = routes;
            this.routes = constantRoutes.concat(routes);
        },

        resetRoutes() {
            this.addRoutes = [];
            this.routes = constantRoutes;
        },

        generateRoutes(roles) {
            return new Promise((resolve, reject) => {
                // 从服务器端查询自定义功能模块
                var osClient = DiyOsClient.GetOsClient();
                var reg190317 = new RegExp("(^|&)" + "ChildSystemId" + "=([^&]*)(&|$)");
                var r190317 = window.location.search.substr(1).match(reg190317);
                var childSystemId = r190317 != null ? r190317[2] : null;

                DiyCommon.Post(
                    DiyApi.GetSysMenuStep(),
                    {
                        _SelectFields : [ "Id", "Name", "Icon", "IconClass", "Display", "AppDisplay", "MenuBadgeEnabled", "MenuBadgeApiEngineKey", "IsMicroiService", "OpenType", "ComponentName", "ComponentPath", "PageTemplate", "Url", "UrlApiEngineId", "DiyTableId", "ModuleEngineKey", "MicroServiceId", "MicroServiceKey", "MsKey", "MicroServicePageId", "MicroServiceRoutePath", "ParentId", "Sort"],
                        OsClient: osClient,
                        TableName: "Sys_Menu",
                        _OrderBy: "Sort",
                        _OrderByType: "ASC",
                        _ChildSystemId: childSystemId
                    },
                    (result) => {
                        if (DiyCommon.Result(result)) {
                            var menuArr = [];
                            MenuBuild(menuArr, result.Data, true);

                            var fixedComponents = [];
                            var mergedAsyncRoutes = (asyncRoutes || []).filter((route) => !isGeneratedMicroiRoute(route));
                            var insertIndex = Math.max(mergedAsyncRoutes.length - 1, 0);

                            menuArr.forEach((element) => {
                                mergedAsyncRoutes.splice(insertIndex, 0, element);
                                insertIndex += 1;
                            });

                            fixedComponents.forEach((element) => {
                                mergedAsyncRoutes.splice(insertIndex, 0, element);
                                insertIndex += 1;
                            });

                            // 以下为默认代码
                            let accessedRoutes;
                            if (roles.includes("admin")) {
                                accessedRoutes = mergedAsyncRoutes || [];
                            } else {
                                accessedRoutes = filterAsyncRoutes(mergedAsyncRoutes, roles);
                            }
                            this.setRoutes(accessedRoutes);
                            resolve(accessedRoutes);
                        } else {
                            // 请求失败时，拒绝 Promise，避免无限循环
                            console.error("获取菜单失败:", result);
                            var menuError = new Error(result.Msg || "获取菜单数据失败");
                            menuError.code = result.Code;
                            menuError.isAuthFailure = [1001, 1002].includes(Number(result.Code))
                                || String(result.Msg || "").toLowerCase() === "nologin";
                            reject(menuError);
                        }
                    },
                    (error) => {
                        // 请求异常时，拒绝 Promise
                        console.error("获取菜单异常:", error);
                        reject(error);
                    }
                );
            });
        }
    }
});
