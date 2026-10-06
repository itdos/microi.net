/** 字段展示使用当前用户的安全投影；服务端按主库身份独立重算并强制约束读写。 */
export function permissionIds(value) {
    if (!value) return [];
    let data = value;
    if (typeof value === 'string') { try { data = JSON.parse(value); } catch { data = value.split(/[,;]/); } }
    return (Array.isArray(data) ? data : [data]).map(x => String(x?.Id ?? x?.id ?? x?.Value ?? x ?? '').trim().toLowerCase()).filter(Boolean);
}
export function resolvedModuleFieldAccess(access, name) {
    if (!access) return null;
    if (access.Version !== 1 || !access.Fields || typeof access.Fields !== 'object') return { visible: false, editable: false };
    const key = Object.keys(access.Fields).find(key => key.toLowerCase() === String(name || '').toLowerCase());
    const field = key ? access.Fields[key] : {};
    const visible = String(name).toLowerCase() === 'id' || (field.Visible ?? access.DefaultVisible ?? true) === true;
    return { visible, editable: visible && (field.Editable ?? access.DefaultEditable ?? true) === true };
}
export function moduleFieldAccess(raw, user, name) {
    if (Number(user?.Level || 0) >= 9999 || !raw) return { visible: true, editable: true };
    let config;
    try { config = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return { visible: false, editable: false }; }
    if (!config?.Enabled) return { visible: true, editable: true };
    if (config.Version !== 1 || !Array.isArray(config.Rules)) return { visible: false, editable: false };
    let visible = config.DefaultVisible !== false, editable = config.DefaultEditable !== false;
    const identities = { Users: permissionIds(user?.Id), Roles: permissionIds(user?.RoleIds), Departments: [...permissionIds(user?.DeptId), ...permissionIds(user?.DeptIds)], Jobs: [...permissionIds(user?.Jobs), ...permissionIds(user?.RoleIds)] };
    let found = false;
    for (const rule of config.Rules) {
        const matches = rule.Everyone || Object.entries(identities).some(([key, ids]) => permissionIds(rule[key]).some(id => ids.includes(id)));
        if (!matches) continue;
        for (const field of rule.Fields || []) {
            if (String(field.Name || '').toLowerCase() !== String(name || '').toLowerCase()) continue;
            const nextVisible = field.Visible ?? config.DefaultVisible ?? true, nextEditable = field.Editable ?? config.DefaultEditable ?? true;
            if (!found) { visible = nextVisible; editable = nextEditable; found = true; }
            else { visible = visible && nextVisible; editable = editable && nextEditable; }
        }
    }
    if (String(name).toLowerCase() === 'id') visible = true;
    return { visible: !!visible, editable: !!visible && !!editable };
}
