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

// zhy：父表处于 Add/Insert 时只有预生成 Id，数据库中尚无可供关联菜单 JOIN 的父记录。
export function tableChildParentIsPending(formMode) {
    const normalizedMode = typeof formMode === "string" ? formMode.trim().toLowerCase() : "";
    return normalizedMode === "add" || normalizedMode === "insert";
}

// zhy：统一选择模块引擎或物理表查询入口，调用方附带的授权与过滤参数保持不变。
export function resolveTableQueryTarget(param, options = {}) {
    const request = param || {};
    const moduleEngineKey = request.ModuleEngineKey || options.moduleEngineKey || options.sysMenuId;
    // zhy：新增父表阶段强制走物理子表；保存后继续按关联配置使用模块查询。
    const parentIsPending = options.isTableChild
        && tableChildParentIsPending(options.tableChildFormMode);
    const keepModuleEngine = !options.isTableChild
        || (options.tableChildRequiresModuleQuery === true && !parentIsPending);

    if (moduleEngineKey && keepModuleEngine) {
        // zhy：TableChild 必须保留模块入口，关联表 SqlJoin/SelectFields 才会参与查询。
        // zhy：授权范围由调用方继续附带的 _TableChildAuth 与父子外键条件共同约束。
        request.ModuleEngineKey = moduleEngineKey;
        delete request.FormEngineKey;
        return request;
    }

    // zhy：普通 TableChild 继续查询物理表；父表尚未保存时也必须走该路径，因为子表数据
    // 已按预生成父 Id 写入，而父表关联行还不存在，模块中的 INNER JOIN 会把它过滤掉。
    // _TableChildAuth 和父子外键条件由调用方保留，父表保存后恢复模块查询以显示关联字段。
    delete request.ModuleEngineKey;
    request.FormEngineKey = request.FormEngineKey || options.formEngineKey || options.tableId;
    return request;
}
