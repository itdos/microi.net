export function isDynamicMenuRoute(route) {
    const name = String(route?.name || "");
    return name.startsWith("parent_menu_")
        || name.startsWith("menu_")
        || name.startsWith("menu_grid_");
}

export function resolveMenuFolderRoutePath(menu, folderPath) {
    const normalize = value => {
        const path = String(value || "").trim().split(/[?#]/)[0];
        return path ? ("/" + path.replace(/^\/+|\/+$/g, "")) : "";
    };
    const target = normalize(folderPath);
    if (!target || !menu?.Id) return folderPath;

    // 旧菜单常用首个子模块的 Url 作为父目录入口。导航目录必须让出该地址，
    // 保留子模块的书签、模块 Id 和权限，且只调整当前浏览器生成的路由，不改租户数据。
    const children = [...(Array.isArray(menu._Child) ? menu._Child : [])];
    while (children.length) {
        const child = children.shift();
        if (normalize(child?.Url) === target) {
            return "/folder-" + String(menu.Id).replaceAll("-", "");
        }
        if (Array.isArray(child?._Child)) children.push(...child._Child);
    }
    return folderPath;
}

export async function refreshDynamicMenuRoutes({ permissionStore, router, roles = ["admin"], reason = "manual" } = {}) {
    if (!permissionStore || typeof permissionStore.generateRoutes !== "function" || !router) {
        throw new Error("动态菜单刷新缺少权限仓库或路由器");
    }

    const routes = await permissionStore.generateRoutes(Array.isArray(roles) && roles.length ? roles : ["admin"]);
    if (!Array.isArray(routes)) throw new Error("动态菜单刷新没有返回有效路由");

    router.getRoutes().forEach((route) => {
        if (!route?.name || !isDynamicMenuRoute(route) || !router.hasRoute(route.name)) return;
        try { router.removeRoute(route.name); } catch (_) {}
    });
    routes.forEach((route) => {
        if (!route?.name || !isDynamicMenuRoute(route)) return;
        try {
            router.addRoute(route);
        } catch (error) {
            console.warn("[DynamicMenuRoutes] add route failed:", route?.path, error);
        }
    });

    const current = router.currentRoute?.value;
    if (current?.fullPath) await router.replace(current.fullPath).catch(() => {});
    try {
        window.dispatchEvent(new CustomEvent("microi:menu-routes-reloaded", {
            detail: { reason, routeCount: routes.length }
        }));
    } catch (_) {}
    return routes;
}
