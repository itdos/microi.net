import { getUserVisualPreferenceSaveSession } from './user-visual-preference-save-session.js';

export const PANEL_WIDTH_MIN = 160;
export const PANEL_WIDTH_MAX = 600;
export function normalizePanelWidth(value, fallback = 240) {
    const number = Number(String(value ?? '').replace(/px$/i, ''));
    return value == null || String(value).trim() === '' || !Number.isFinite(number)
        ? fallback : Math.max(PANEL_WIDTH_MIN, Math.min(PANEL_WIDTH_MAX, Math.round(number)));
}
export function clampPanelWidth(value, availableWidth, mainMinWidth = 480) {
    // 只裁剪本次视口的呈现，不把小屏裁剪结果覆盖长期账号偏好。
    const maximum = Math.max(0, Math.min(PANEL_WIDTH_MAX, Number(availableWidth) - mainMinWidth));
    return Math.min(normalizePanelWidth(value), maximum);
}
export function resolvePanelCollapsed(value, fallback = false) {
    if (value === 1 || value === true || value === '1') return true;
    if (value === 0 || value === false || value === '0') return false;
    return fallback;
}
export function createPanelPreferenceClient({ store, reactive, getToken, decodeToken, getApiBase, getOsClient, run, notify, saveFailedMessage = '布局偏好保存失败' }) {
    function activeSession() {
        const user = store.GetCurrentUser || {}, token = getToken(), tenant = getOsClient(), claims = decodeToken(token);
        const sameActor = String(claims?.UserId || '') === String(user.Id || '') && String(claims?.OsClient || '').toLowerCase() === String(tenant || '').toLowerCase();
        const authorization = sameActor && claims?.MicroiSessionId ? `session:${claims.MicroiSessionId}` : token;
        return getUserVisualPreferenceSaveSession(store, tenant, user.Id, reactive, authorization, getApiBase());
    }
    async function flush(session = activeSession()) {
        if (session.preferenceSaveInFlight || !Object.keys(session.pendingPreferencePatch).length) return;
        if (session !== activeSession()) { session.pendingPreferencePatch = {}; return; }
        const patch = { ...session.pendingPreferencePatch };
        session.pendingPreferencePatch = {};
        session.preferenceSaveInFlight = true;
        session.preferenceSaveState = 'saving';
        let succeeded = false;
        try {
            const result = await run('platform-user-update-preferences', patch);
            if (Number(result?.Code) !== 1) throw new Error(result?.Msg || saveFailedMessage);
            if (session === activeSession() && String(result.Data?.Id || '') === session.userId) {
                store.setCurrentUser({ ...store.GetCurrentUser, ...result.Data, ...session.pendingPreferencePatch });
            }
            succeeded = true;
            session.preferenceSaveState = Object.keys(session.pendingPreferencePatch).length ? 'pending' : 'saved';
            session.preferenceSaveError = '';
        } catch (error) {
            session.pendingPreferencePatch = { ...patch, ...session.pendingPreferencePatch };
            session.preferenceSaveState = 'error';
            session.preferenceSaveError = error?.message || String(error);
            if (session === activeSession()) notify?.(session.preferenceSaveError);
        } finally {
            session.preferenceSaveInFlight = false;
            if (succeeded && Object.keys(session.pendingPreferencePatch).length) schedule(session);
        }
    }
    function schedule(session) {
        clearTimeout(session.preferenceSaveTimer);
        session.preferenceSaveTimer = setTimeout(() => { session.preferenceSaveTimer = null; void flush(session); }, 250);
    }
    function save(patch) {
        const user = store.GetCurrentUser || {};
        // 旧租户没有物理字段时不伪造已同步状态，也不向通用更新接口传任意字段。
        const installed = Object.fromEntries(Object.entries(patch).filter(([key]) => ['SidebarWidth', 'RoleTreeWidth', 'SidebarCollapsed', 'RoleTreeCollapsed'].includes(key) && Object.hasOwn(user, key)));
        if (!user.Id || !Object.keys(installed).length) return false;
        const session = activeSession();
        store.setCurrentUser({ ...user, ...installed });
        Object.assign(session.pendingPreferencePatch, installed);
        session.preferenceSaveState = 'pending';
        schedule(session);
        return true;
    }
    return { save, flush, activeSession };
}
