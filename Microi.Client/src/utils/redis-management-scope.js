// 只投影后端返回的能力；前端不根据账号名或管理员等级推断主租户权限。
export function redisDatabaseOptions(connection, count = 64) {
    if (!connection) return [];
    const configured = Number(connection.Database ?? 0);
    if (connection.CanSelectDatabase !== true) return [configured];
    return Array.from(new Set([configured, ...Array.from({ length: count }, (_, index) => index)])).sort((a, b) => a - b);
}

export function redisKeyPrefix(connection) {
    return typeof connection?.AllowedKeyPrefix === 'string' ? connection.AllowedKeyPrefix : '';
}
