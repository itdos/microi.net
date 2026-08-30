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

const CURRENT_USER_AUTHORIZATION_FIELDS = [
    "_IsAdmin",
    "_RoleLimits",
    "_Roles",
    "RoleIds",
    "Level",
    "DeptId",
    "DeptIds"
];

const isRecord = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

/**
 * Personal-preference endpoints are allowed to return a partial sys_user projection.
 * When that projection belongs to the same user, keep authorization fields that were
 * not part of the response. Explicit false/empty values are still honored so a real
 * permission refresh can revoke access immediately.
 */
export function mergeCurrentUserSnapshot(previousUser, incomingUser) {
    const previous = isRecord(previousUser) ? previousUser : {};
    const incoming = isRecord(incomingUser) ? { ...incomingUser } : {};
    const previousId = String(previous.Id || "").trim();
    const incomingId = String(incoming.Id || "").trim();
    if (!previousId || !incomingId || previousId !== incomingId) return incoming;

    CURRENT_USER_AUTHORIZATION_FIELDS.forEach(field => {
        if (!hasOwn(incoming, field) && hasOwn(previous, field)) incoming[field] = previous[field];
    });
    return incoming;
}

/**
 * Pinia 持久化恢复前，getter 可以读到本地完整用户，但 state.CurrentUser 仍可能只是
 * 空壳。此时偏好接口若先返回精简投影，必须先以同一用户的缓存快照为基线；否则
 * setCurrentUser 会把管理员/按钮权限永久覆盖掉，直至下一次重新登录。
 */
export function mergeCurrentUserWithCachedSnapshot(stateUser, cachedUser, incomingUser) {
    const state = isRecord(stateUser) ? stateUser : {};
    const cached = isRecord(cachedUser) ? cachedUser : {};
    const incoming = isRecord(incomingUser) ? incomingUser : {};
    const stateId = String(state.Id || "").trim();
    const cachedId = String(cached.Id || "").trim();
    const incomingId = String(incoming.Id || "").trim();

    let baseline = state;
    if (incomingId && cachedId === incomingId && (!stateId || stateId === incomingId)) {
        baseline = stateId ? mergeCurrentUserSnapshot(cached, state) : cached;
    }
    return mergeCurrentUserSnapshot(baseline, incoming);
}

export function hasCurrentUserAuthorizationSnapshot(currentUser) {
    return Boolean(currentUser?.Id)
        && hasOwn(currentUser, "_IsAdmin")
        && Array.isArray(currentUser?._RoleLimits);
}

/**
 * 统一当前用户角色权限形态。登录接口返回 JSON 字符串，而登录后的乐观更新、
 * RefreshLoginUser 等链路可能再次传入已解析数组，因此该转换必须可重复执行。
 */
export function normalizeCurrentUserRoleLimits(currentUser) {
    const user = isRecord(currentUser) ? { ...currentUser } : {};
    const roleLimits = Array.isArray(user._RoleLimits)
        ? user._RoleLimits.map(roleLimit => {
            if (!isRecord(roleLimit)) return roleLimit;
            return {
                ...roleLimit,
                Permission: normalizePermissionList(roleLimit.Permission)
            };
        })
        : [];
    user._RoleLimits = roleLimits;
    return user;
}
