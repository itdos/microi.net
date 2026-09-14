// 前端只消费后端授权投影；角色继承与写入校验由后端使用当前租户主库判定。
export function fileRoleConfig(config = {}) {
    return Object.fromEntries(['EnableRolePermission', 'HideUnauthorizedFiles', 'ShowUnauthorizedFileName', 'DisableRoleInheritance'].map(key => [key, config[key] === true]));
}
export const canReadFile = file => file?._FileAccess?.CanRead !== false;
export const canEditFile = (file, mode) => ['Add', 'Edit'].includes(mode) && canReadFile(file) && file?._FileAccess?.CanEdit !== false;
export const visibleFiles = (files, config = {}) => (Array.isArray(files) ? files : []).filter(file => file && (!config.HideUnauthorizedFiles || canReadFile(file)));
export function fileRoleNames(file, roles = []) {
    if (Array.isArray(file?.VisibleRoleNames)) return file.VisibleRoleNames;
    return (file?.VisibleRoleIds || []).map(id => roles.find(role => role.Id === id)?.Name || '已配置角色');
}
