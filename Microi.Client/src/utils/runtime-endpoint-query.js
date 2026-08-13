const RUNTIME_ENDPOINT_GLOBAL_KEY = "__MICROI_RUNTIME_ENDPOINT__";
const RUNTIME_ENDPOINT_PROTOCOL = "microi.runtime-endpoint.v1";

function getBrowserSearch(search) {
    if (typeof search === "string") return search;
    if (typeof window !== "undefined" && window.location) return window.location.search || "";
    return "";
}

function collectQueryValues(params, expectedName) {
    const values = [];
    const normalizedName = String(expectedName || "").toLowerCase();
    params.forEach(function (value, name) {
        if (String(name || "").toLowerCase() === normalizedName) values.push(String(value || "").trim());
    });
    return values;
}

function readSingleQueryValue(params, name) {
    const values = collectQueryValues(params, name);
    if (values.length === 0) return { present: false, raw: "" };

    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length > 1) {
        throw new Error(`Microi：URL 中存在互相冲突的 ${name} 参数，请只保留一个值。`);
    }
    if (!uniqueValues[0]) {
        throw new Error(`Microi：URL 参数 ${name} 不能为空。`);
    }
    return { present: true, raw: uniqueValues[0] };
}

export function normalizeRuntimeApiBase(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    let parsed;
    try {
        parsed = new URL(raw);
    } catch (error) {
        throw new Error("Microi：URL 参数 ApiBase 必须是完整的 http:// 或 https:// 地址。");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Microi：URL 参数 ApiBase 只允许 http:// 或 https:// 地址。");
    }
    if (parsed.username || parsed.password) {
        throw new Error("Microi：URL 参数 ApiBase 禁止包含用户名或密码。");
    }
    if (parsed.search || parsed.hash) {
        throw new Error("Microi：URL 参数 ApiBase 只能包含服务根地址和路径，不能再包含 query 或 hash。");
    }

    const pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.origin + (pathname && pathname !== "/" ? pathname : "");
}

export function normalizeRuntimeOsClient(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    if (normalized.length > 128 || /[\u0000-\u001f\u007f\s\\/?#&=%]/.test(normalized)) {
        throw new Error("Microi：URL 参数 OsClient 含有非法字符或长度超过 128。");
    }
    return normalized;
}

export function getRuntimeEndpointQuery(search) {
    const params = new URLSearchParams(getBrowserSearch(search).replace(/^\?/, ""));
    const apiBaseParam = readSingleQueryValue(params, "ApiBase");
    const osClientParam = readSingleQueryValue(params, "OsClient");

    return {
        apiBase: {
            present: apiBaseParam.present,
            value: apiBaseParam.present ? normalizeRuntimeApiBase(apiBaseParam.raw) : ""
        },
        osClient: {
            present: osClientParam.present,
            value: osClientParam.present ? normalizeRuntimeOsClient(osClientParam.raw) : ""
        }
    };
}

export function getRuntimeWindowValue(name) {
    if (typeof window === "undefined") return "";
    const value = window[name];
    return value == null ? "" : String(value).trim();
}

export function publishRuntimeEndpointContext(options) {
    if (typeof window === "undefined") return null;
    const endpointQuery = getRuntimeEndpointQuery();
    const apiBase = endpointQuery.apiBase.present
        ? endpointQuery.apiBase.value
        : normalizeRuntimeApiBase(options?.apiBase || "");
    const osClient = endpointQuery.osClient.present
        ? endpointQuery.osClient.value
        : normalizeRuntimeOsClient(options?.osClient || "");
    const context = Object.freeze({
        protocol: RUNTIME_ENDPOINT_PROTOCOL,
        apiBase,
        osClient,
        webBase: window.location?.origin || "",
        source: Object.freeze({
            apiBase: endpointQuery.apiBase.present ? "url-query" : (options?.apiBaseSource || "resolved"),
            osClient: endpointQuery.osClient.present ? "url-query" : (options?.osClientSource || "resolved")
        }),
        queryOverrides: Object.freeze({
            apiBase: endpointQuery.apiBase.present,
            osClient: endpointQuery.osClient.present
        }),
        browserStorageScope: "origin",
        requiresIsolatedContextForParallelTenants: true
    });

    window[RUNTIME_ENDPOINT_GLOBAL_KEY] = context;
    try {
        window.dispatchEvent(new CustomEvent("microi:runtime-endpoint-ready", { detail: context }));
    } catch (error) {
        const event = document.createEvent("CustomEvent");
        event.initCustomEvent("microi:runtime-endpoint-ready", false, false, context);
        window.dispatchEvent(event);
    }
    return context;
}

export { RUNTIME_ENDPOINT_GLOBAL_KEY, RUNTIME_ENDPOINT_PROTOCOL };
