const TRACE_KEYS = ["MicroiFormTrace", "microiFormTrace", "formTrace"];
const TRACE_STORAGE_KEY = "Microi.FormEngineTrace";
const ADVANCED_LAYOUT_STORAGE_KEY = "Microi.EnableAdvancedFieldLayoutRuntime";
const ADVANCED_LAYOUT_DISABLE_STORAGE_KEY = "Microi.DisableAdvancedFieldLayoutRuntime";

function getWindow() {
    try {
        return typeof window === "undefined" ? null : window;
    } catch (e) {
        return null;
    }
}

function isTruthy(value) {
    return value === true || value === 1 || value === "1" || value === "true" || value === "yes" || value === "on";
}

function isFalsy(value) {
    return value === false || value === 0 || value === "0" || value === "false" || value === "no" || value === "off";
}

function hasUrlFlag(key) {
    var win = getWindow();
    if (!win || !win.location) return false;
    var href = win.location.href || "";
    return href.indexOf(key + "=1") > -1 || href.indexOf(key + "=true") > -1;
}

function hasUrlFalsyFlag(key) {
    var win = getWindow();
    if (!win || !win.location) return false;
    var href = win.location.href || "";
    return href.indexOf(key + "=0") > -1 || href.indexOf(key + "=false") > -1 || href.indexOf(key + "=off") > -1;
}

export function isFormEngineTraceEnabled() {
    var win = getWindow();
    if (!win) return false;
    if (isTruthy(win.__MICROI_FORM_TRACE_ENABLED__)) return true;
    for (var i = 0; i < TRACE_KEYS.length; i++) {
        if (hasUrlFlag(TRACE_KEYS[i])) return true;
    }
    try {
        return isTruthy(win.localStorage && win.localStorage.getItem(TRACE_STORAGE_KEY));
    } catch (e) {
        return false;
    }
}

export function isAdvancedFieldLayoutRuntimeEnabled() {
    var win = getWindow();
    if (!win) return true;
    if (hasUrlFlag("MicroiDisableAdvancedFieldLayout") || hasUrlFlag("disableAdvancedFieldLayout")) return false;
    if (hasUrlFalsyFlag("MicroiAdvancedFieldLayout") || hasUrlFalsyFlag("advancedFieldLayout")) return false;
    if (hasUrlFlag("MicroiAdvancedFieldLayout") || hasUrlFlag("advancedFieldLayout")) return true;
    try {
        var disabled = win.localStorage && win.localStorage.getItem(ADVANCED_LAYOUT_DISABLE_STORAGE_KEY);
        if (isTruthy(disabled)) return false;
        var enabled = win.localStorage && win.localStorage.getItem(ADVANCED_LAYOUT_STORAGE_KEY);
        if (enabled !== null && enabled !== undefined && enabled !== "") {
            return !isFalsy(enabled);
        }
        return true;
    } catch (e) {
        return true;
    }
}

function safePayload(payload) {
    if (payload === undefined || payload === null) return payload;
    try {
        return JSON.parse(JSON.stringify(payload));
    } catch (e) {
        return payload;
    }
}

export function formTrace(label, payload) {
    if (!isFormEngineTraceEnabled()) return;
    var win = getWindow();
    var entry = {
        index: win.__MICROI_FORM_TRACE_INDEX__ = (win.__MICROI_FORM_TRACE_INDEX__ || 0) + 1,
        time: new Date().toISOString(),
        label: label,
        payload: safePayload(payload || {})
    };
    win.__MICROI_FORM_TRACE__ = win.__MICROI_FORM_TRACE__ || [];
    win.__MICROI_FORM_TRACE__.push(entry);
    if (win.__MICROI_FORM_TRACE__.length > 1000) {
        win.__MICROI_FORM_TRACE__.shift();
    }
    try {
        console.log("[MicroiFormTrace #" + entry.index + "] " + label, entry.payload);
    } catch (e) {}
}

