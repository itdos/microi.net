function fieldNames(value) {
    const items = Array.isArray(value) ? value : (typeof value === "string" ? value.split(",") : []);
    return items.map((field) => typeof field === "string" ? field.trim() : (field?.Name || field?.AsName || ""))
        .filter(Boolean);
}

/**
 * 卡片与复合列会引用普通列表未展示的字段。只扩大已有显式投影，不能把原本查询
 * 全部列的旧菜单缩窄成展示字段；真实字段权限仍由后端检查，前端配置不授予访问权。
 */
export function appendPresentationSelectFields(params, menu, requiredFieldNames) {
    const required = fieldNames(requiredFieldNames);
    if (!required.length) return params;
    const selected = [...fieldNames(params?._SelectFields), ...fieldNames(menu?.SelectFields)];
    if (!selected.length || selected.includes("*")) return params;
    params._SelectFields = [...new Set(["Id", "CreateTime", "UpdateTime", ...selected, ...required])];
    return params;
}
