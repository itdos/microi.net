const permissionFlags = ['EnableRolePermission', 'HideUnauthorizedFiles', 'ShowUnauthorizedFileName', 'DisableRoleInheritance'] as const;

/** 构造上传配置时保留其它选项，拒绝字符串布尔值；启用角色权限必须使用私有存储。 */
export function buildFileUploadConfig(options: Record<string, unknown>): Record<string, unknown> {
  const result = { ...options };
  for (const flag of permissionFlags) {
    if (result[flag] !== undefined && typeof result[flag] !== 'boolean') throw new Error(`FileUpload.${flag} 必须是 boolean`);
    result[flag] ??= false;
  }
  if (result.EnableRolePermission === true) result.Limit = true;
  return { FileUpload: result };
}
