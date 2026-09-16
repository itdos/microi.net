// 前端只消费后端授权投影；角色继承与写入校验由后端使用当前租户主库判定。
export function fileRoleConfig(config = {}) {
    return {
        ...Object.fromEntries(['EnableRolePermission', 'HideUnauthorizedFiles', 'ShowUnauthorizedFileName', 'DisableRoleInheritance'].map(key => [key, config[key] === true])),
        ConfigurableRoleIds: Array.isArray(config.ConfigurableRoleIds) ? [...new Set(config.ConfigurableRoleIds.filter(id => typeof id === 'string' && id.trim()))] : []
    };
}
export function configurableFileRoles(roles, config = {}, file = {}) {
    const allowed = fileRoleConfig(config).ConfigurableRoleIds.map(id => id.toLowerCase());
    const options = (roles || []).filter(role => !allowed.length || allowed.includes(String(role.Id).toLowerCase())).map(role => ({ ...role }));
    // 缩小配置范围后保留旧选择供用户看见；范围外只可移除，不能重新添加。
    for (const [index, id] of (file.VisibleRoleIds || []).entries()) {
        if (!options.some(role => String(role.Id).toLowerCase() === String(id).toLowerCase()))
            options.push({ Id: id, Name: `${file.VisibleRoleNames?.[index] || '已配置角色'}（不在可配置范围）`, Disabled: true });
    }
    return options;
}
export const canReadFile = file => file?._FileAccess?.CanRead !== false;
export const canEditFile = (file, mode) => ['Add', 'Edit'].includes(mode) && canReadFile(file) && file?._FileAccess?.CanEdit !== false;
export const visibleFiles = (files, config = {}) => (Array.isArray(files) ? files : []).filter(file => file && (!config.HideUnauthorizedFiles || canReadFile(file)));
export function fileRoleNames(file, roles = []) {
    if (Array.isArray(file?.VisibleRoleNames)) return file.VisibleRoleNames;
    return (file?.VisibleRoleIds || []).map(id => roles.find(role => role.Id === id)?.Name || '已配置角色');
}
