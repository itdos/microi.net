/**
 * Re-resolve the current URL after tenant menu routes are registered.
 *
 * The first navigation can legitimately match the static catch-all route before
 * the authenticated menu tree is available.  Reusing the whole `to` object also
 * reuses its `name: page_404`, and Vue Router gives a named location precedence
 * over `path`.  Keep only URL state so the newly registered exact route wins.
 */
export function createDynamicRouteRematch(to) {
    const path = typeof to?.path === "string" && to.path ? to.path : "/";
    const query = to?.query && typeof to.query === "object" ? { ...to.query } : {};
    const hash = typeof to?.hash === "string" ? to.hash : "";
    return { path, query, hash, replace: true };
}

/**
 * The route skeleton is a cold-start fallback only.  Once the platform shell is
 * mounted, menu switches keep the current content visible while the destination
 * page uses its own local skeleton.  This also covers a transient unmatched
 * `from` record during dynamic-route refreshes.
 */
export function shouldStartInitialRouteLoading(from, shellMounted = false) {
    if (shellMounted) return false;
    return !(Array.isArray(from?.matched) && from.matched.length > 0);
}

/**
 * 仅用于登录身份和菜单的只读初始化。短暂读取失败不能直接取消首个导航；
 * 认证/权限拒绝立即交给守卫处理，菜单自身耗尽的启动重试也不再叠加。
 * 每次重试前重新检查会话，避免退出登录后继续请求受保护资源。
 */
export async function readRouteBootstrap(read, canRetry) {
    const delays = [300, 1000];
    for (let attempt = 0; ; attempt++) {
        try {
            return await read();
        } catch (error) {
            const status = Number(error?.response?.status);
            if (attempt >= delays.length || !canRetry(error)
                || status === 401 || status === 403
                || error?.reasonCode === 'PLATFORM_SYS_MENU_NOT_READY') {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delays[attempt]));
            if (!canRetry(error)) throw error;
        }
    }
}

export function createRouteBootstrapError(cause, stage) {
    const label = stage === 'identity' ? '登录身份初始化失败' : '菜单初始化失败';
    const detail = cause?.message || cause?.Msg || String(cause || '请刷新后重试。');
    const error = new Error(`${label}：${detail}`, { cause });
    error.bootstrapStage = stage;
    error.code = cause?.code ?? cause?.Code;
    return error;
}
