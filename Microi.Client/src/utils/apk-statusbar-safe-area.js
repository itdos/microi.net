export const MICROI_PHONE_LAYOUT_MAX_WIDTH = 768;
export const APK_DESKTOP_STATUSBAR_FLAG = "__microi_apkDesktopStatusbarInset";

const APK_WEBVIEW_TOP_CACHE = "__microi_apkWebviewTop";

function setDesktopInsetFlag(targetWindow, active) {
    if (targetWindow) {
        targetWindow[APK_DESKTOP_STATUSBAR_FLAG] = active === true;
    }
}

/**
 * microi.app 在 Android 手机上继续使用沉浸式状态栏；仅当远程页面进入
 * Microi.Client 的 PC 布局（宽度 > 768px）时，下移当前 WebView，避免系统
 * 状态栏覆盖 PC 顶栏。旋转回移动布局时会恢复 top: 0px。
 */
export function syncApkDesktopStatusbarInset(options = {}) {
    const targetWindow = options.targetWindow ||
        (typeof window !== "undefined" ? window : null);
    const plusRuntime = options.plusRuntime ||
        (targetWindow ? targetWindow.plus : null);
    const viewportWidth = Number(
        options.viewportWidth !== undefined
            ? options.viewportWidth
            : (targetWindow ? targetWindow.innerWidth : 0)
    );

    setDesktopInsetFlag(targetWindow, false);

    if (!targetWindow || !plusRuntime || !plusRuntime.navigator ||
        !plusRuntime.webview || !plusRuntime.os) {
        return { active: false, top: 0, reason: "not-plus-runtime" };
    }

    const userAgent = targetWindow.navigator && targetWindow.navigator.userAgent
        ? targetWindow.navigator.userAgent
        : "";
    if (!/MicroiApp/i.test(userAgent) ||
        String(plusRuntime.os.name || "").toLowerCase() !== "android") {
        return { active: false, top: 0, reason: "not-microi-android-apk" };
    }

    try {
        if (typeof plusRuntime.navigator.isImmersedStatusbar !== "function" ||
            plusRuntime.navigator.isImmersedStatusbar() !== true) {
            return { active: false, top: 0, reason: "not-immersed" };
        }

        const currentWebview = typeof plusRuntime.webview.currentWebview === "function"
            ? plusRuntime.webview.currentWebview()
            : null;
        if (!currentWebview || typeof currentWebview.setStyle !== "function") {
            return { active: false, top: 0, reason: "webview-unavailable" };
        }

        const useDesktopInset = viewportWidth > MICROI_PHONE_LAYOUT_MAX_WIDTH;
        const rawHeight = useDesktopInset &&
            typeof plusRuntime.navigator.getStatusbarHeight === "function"
            ? Number(plusRuntime.navigator.getStatusbarHeight())
            : 0;
        const statusbarHeight = Number.isFinite(rawHeight) && rawHeight > 0
            ? rawHeight
            : 0;
        const active = useDesktopInset && statusbarHeight > 0;
        const top = active ? statusbarHeight : 0;

        if (options.force === true || targetWindow[APK_WEBVIEW_TOP_CACHE] !== top) {
            currentWebview.setStyle({
                top: `${top}px`,
                bottom: "0px"
            });
            targetWindow[APK_WEBVIEW_TOP_CACHE] = top;
        }

        setDesktopInsetFlag(targetWindow, active);
        if (active && typeof plusRuntime.navigator.setStatusBarStyle === "function") {
            // WebView 下移后露出 manifest 的白色原生背景，使用深色系统图标。
            plusRuntime.navigator.setStatusBarStyle("dark");
        }

        return { active, top, reason: active ? "desktop-inset" : "phone-immersive" };
    } catch (e) {
        setDesktopInsetFlag(targetWindow, false);
        return { active: false, top: 0, reason: "runtime-error" };
    }
}
