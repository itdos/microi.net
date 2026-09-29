// 旧租户没有新增账号字段时仍可在当前浏览器立即切换。
const STORAGE_KEY = "mci:corner-style";

export function normalizeCornerStyle(value) {
    return value === "square" ? "square" : "round";
}

export function getCornerStyle() {
    try {
        return normalizeCornerStyle(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        return "round";
    }
}

export function setCornerStyle(value) {
    const style = normalizeCornerStyle(value);
    document.documentElement.dataset.mciCornerStyle = style;
    try {
        window.localStorage.setItem(STORAGE_KEY, style);
    } catch {
        // 私密模式禁用存储时仍保留本次页面的切换效果。
    }
    return style;
}

export function initCornerStyle() {
    return setCornerStyle(getCornerStyle());
}
