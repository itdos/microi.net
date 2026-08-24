function normalizePermissionList(permission) {
    if (Array.isArray(permission)) return permission;
    if (typeof permission !== "string" || !permission.trim()) return [];

    try {
        const parsed = JSON.parse(permission);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        // 权限快照解析失败时按无权限处理，不能让用户状态刷新阻断主题等无关偏好保存。
        return [];
    }
}

/**
 * 统一当前用户角色权限形态。登录接口返回 JSON 字符串，而登录后的乐观更新、
 * RefreshLoginUser 等链路可能再次传入已解析数组，因此该转换必须可重复执行。
 */
export function normalizeCurrentUserRoleLimits(currentUser) {
    const user = currentUser && typeof currentUser === "object" ? currentUser : {};
    const roleLimits = Array.isArray(user._RoleLimits) ? user._RoleLimits : [];

    roleLimits.forEach(roleLimit => {
        if (!roleLimit || typeof roleLimit !== "object") return;
        roleLimit.Permission = normalizePermissionList(roleLimit.Permission);
    });
    user._RoleLimits = roleLimits;
    return user;
}
