export const LOGIN_STYLES = Object.freeze(["Original", "Minimal", "Split", "Console"]);

// 只接受已内置的模板；租户升级中出现空值/未知值时始终保留原登录页。
export function resolveLoginStyle(personalValue, systemValue) {
    const personal = String(personalValue || "").trim();
    const value = personal && personal.toLowerCase() !== "system" ? personal : String(systemValue || "").trim();
    return LOGIN_STYLES.find(style => style.toLowerCase() === value.toLowerCase()) || "Original";
}
