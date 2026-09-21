// zhy：兼容模块配置中的数组对象和 JSON 字符串，非法配置按空数组处理。
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

// zhy：仅当 TableChild 确实配置了 SQL、关联表或跨表查询字段时才使用模块引擎查询。
export function tableChildRequiresModuleQuery(menuModel, primaryTableId) {
    const menu = menuModel || {};
    if (typeof menu.SqlJoin === "string" && menu.SqlJoin.trim()) return true;
    if (parseArrayConfig(menu.JoinTables).length > 0) return true;

    return parseArrayConfig(menu.SelectFields).some(field => {
        return field && field.TableId && primaryTableId && field.TableId !== primaryTableId;
    });
}

// zhy：统一选择模块引擎或物理表查询入口，调用方附带的授权与过滤参数保持不变。
export function resolveTableQueryTarget(param, options = {}) {
    const request = param || {};
    const moduleEngineKey = request.ModuleEngineKey || options.moduleEngineKey || options.sysMenuId;
    const keepModuleEngine = !options.isTableChild || options.tableChildRequiresModuleQuery === true;

    if (moduleEngineKey && keepModuleEngine) {
        // zhy：TableChild 必须保留模块入口，关联表 SqlJoin/SelectFields 才会参与查询。
        // zhy：授权范围由调用方继续附带的 _TableChildAuth 与父子外键条件共同约束。
        request.ModuleEngineKey = moduleEngineKey;
        delete request.FormEngineKey;
        return request;
    }

    // zhy：没有关联查询的普通 TableChild 延续物理表查询，避免重新套用子菜单数据范围。
    // zhy：非 TableChild 不会进入此兼容分支，仍按原模块查询逻辑执行。
    delete request.ModuleEngineKey;
    request.FormEngineKey = request.FormEngineKey || options.formEngineKey || options.tableId;
    return request;
}
