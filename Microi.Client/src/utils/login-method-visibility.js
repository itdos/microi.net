export const LOGIN_METHOD_DISABLED_SETTINGS = Object.freeze({
    Passkey: "DisableLoginPasskey",
    Totp: "DisableLoginAuthenticator",
    Gitee: "DisableLoginGitee",
    WeChat: "DisableLoginWeChat",
    GitHub: "DisableLoginGitHub"
});

const LEGACY_LOGIN_METHOD_DISPLAY_SETTINGS = Object.freeze({
    Passkey: ["LoginPasskeyDisplay", "Login.Passkey.Display"],
    Totp: ["LoginAuthenticatorDisplay", "Login.Authenticator.Display"],
    Gitee: ["LoginGiteeDisplay", "Login.Gitee.Display"],
    WeChat: ["LoginWeChatDisplay", "Login.WeChat.Display"],
    GitHub: ["LoginGitHubDisplay", "Login.GitHub.Display"]
});

export const DEFAULT_LOGIN_METHOD_KEYS = Object.freeze(Object.keys(LOGIN_METHOD_DISABLED_SETTINGS));

function hasConfiguredValue(config, key) {
    if (!config || typeof config !== "object" || !Object.prototype.hasOwnProperty.call(config, key)) return false;
    const value = config[key];
    return value !== null
        && value !== undefined
        && (typeof value !== "string" || value.trim() !== "");
}

function isEnabledSwitchValue(value) {
    if (value === true || value === 1) return true;
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
}

function isLegacyDisplayEnabled(value) {
    if (value === 0 || value === false) return false;
    if (typeof value !== "string") return true;
    const normalized = value.trim().toLowerCase();
    return normalized !== "0" && normalized !== "false";
}

/**
 * 新字段使用“关闭入口”的负向开关：默认显示，只有明确开启关闭开关时才隐藏。
 * 旧租户缺少新字段时继续读取原正向显示字段，保持升级前状态。
 */
export function isLoginMethodDisplayEnabled(sysConfig, methodKey) {
    const disabledSettingKey = LOGIN_METHOD_DISABLED_SETTINGS[methodKey];
    if (!disabledSettingKey) return true;

    if (!sysConfig || typeof sysConfig !== "object") return true;
    if (hasConfiguredValue(sysConfig, disabledSettingKey)) {
        return !isEnabledSwitchValue(sysConfig[disabledSettingKey]);
    }

    const legacyKeys = LEGACY_LOGIN_METHOD_DISPLAY_SETTINGS[methodKey] || [];
    const legacyKey = legacyKeys.find((key) => hasConfiguredValue(sysConfig, key));
    if (legacyKey) return isLegacyDisplayEnabled(sysConfig[legacyKey]);
    return true;
}
