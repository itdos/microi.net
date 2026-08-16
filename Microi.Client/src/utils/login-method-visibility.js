export const LOGIN_METHOD_DISPLAY_SETTINGS = Object.freeze({
    Passkey: "Login.Passkey.Display",
    Totp: "Login.Authenticator.Display",
    Gitee: "Login.Gitee.Display",
    WeChat: "Login.WeChat.Display",
    GitHub: "Login.GitHub.Display"
});

export const DEFAULT_LOGIN_METHOD_KEYS = Object.freeze(Object.keys(LOGIN_METHOD_DISPLAY_SETTINGS));

/**
 * 登录方式的兼容默认值必须保持开启：旧租户没有设置、空值或正常开启值都显示，
 * 只有管理员通过开关明确保存为 0/false 时才隐藏。
 */
export function isLoginMethodDisplayEnabled(sysConfig, methodKey) {
    const settingKey = LOGIN_METHOD_DISPLAY_SETTINGS[methodKey];
    if (!settingKey) return true;

    if (!sysConfig || typeof sysConfig !== "object") return true;
    if (!Object.prototype.hasOwnProperty.call(sysConfig, settingKey)) return true;

    const value = sysConfig[settingKey];
    if (value === 0 || value === false) return false;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized !== "0" && normalized !== "false";
    }
    return true;
}
