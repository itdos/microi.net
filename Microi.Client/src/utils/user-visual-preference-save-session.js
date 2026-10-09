// 顶栏重建后仍保留当前账号的运行时队列，并按服务器、租户和登录会话隔离。
// 授权标识仅在私有内存中比较，不暴露到响应式状态、日志或设备偏好存储。
const stores = new WeakMap();

export function getUserVisualPreferenceSaveSession(store, osClient, userId, reactive = value => value, authorization = '', apiBase = '') {
    let sessions = stores.get(store);
    if (!sessions) { sessions = new Map(); stores.set(store, sessions); }
    const scope = JSON.stringify([String(apiBase || ''), String(osClient || ''), String(userId || '')]);
    const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!sessions.has(scope) || sessions.get(scope).authorization !== token) sessions.set(scope, { authorization: token, state: reactive({
        apiBase: String(apiBase || ''), osClient: String(osClient || ''), userId: String(userId || ''),
        pendingPreferencePatch: {}, preferenceSaveTimer: null,
        preferenceSaveInFlight: false, preferenceSaveState: 'saved', preferenceSaveError: ''
    }) });
    return sessions.get(scope).state;
}
