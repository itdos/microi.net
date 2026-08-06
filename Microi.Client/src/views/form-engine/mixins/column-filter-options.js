function isNonEmpty(value) {
    return value !== undefined && value !== null && value !== "";
}

export function isIdBackedTreeFilterField(field) {
    if (!field || field.Component !== "Department") return false;
    const departmentConfig = field.Config && field.Config.Department;
    return departmentConfig && departmentConfig.EmitPath === false && Array.isArray(field.Data) && field.Data.length > 0;
}

export function buildIdBackedTreeFilterOptions(field) {
    if (!isIdBackedTreeFilterField(field)) return [];

    const result = [];
    const seen = new Set();
    const visit = (nodes) => {
        (Array.isArray(nodes) ? nodes : []).forEach((node) => {
            if (!node || typeof node !== "object") return;
            const value = isNonEmpty(node.Id) ? node.Id : node.id;
            const label = isNonEmpty(node.Name) ? node.Name : (node.name || value);
            if (isNonEmpty(value)) {
                const key = String(value);
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push({ label: String(label || value), value });
                }
            }
            visit(node._Child || node.children || node.Children);
        });
    };

    visit(field.Data);
    return result;
}
