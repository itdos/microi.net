export const PLATFORM_SYS_MENU_BOOTSTRAP_RETRY_DELAYS_MS = Object.freeze([
    500,
    1000,
    2000,
    3000,
    5000,
    5000,
    5000,
    5000,
    5000,
    5000,
    5000,
    5000
]);

function collectFailureText(value) {
    const parts = [];
    const append = (item) => {
        if (item === null || item === undefined) return;
        if (typeof item === "string" || typeof item === "number") {
            parts.push(String(item));
        }
    };
    append(value);
    append(value?.Msg);
    append(value?.msg);
    append(value?.message);
    append(value?.Message);
    append(value?.response?.status);
    append(value?.response?.statusText);
    append(value?.response?.data);
    append(value?.response?.data?.Msg);
    append(value?.response?.data?.message);
    return parts.join(" ");
}

export function isPlatformSysMenuBootstrapPending(value) {
    const code = Number(value?.Code ?? value?.code ?? value?.response?.data?.Code);
    if (code === 1001 || code === 1002) return false;

    const text = collectFailureText(value);
    return /platform-sys-menu/i.test(text)
        && (/sys_apiengine/i.test(text)
            || /NoExistData|不存在的数据|not\s+found|404/i.test(text));
}

export function createPlatformSysMenuBootstrapError(value) {
    const error = new Error(
        "平台启动依赖 platform-sys-menu 尚未就绪。请等待平台应用升级完成后重试；若持续出现，请安装或更新“应用商城”至 v7.5.49 或更高版本。"
    );
    error.code = value?.Code ?? value?.code ?? "PLATFORM_SYS_MENU_NOT_READY";
    error.reasonCode = "PLATFORM_SYS_MENU_NOT_READY";
    error.cause = value;
    return error;
}
