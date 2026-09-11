function readTenant(values) {
    if (!values) return '';
    if (typeof values === 'string') {
        try { values = JSON.parse(values); }
        catch (_) { values = new URLSearchParams(values); }
    }
    const entries = typeof values.entries === 'function'
        ? Array.from(values.entries()) : Object.entries(values);
    for (const name of ['osclient', '_osclient']) {
        const entry = entries.find(([key, value]) => String(key).toLowerCase() === name
            && typeof value === 'string' && value.trim());
        if (entry) return entry[1].trim();
    }
    return '';
}

/**
 * 页面租户必须进入真实 HTTP 请求，不能让同源缓存中的旧 Token 决定路由租户。
 * 只补当前 API 下的请求；显式跨租户调用保留其上下文，不给外部服务添加页面租户。
 * 请求头也覆盖 JSON 正文尚未读取的路由阶段，避免先按旧 Token 查询错误数据库。
 */
export function withRequestTenant(headers, { url, apiBase, osClient, params, query }) {
    const result = { ...headers };
    if (Object.keys(result).some(key => key.toLowerCase() === 'osclient')) return result;
    try {
        const base = new URL(apiBase);
        const target = new URL(url, base.origin + '/');
        const prefix = base.pathname.replace(/\/+$/, '');
        if (target.origin !== base.origin
            || (prefix && target.pathname !== prefix && !target.pathname.startsWith(prefix + '/'))) return result;
        const suffix = /--OsClient--(.*?)--$/i.exec(target.pathname);
        const tenant = (suffix ? decodeURIComponent(suffix[1]) : '')
            || readTenant(target.searchParams) || readTenant(query) || readTenant(params) || osClient;
        if (tenant) result.osclient = tenant;
    } catch (_) {
        // 无效地址仍交给原请求链处理，不猜测其它服务或租户。
    }
    return result;
}
