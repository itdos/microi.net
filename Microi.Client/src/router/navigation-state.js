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
