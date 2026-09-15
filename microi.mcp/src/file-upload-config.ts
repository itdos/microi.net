const permissionFlags = ['EnableRolePermission', 'HideUnauthorizedFiles', 'ShowUnauthorizedFileName', 'DisableRoleInheritance'] as const;

/** 构造上传配置时保留其它选项，拒绝字符串布尔值；启用角色权限必须使用私有存储。 */
export function buildFileUploadConfig(options: Record<string, unknown>): Record<string, unknown> {
  const result = { ...options };
  for (const flag of permissionFlags) {
    if (result[flag] !== undefined && typeof result[flag] !== 'boolean') throw new Error(`FileUpload.${flag} 必须是 boolean`);
    result[flag] ??= false;
  }
  const ids = result.ConfigurableRoleIds;
  if (ids !== undefined && (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !id.trim() || id.length > 100)))
    throw new Error('FileUpload.ConfigurableRoleIds 必须是最多 100 个真实角色 Id 的字符串数组');
  result.ConfigurableRoleIds = Array.isArray(ids) ? [...new Set(ids)] : [];
  if (result.EnableRolePermission === true) result.Limit = true;
  return { FileUpload: result };
}
