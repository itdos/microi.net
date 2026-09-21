function parseArrayConfig(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

export function tableChildRequiresModuleQuery(menuModel, primaryTableId) {
    const menu = menuModel || {};
    if (typeof menu.SqlJoin === "string" && menu.SqlJoin.trim()) return true;
    if (parseArrayConfig(menu.JoinTables).length > 0) return true;

    return parseArrayConfig(menu.SelectFields).some(field => {
        return field && field.TableId && primaryTableId && field.TableId !== primaryTableId;
    });
}

export function resolveTableQueryTarget(param, options = {}) {
    const request = param || {};
    const moduleEngineKey = request.ModuleEngineKey || options.moduleEngineKey || options.sysMenuId;
    const keepModuleEngine = !options.isTableChild || options.tableChildRequiresModuleQuery === true;

    if (moduleEngineKey && keepModuleEngine) {
        // TableChild 也必须保留模块入口，关联表 SqlJoin/SelectFields 才会参与查询；
        // 授权范围由调用方继续附带的 _TableChildAuth 与父子外键条件共同约束。
        request.ModuleEngineKey = moduleEngineKey;
        delete request.FormEngineKey;
        return request;
    }

    // 没有关联查询的普通 TableChild 延续物理表查询，避免重新套用子菜单数据范围；
    // 非 TableChild 不会进入此兼容分支，仍按原模块查询逻辑执行。
    delete request.ModuleEngineKey;
    request.FormEngineKey = request.FormEngineKey || options.formEngineKey || options.tableId;
    return request;
}
