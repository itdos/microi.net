import path from './path.js';

export function visibleNavigationRoutes(routes) {
    return (Array.isArray(routes) ? routes : []).filter(route => route && route.Display !== 0 && route.Display !== '0' && !route.hidden && route.meta);
}

export function navigationTarget(route, basePath = '') {
    const raw = String(route?.path || basePath || '/');
    const target = /^(https?:|mailto:|tel:)/i.test(raw) ? raw : path.resolve(basePath, raw);
    const query = String(route?.UrlParam || '');
    return target + (query ? (target.includes('?') ? '&' : '?') + query : '');
}

function projectChildren(root) {
    const basePath = navigationTarget(root).split('?')[0];
    // 只投影当前已授权路由，不生成第二份权限树；二级路径统一为绝对地址供原侧栏复用。
    return visibleNavigationRoutes(root?.children).map(child => ({ ...child, path: /^(https?:|mailto:|tel:)/i.test(child.path || '') ? child.path : path.resolve(basePath, child.path || '') }));
}

export function firstNavigationLeaf(route, basePath = '') {
    const target = navigationTarget(route, basePath);
    const child = visibleNavigationRoutes(route?.children)[0];
    return child ? firstNavigationLeaf(child, target.split('?')[0]) : target;
}

function containsPath(route, currentPath, basePath = '') {
    const target = navigationTarget(route, basePath).split(/[?#]/)[0];
    return target === currentPath || visibleNavigationRoutes(route?.children).some(child => containsPath(child, currentPath, target));
}

export function resolveHybridNavigation(routes, currentPath = '', selectedRoot = '') {
    const roots = visibleNavigationRoutes(routes);
    const root = roots.find(item => navigationTarget(item) === selectedRoot)
        || roots.find(item => containsPath(item, String(currentPath).split(/[?#]/)[0]))
        || roots[0];
    return { roots, root, activeRoot: root ? navigationTarget(root) : '', sidebarRoutes: root ? projectChildren(root) : [] };
}
