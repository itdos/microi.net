// 页面模板可能来自其它租户。只把当前账号路由中存在的真实模块 Id 交给表单引擎，
// 并以同表模块适配导入后的 Id 重映射；隐藏模块仍可有读取权限，不以侧栏显隐代替鉴权。
export function resolveWidgetMenuId(routes, configuredId, tableName) {
    const normalize = value => String(value || '').trim().toLowerCase();
    const menus = [];
    const visit = list => {
        for (const route of list || []) {
            const meta = route?.meta || {};
            const id = meta.Id || route?.Id;
            if (id && !String(route?.name || '').startsWith('menu_grid_')) {
                menus.push({ id: String(id), table: normalize(meta.DiyTableName) });
            }
            if (Array.isArray(route?.children)) visit(route.children);
        }
    };
    visit(routes);
    const configured = normalize(configuredId);
    const exact = configured && menus.find(menu => normalize(menu.id) === configured);
    if (exact) return exact.id;
    const table = normalize(tableName);
    return (table && menus.find(menu => menu.table === table)?.id) || '';
}
