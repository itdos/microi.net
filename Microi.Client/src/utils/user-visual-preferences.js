const OWN = Object.prototype.hasOwnProperty;

export const USER_THEME_MODE = Object.freeze({
    LIGHT: "light",
    DARK: "dark"
});

export const USER_MENU_CHILD_EXPAND_MODE = Object.freeze({
    SYSTEM: "System",
    DOWN: "Down",
    RIGHT: "Right"
});

function text(value) {
    return value == null ? "" : String(value).trim();
}

export function hasInstalledUserPreference(user, fieldName) {
    return Boolean(user?.Id) && OWN.call(user, fieldName);
}

export function normalizeUserThemeMode(value, fallback = USER_THEME_MODE.LIGHT) {
    const normalized = text(value).toLowerCase();
    if (normalized === USER_THEME_MODE.DARK) return USER_THEME_MODE.DARK;
    if (normalized === USER_THEME_MODE.LIGHT) return USER_THEME_MODE.LIGHT;
    return fallback === USER_THEME_MODE.DARK ? USER_THEME_MODE.DARK : USER_THEME_MODE.LIGHT;
}

export function resolveUserThemeMode(user = {}, localMode = USER_THEME_MODE.LIGHT) {
    if (hasInstalledUserPreference(user, "ThemeMode")) {
        return normalizeUserThemeMode(user.ThemeMode, USER_THEME_MODE.LIGHT);
    }
    return normalizeUserThemeMode(localMode, USER_THEME_MODE.LIGHT);
}

export function resolveUserThemeColor(user = {}, localColor = "", systemColor = "", fallback = "#409eff") {
    if (hasInstalledUserPreference(user, "ThemeColor")) {
        return text(user.ThemeColor) || text(systemColor) || fallback;
    }
    return text(localColor) || text(systemColor) || fallback;
}

export function normalizeUserMenuChildExpandMode(value) {
    const normalized = text(value).toLowerCase();
    if (normalized === "right") return USER_MENU_CHILD_EXPAND_MODE.RIGHT;
    if (normalized === "down") return USER_MENU_CHILD_EXPAND_MODE.DOWN;
    return USER_MENU_CHILD_EXPAND_MODE.SYSTEM;
}

export function resolveUserMenuChildExpandMode(userValue, systemValue) {
    const personal = normalizeUserMenuChildExpandMode(userValue);
    if (personal !== USER_MENU_CHILD_EXPAND_MODE.SYSTEM) return personal;
    return text(systemValue).toLowerCase() === "right"
        ? USER_MENU_CHILD_EXPAND_MODE.RIGHT
        : USER_MENU_CHILD_EXPAND_MODE.DOWN;
}
