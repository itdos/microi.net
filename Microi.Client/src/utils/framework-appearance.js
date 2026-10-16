import { hasInstalledUserPreference, resolveUserThemeColor, resolveUserThemeMode, resolveUserCornerStyle } from './user-visual-preferences.js';
import { applyUiDensity, normalizeUiDensityScale, UI_DENSITY_STORAGE_KEY } from './ui-density.js';
import { setThemeColor, setThemeMode } from './theme-color.js';
import { setCornerStyle } from './theme-shape.js';

export const APPEARANCE_SWITCHES = Object.freeze(['DisableGradient', 'DisableShadow', 'DisableButtonIcon']);
export const FRAMEWORK_FUNCTIONS = Object.freeze(['Chat', 'BackgroundTasks', 'Search', 'Language', 'Theme', 'AI', 'Bluetooth', 'SystemStyle', 'FullScreen']);
export const APPEARANCE_RESET = Object.freeze({ ThemeMode: '', ThemeColor: '', CornerStyle: 'System', NavigationLayout: 'System', MenuChildExpandMode: 'System', UiDensityScale: null, DisableGradient: null, DisableShadow: null, DisableButtonIcon: null, LoginStyle: 'System' });
export function getAppearanceWatchValues(store) {
    const user = store.GetCurrentUser || {}, system = store.SysConfig || {};
    // 只订阅外观标量，避免主题监听深遍历大型角色权限和其它系统配置。
    return [user.Id, store.ApiBase, store.OsClient, store.themeColor, ...Object.keys(APPEARANCE_RESET).flatMap(field => [user[field], system[field]])];
}
let buttonIconObserver = null;

export function markTextButton(button) {
    // CSS 不能区分 slot 内的纯文字节点与纯图标；只标记有可见文案的按钮，
    // 不根据 title/aria-label 猜测，避免“关闭”等纯图标操作变成空白。
    const hasText = Boolean(String(button?.textContent || '').trim());
    if (hasText) button.setAttribute('data-mci-text-button', 'true');
    else button.removeAttribute('data-mci-text-button');
}

function syncButtonIconMarkers(enabled) {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    if (!enabled) {
        buttonIconObserver?.disconnect();
        buttonIconObserver = null;
        return;
    }
    const selector = '.el-button,.ve__button,.mci-btn';
    document.body.querySelectorAll(selector).forEach(markTextButton);
    if (buttonIconObserver) return;
    // 仅去图标模式启用观察。处理新增子树和文案变化，不监听属性，
    // 因此添加标记不会再次触发观察，也不每次扫描整个框架。
    buttonIconObserver = new MutationObserver(records => {
        const changed = new Set();
        for (const record of records) {
            const parent = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            const owner = parent?.closest?.(selector);
            if (owner) changed.add(owner);
            for (const node of record.addedNodes || []) {
                if (node.nodeType !== 1) continue;
                if (node.matches(selector)) changed.add(node);
                node.querySelectorAll(selector).forEach(button => changed.add(button));
            }
        }
        changed.forEach(markTextButton);
    });
    buttonIconObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
}

export function normalizeAppearanceSwitch(value) {
    if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true;
    if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
    return null;
}

export function resolveAppearanceSwitch(user, system, field, local = {}) {
    const personal = normalizeAppearanceSwitch(user?.[field]);
    if (personal !== null) return personal;
    if (!hasInstalledUserPreference(user, field)) {
        const device = normalizeAppearanceSwitch(local[field]);
        if (device !== null) return device;
    }
    return normalizeAppearanceSwitch(system?.[field]) === true;
}

export function resolveAppearanceDensity(user = {}, system = {}, local = {}) {
    const personal = user.UiDensityScale;
    if (personal != null && String(personal).trim() !== '' && Number.isFinite(Number(personal))) return normalizeUiDensityScale(personal);
    const device = local.UiDensityScale;
    if (!hasInstalledUserPreference(user, 'UiDensityScale') && device != null && String(device).trim() !== '') return normalizeUiDensityScale(device);
    return normalizeUiDensityScale(system.UiDensityScale);
}

export function normalizeHiddenFrameworkFunctions(value) {
    let items = value;
    if (typeof value === 'string') {
        try { items = JSON.parse(value); }
        catch { items = value.split(/[,;，]/); }
    }
    if (!Array.isArray(items)) return [];
    const keys = new Map(FRAMEWORK_FUNCTIONS.map(key => [key.toLowerCase(), key]));
    return [...new Set(items.map(item => keys.get(String(item?.Key ?? item?.Value ?? item).trim().toLowerCase())).filter(Boolean))];
}

function storageKey(store) {
    // 同源的不同租户和帐号不能共享新偏好；键只包含公开运行坐标，不含 Token。
    return `microi:appearance:${store.ApiBase || ''}|${store.OsClient || ''}|${store.GetCurrentUser?.Id || 'anonymous'}`;
}

export function readLocalAppearance(store) {
    try { return JSON.parse(localStorage.getItem(storageKey(store)) || '{}'); }
    catch { return {}; }
}

export function saveLocalAppearance(store, patch) {
    const value = { ...readLocalAppearance(store), ...patch };
    try { localStorage.setItem(storageKey(store), JSON.stringify(value)); } catch { /* 私密模式仍由当前组件即时应用。 */ }
    return value;
}

export function clearLocalAppearance(store) {
    try {
        localStorage.removeItem(storageKey(store));
        // 同时清理旧版设备回退，避免恢复后下次启动又读回旧值。
        for (const key of ['mci-theme', 'mci:corner-style', UI_DENSITY_STORAGE_KEY]) localStorage.removeItem(key);
    } catch { /* 存储受限时仍恢复当前页面。 */ }
    store.setThemeColor('');
}

export function applyFrameworkAppearance(store, local = readLocalAppearance(store)) {
    const user = store.GetCurrentUser || {}, system = store.SysConfig || {};
    const mode = resolveUserThemeMode(user, local.ThemeMode || '', system.ThemeMode);
    // 继承全局值只渲染，不写成个人选择；否则刷新会把全局默认固化成本地覆盖。
    setThemeMode(mode, { persist: false });
    setThemeColor(resolveUserThemeColor(user, local.ThemeColor || store.themeColor || '', system.ThemeColor), { mode });
    setCornerStyle(resolveUserCornerStyle(user, local.CornerStyle || '', system.CornerStyle), { persist: false });
    applyUiDensity(resolveAppearanceDensity(user, system, local), { persist: false });
    const personalLogin = user.LoginStyle && user.LoginStyle !== 'System' ? user.LoginStyle : '';
    const localLogin = !hasInstalledUserPreference(user, 'LoginStyle') && local.LoginStyle !== 'System' ? local.LoginStyle : '';
    const login = personalLogin || localLogin || system.LoginStyle || 'Original';
    store.loginStyle = ['Original', 'Minimal', 'Split', 'Console'].includes(login) ? login : 'Original';
    const root = document.documentElement;
    for (const field of APPEARANCE_SWITCHES) {
        const attribute = field.replace(/[A-Z]/g, (letter, index) => `${index ? '-' : ''}${letter.toLowerCase()}`);
        root.setAttribute(`data-mci-${attribute}`, String(resolveAppearanceSwitch(user, system, field, local)));
    }
    syncButtonIconMarkers(resolveAppearanceSwitch(user, system, 'DisableButtonIcon', local));
}
