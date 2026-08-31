const UI_DENSITY_STORAGE_KEY = "microi_ui_density_scale";
const UI_DENSITY_EVENT = "microi-ui-density-change";
const UI_DENSITY_MIN = 90;
const UI_DENSITY_MAX = 110;
const UI_DENSITY_STEP = 5;

const listeners = new Set();
let currentScale = 100;
let storageListenerInstalled = false;

function normalizeUiDensityScale(value) {
    if (value === null || value === undefined || String(value).trim() === "") return 100;
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return 100;
    var stepped = Math.round(parsed / UI_DENSITY_STEP) * UI_DENSITY_STEP;
    return Math.max(UI_DENSITY_MIN, Math.min(UI_DENSITY_MAX, stepped));
}

function scaledPx(value, scale, minimum) {
    var result = Math.round(Number(value) * Number(scale) * 10) / 10;
    if (Number.isFinite(minimum)) result = Math.max(minimum, result);
    return result + "px";
}

function buildUiDensityVariables(value) {
    var scale = normalizeUiDensityScale(value);
    var factor = scale / 100;
    return {
        "--mci-ui-scale": String(factor),
        "--mci-ui-base-font": scaledPx(13, factor),
        "--mci-ui-control-height": scaledPx(28, factor, 24),
        "--el-font-size-extra-large": scaledPx(18, factor),
        "--el-font-size-large": scaledPx(15, factor),
        "--el-font-size-medium": scaledPx(14, factor),
        "--el-font-size-base": scaledPx(13, factor),
        "--el-font-size-small": scaledPx(12, factor),
        "--el-font-size-extra-small": scaledPx(11, factor),
        "--el-font-line-height-primary": scaledPx(20, factor),
        "--el-component-size-large": scaledPx(34, factor, 30),
        "--el-component-size": scaledPx(28, factor, 24),
        "--el-component-size-small": scaledPx(28, factor, 24),
        "--el-menu-item-height": scaledPx(40, factor, 36),
        "--el-menu-sub-item-height": scaledPx(36, factor, 32),
        "--font-size-base": scaledPx(12, factor),
        "--height-base": scaledPx(28, factor, 24),
        "--mci-space-1": scaledPx(4, factor, 3),
        "--mci-space-2": scaledPx(8, factor, 6),
        "--mci-space-3": scaledPx(12, factor, 9),
        "--mci-space-4": scaledPx(16, factor, 12),
        "--mci-space-5": scaledPx(20, factor, 15),
        "--mci-space-6": scaledPx(24, factor, 18),
        "--mci-space-8": scaledPx(32, factor, 24),
        "--mci-space-10": scaledPx(40, factor, 30),
        "--mci-space-12": scaledPx(48, factor, 36),
        "--mci-text-xs": scaledPx(11, factor),
        "--mci-text-sm": scaledPx(13, factor),
        "--mci-text-base": scaledPx(15, factor),
        "--mci-text-lg": scaledPx(17, factor),
        "--mci-text-xl": scaledPx(20, factor),
        "--mci-text-2xl": scaledPx(24, factor),
        "--mci-text-3xl": scaledPx(28, factor),
        "--mci-text-4xl": scaledPx(34, factor),
        // 触屏端不能随紧凑模式缩到 44px 以下；舒适模式可同步放大。
        "--mci-touch-target": scaledPx(44, factor, 44),
    };
}

function densityName(scale) {
    return ({ 90: "紧凑", 95: "偏紧凑", 100: "标准", 105: "舒适", 110: "大字" })[scale] || "标准";
}

function readStoredScale() {
    try {
        if (typeof localStorage !== "undefined") {
            return normalizeUiDensityScale(localStorage.getItem(UI_DENSITY_STORAGE_KEY));
        }
    } catch (error) { }
    return 100;
}

function getUiDensitySnapshot() {
    return {
        scale: currentScale,
        factor: currentScale / 100,
        name: densityName(currentScale),
        variables: buildUiDensityVariables(currentScale),
    };
}

function applyUiDensity(value, options) {
    options = options || {};
    currentScale = normalizeUiDensityScale(value);
    var snapshot = getUiDensitySnapshot();
    if (typeof document !== "undefined" && document.documentElement) {
        var root = document.documentElement;
        Object.entries(snapshot.variables).forEach(function ([name, cssValue]) {
            // element-variables.scss 的历史兼容变量含 !important；这里用同级
            // important 才能保证用户选择在所有主题与深色模式下生效。
            root.style.setProperty(name, cssValue, "important");
        });
        root.dataset.mciUiDensity = String(currentScale);
    }
    if (options.persist !== false) {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(UI_DENSITY_STORAGE_KEY, String(currentScale));
            }
        } catch (error) { }
    }
    if (typeof window !== "undefined") {
        window.__MICROI_UI_DENSITY__ = snapshot;
        if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
            window.dispatchEvent(new CustomEvent(UI_DENSITY_EVENT, { detail: snapshot }));
        }
    }
    listeners.forEach(function (listener) {
        try { listener(snapshot); } catch (error) { }
    });
    return snapshot;
}

function initializeUiDensity() {
    applyUiDensity(readStoredScale(), { persist: false });
    if (!storageListenerInstalled && typeof window !== "undefined" && typeof window.addEventListener === "function") {
        storageListenerInstalled = true;
        window.addEventListener("storage", function (event) {
            if (event && event.key === UI_DENSITY_STORAGE_KEY) {
                applyUiDensity(event.newValue, { persist: false });
            }
        });
    }
    return getUiDensitySnapshot();
}

function setUiDensityScale(value) {
    return applyUiDensity(value, { persist: true });
}

function subscribeUiDensity(listener) {
    if (typeof listener !== "function") return function () { };
    listeners.add(listener);
    listener(getUiDensitySnapshot());
    return function () { listeners.delete(listener); };
}

export {
    UI_DENSITY_EVENT,
    UI_DENSITY_MAX,
    UI_DENSITY_MIN,
    UI_DENSITY_STEP,
    UI_DENSITY_STORAGE_KEY,
    applyUiDensity,
    buildUiDensityVariables,
    getUiDensitySnapshot,
    initializeUiDensity,
    normalizeUiDensityScale,
    setUiDensityScale,
    subscribeUiDensity,
};
