export function isDynamicMenuRoute(route) {
    const name = String(route?.name || "");
    return name.startsWith("parent_menu_")
        || name.startsWith("menu_")
        || name.startsWith("menu_grid_");
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
