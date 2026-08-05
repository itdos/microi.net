export const MICROI_PHONE_LAYOUT_MAX_WIDTH = 768;
export const APK_DESKTOP_STATUSBAR_FLAG = "__microi_apkDesktopStatusbarInset";
export const APK_DESKTOP_STATUSBAR_DIAGNOSTICS = "__microi_apkDesktopStatusbarDiagnostics";
export const APK_DESKTOP_STATUSBAR_FALLBACK = 32;

const APK_WEBVIEW_TOP_CACHE = "__microi_apkWebviewTop";
const MIN_REASONABLE_STATUSBAR_HEIGHT = 12;
const MAX_REASONABLE_STATUSBAR_HEIGHT = 96;

function setDesktopInsetFlag(targetWindow, active) {
    if (targetWindow) {
        targetWindow[APK_DESKTOP_STATUSBAR_FLAG] = active === true;
    }
}

function setDiagnostics(targetWindow, diagnostics) {
    if (targetWindow) {
        targetWindow[APK_DESKTOP_STATUSBAR_DIAGNOSTICS] = diagnostics;
    }
}

function readNumber(reader) {
    try {
        const value = Number(reader());
        return Number.isFinite(value) ? value : 0;
    } catch (e) {
        return 0;
    }
}

function normalizeStatusbarHeight(value) {
    const height = Number(value);
    if (!Number.isFinite(height) ||
        height < MIN_REASONABLE_STATUSBAR_HEIGHT ||
        height > MAX_REASONABLE_STATUSBAR_HEIGHT) {
        return 0;
    }
    return height;
}

function getAndroidScale(plusRuntime, targetWindow) {
    const plusScale = readNumber(function () {
        return plusRuntime.screen && plusRuntime.screen.scale;
    });
    if (plusScale > 0) return plusScale;

    const browserScale = Number(targetWindow && targetWindow.devicePixelRatio);
    return Number.isFinite(browserScale) && browserScale > 0 ? browserScale : 1;
}

function getAndroidNativeHeightCandidates(plusRuntime, targetWindow) {
    const result = [];
    const android = plusRuntime.android;
    if (!android || typeof android.invoke !== "function") return result;

    const scale = getAndroidScale(plusRuntime, targetWindow);

    // Android 6+：直接从当前原生 WebView 的 WindowInsets 读取状态栏物理高度。
    try {
        const nativeWebview = typeof android.currentWebview === "function"
            ? android.currentWebview()
            : null;
        const rootInsets = nativeWebview
            ? android.invoke(nativeWebview, "getRootWindowInsets")
            : null;
        if (rootInsets) {
            const systemInsetTop = readNumber(function () {
                return android.invoke(rootInsets, "getSystemWindowInsetTop");
            });
            const stableInsetTop = readNumber(function () {
                return android.invoke(rootInsets, "getStableInsetTop");
            });
            const insetHeight = normalizeStatusbarHeight(
                Math.max(systemInsetTop, stableInsetTop) / scale
            );
            if (insetHeight > 0) {
                result.push({ source: "android-window-insets", height: insetHeight });
            }
        }
    } catch (e) {}

    // 厂商 ROM 的 5+ 状态栏 API 可能返回 false/0，继续读取 Android 系统资源。
    try {
        const activity = typeof android.runtimeMainActivity === "function"
            ? android.runtimeMainActivity()
            : null;
        const resources = activity ? android.invoke(activity, "getResources") : null;
        const resourceId = resources
            ? readNumber(function () {
                return android.invoke(
                    resources,
                    "getIdentifier",
                    "status_bar_height",
                    "dimen",
                    "android"
                );
            })
            : 0;
        const resourcePixels = resourceId > 0
            ? readNumber(function () {
                return android.invoke(resources, "getDimensionPixelSize", resourceId);
            })
            : 0;
        const resourceHeight = normalizeStatusbarHeight(resourcePixels / scale);
        if (resourceHeight > 0) {
            result.push({ source: "android-status-bar-resource", height: resourceHeight });
        }
    } catch (e) {}

    return result;
}

function resolveDesktopStatusbarHeight(plusRuntime, targetWindow) {
    let immersedReported = null;
    if (typeof plusRuntime.navigator.isImmersedStatusbar === "function") {
        try {
            immersedReported = plusRuntime.navigator.isImmersedStatusbar() === true;
        } catch (e) {}
    }

    const candidates = [];
    const navigatorHeight = normalizeStatusbarHeight(readNumber(function () {
        return typeof plusRuntime.navigator.getStatusbarHeight === "function"
            ? plusRuntime.navigator.getStatusbarHeight()
            : 0;
    }));
    if (navigatorHeight > 0) {
        candidates.push({ source: "plus-statusbar", height: navigatorHeight });
    }

    let safeAreaInsets = null;
    try {
        safeAreaInsets = typeof plusRuntime.navigator.getSafeAreaInsets === "function"
            ? plusRuntime.navigator.getSafeAreaInsets()
            : null;
    } catch (e) {}
    const safeAreaHeight = normalizeStatusbarHeight(
        safeAreaInsets ? safeAreaInsets.top : 0
    );
    if (safeAreaHeight > 0) {
        candidates.push({ source: "plus-safe-area", height: safeAreaHeight });
    }

    candidates.push(...getAndroidNativeHeightCandidates(plusRuntime, targetWindow));

    if (candidates.length === 0) {
        return {
            height: APK_DESKTOP_STATUSBAR_FALLBACK,
            source: "desktop-fallback",
            immersedReported,
            candidates: []
        };
    }

    const selected = candidates.reduce(function (current, item) {
        return item.height > current.height ? item : current;
    });
    return {
        height: selected.height,
        source: selected.source,
        immersedReported,
        candidates
    };
}

/**
 * microi.app 在 Android 手机上继续使用沉浸式状态栏；仅当远程页面进入
 * Microi.Client 的 PC 布局（宽度 > 768px）时，下移当前 WebView。厂商 ROM
 * 即使错误返回“非沉浸”或状态栏高度 0，也会通过原生探测或桌面保底避让。
 * 旋转回移动布局时恢复 top: 0px。
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
        const result = { active: false, top: 0, reason: "not-plus-runtime", source: "none" };
        setDiagnostics(targetWindow, result);
        return result;
    }

    const userAgent = targetWindow.navigator && targetWindow.navigator.userAgent
        ? targetWindow.navigator.userAgent
        : "";
    if (!/MicroiApp/i.test(userAgent) ||
        String(plusRuntime.os.name || "").toLowerCase() !== "android") {
        const result = {
            active: false,
            top: 0,
            reason: "not-microi-android-apk",
            source: "none"
        };
        setDiagnostics(targetWindow, result);
        return result;
    }

    try {
        const currentWebview = typeof plusRuntime.webview.currentWebview === "function"
            ? plusRuntime.webview.currentWebview()
            : null;
        if (!currentWebview || typeof currentWebview.setStyle !== "function") {
            const result = {
                active: false,
                top: 0,
                reason: "webview-unavailable",
                source: "none"
            };
            setDiagnostics(targetWindow, result);
            return result;
        }

        const useDesktopInset = viewportWidth > MICROI_PHONE_LAYOUT_MAX_WIDTH;
        const resolved = useDesktopInset
            ? resolveDesktopStatusbarHeight(plusRuntime, targetWindow)
            : { height: 0, source: "phone-immersive", immersedReported: null, candidates: [] };
        const active = useDesktopInset;
        const top = active ? resolved.height : 0;

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

        const result = {
            active,
            top,
            reason: active ? "desktop-inset" : "phone-immersive",
            source: resolved.source,
            immersedReported: resolved.immersedReported,
            candidates: resolved.candidates
        };
        setDiagnostics(targetWindow, result);
        return result;
    } catch (e) {
        setDesktopInsetFlag(targetWindow, false);
        const result = { active: false, top: 0, reason: "runtime-error", source: "none" };
        setDiagnostics(targetWindow, result);
        return result;
    }
}
