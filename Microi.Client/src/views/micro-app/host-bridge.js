export const MICRO_APP_HOST_PROTOCOL = "microi.host.v1";
export const MICRO_APP_HOST_ACTION_TYPE = "micro-app:host-action";
export const MICRO_APP_HOST_ACTION_RESULT_TYPE = "micro-app:host-action-result";

const TAB_ACTIONS = Object.freeze([
    "closeTab",
    "navigate",
    "replaceTab",
    "back",
    "forward",
    "reloadTab",
    "setTabTitle",
    "showMessage"
]);

const ACTION_ALIASES = Object.freeze({
    closetab: "closeTab",
    closecurrenttab: "closeTab",
    navigate: "navigate",
    opentab: "navigate",
    openroute: "navigate",
    push: "navigate",
    replacetab: "replaceTab",
    replace: "replaceTab",
    back: "back",
    goback: "back",
    forward: "forward",
    goforward: "forward",
    reloadtab: "reloadTab",
    refreshtab: "reloadTab",
    reload: "reloadTab",
    refresh: "reloadTab",
    settabtitle: "setTabTitle",
    updatetabtitle: "setTabTitle",
    settitle: "setTabTitle",
    showmessage: "showMessage",
    message: "showMessage",
    tips: "showMessage",
    toast: "showMessage"
});

function isPlainObject(value) {
    return Boolean(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeAction(value) {
    const compact = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return ACTION_ALIASES[compact] || "";
}

function normalizeRouteValues(value) {
    if (!isPlainObject(value)) return undefined;
    const result = {};
    Object.keys(value).slice(0, 50).forEach((key) => {
        if (["__proto__", "prototype", "constructor"].includes(key)) return;
        const item = value[key];
        if (Array.isArray(item)) {
            result[key] = item.slice(0, 50).map((entry) => entry == null ? entry : String(entry).slice(0, 2048));
        } else if (["string", "number", "boolean"].includes(typeof item) || item == null) {
            result[key] = item == null ? item : String(item).slice(0, 2048);
        }
    });
    return result;
}

function normalizeInternalPath(value) {
    let path = String(value || "").trim();
    if (path.startsWith("/#/")) path = path.slice(2);
    else if (path.startsWith("#/")) path = path.slice(1);

    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path)) {
        throw new Error("宿主路由必须是以 / 开头的站内地址");
    }

    const rawPathname = path.split(/[?#]/, 1)[0];
    let decodedPathname = rawPathname;
    try {
        decodedPathname = decodeURIComponent(rawPathname);
    } catch (_) {
        throw new Error("宿主路由包含无效编码");
    }
    if (decodedPathname.startsWith("//") || decodedPathname.includes("\\") || /[\u0000-\u001f\u007f]/.test(decodedPathname)) {
        throw new Error("宿主路由必须是安全的站内地址");
    }

    const pathname = decodedPathname.replace(/\/+$/, "").toLowerCase() || "/";
    if (["/login", "/access-login", "/redirect"].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
        throw new Error("该系统路由不能由微服务直接打开");
    }
    return path;
}

export function createMicroAppHostCapabilities() {
    return {
        protocol: MICRO_APP_HOST_PROTOCOL,
        mode: "tab",
        requestType: MICRO_APP_HOST_ACTION_TYPE,
        resultType: MICRO_APP_HOST_ACTION_RESULT_TYPE,
        actions: [...TAB_ACTIONS]
    };
}

export function parseMicroAppHostAction(payload) {
    if (!payload || typeof payload !== "object") return null;
    const type = String(payload.type || payload.Type || "").trim().toLowerCase();
    if (type !== MICRO_APP_HOST_ACTION_TYPE) return null;

    const nestedData = payload.data ?? payload.Data ?? {};
    const action = normalizeAction(payload.action || payload.Action || nestedData?.action || nestedData?.Action);
    return {
        action,
        requestId: String(payload.requestId || payload.RequestId || nestedData?.requestId || nestedData?.RequestId || "").slice(0, 128),
        data: nestedData
    };
}

export function normalizeHostRouteTarget(input) {
    let target = input;
    if (isPlainObject(input)) {
        target = input.to ?? input.To ?? input.route ?? input.Route ?? input;
    }

    if (typeof target === "string") {
        return normalizeInternalPath(target);
    }
    if (!isPlainObject(target)) {
        throw new Error("缺少要打开的宿主路由");
    }

    const path = target.path ?? target.Path;
    const name = target.name ?? target.Name;
    const route = {};
    if (path) route.path = normalizeInternalPath(path);
    else if (name) route.name = String(name).trim().slice(0, 128);
    else throw new Error("宿主路由必须包含 path 或 name");

    const query = normalizeRouteValues(target.query ?? target.Query);
    const params = normalizeRouteValues(target.params ?? target.Params);
    if (query) route.query = query;
    if (params) route.params = params;
    if (target.hash ?? target.Hash) {
        const hash = String(target.hash ?? target.Hash).trim().slice(0, 2048);
        route.hash = hash.startsWith("#") ? hash : `#${hash}`;
    }
    return route;
}

export function normalizeHostTabTitle(input) {
    const value = isPlainObject(input) ? input.title ?? input.Title : input;
    const title = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
    if (!title) throw new Error("Tab 标题不能为空");
    return title;
}

export function normalizeHostMessage(input) {
    const data = isPlainObject(input) ? input : { message: input };
    const message = String(data.message ?? data.Message ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 1000);
    if (!message) throw new Error("宿主提示内容不能为空");
    const requestedType = String(data.messageType ?? data.MessageType ?? data.level ?? data.Level ?? "info").toLowerCase();
    const messageType = ["success", "warning", "error", "info"].includes(requestedType) ? requestedType : "info";
    return { message, messageType };
}
