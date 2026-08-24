export const MAP_PROVIDER = Object.freeze({
    SYSTEM: "System",
    AMAP: "AMap",
    BAIDU: "Baidu",
    TENCENT: "Tencent"
});

export const MAP_PROVIDER_LABELS = Object.freeze({
    [MAP_PROVIDER.SYSTEM]: "系统设置",
    [MAP_PROVIDER.AMAP]: "高德地图",
    [MAP_PROVIDER.BAIDU]: "百度地图",
    [MAP_PROVIDER.TENCENT]: "腾讯地图"
});

const PROVIDER_ALIASES = Object.freeze({
    system: MAP_PROVIDER.SYSTEM,
    default: MAP_PROVIDER.SYSTEM,
    amap: MAP_PROVIDER.AMAP,
    gaode: MAP_PROVIDER.AMAP,
    baidu: MAP_PROVIDER.BAIDU,
    bmap: MAP_PROVIDER.BAIDU,
    tencent: MAP_PROVIDER.TENCENT,
    qq: MAP_PROVIDER.TENCENT,
    qqmap: MAP_PROVIDER.TENCENT
});

export class MapRuntimeError extends Error {
    constructor(code, message, provider = "", cause = null) {
        super(message || code || "地图加载失败");
        this.name = "MapRuntimeError";
        this.code = code || "MAP_UNKNOWN";
        this.provider = provider || "";
        this.cause = cause || null;
    }
}

export function normalizeMapProvider(value, fallback = MAP_PROVIDER.SYSTEM) {
    const normalized = String(value || "").trim();
    if (!normalized) return fallback;
    return PROVIDER_ALIASES[normalized.toLowerCase()] || fallback;
}

export function sanitizeMapErrorDetail(value) {
    return String(value || "")
        .replace(
            /([?&](?:key|ak|client_?key|access_?key|security_?js_?code|jscode|secret|token)=)[^&#\s]+/gi,
            "$1***"
        )
        .replace(
            /((?:["'])(?:key|ak|client_?key|access_?key|security_?js_?code|jscode|secret|token)(?:["'])\s*:\s*)(?:"[^"]*"|'[^']*'|[^\s,;}&]+)/gi,
            "$1***"
        )
        .replace(
            /(\b(?:key|ak|client_?key|access_?key|security_?js_?code|jscode|secret|token)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}&]+)/gi,
            "$1***"
        )
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 260);
}

export function classifyMapRuntimeError(error, provider = "") {
    if (error instanceof MapRuntimeError) {
        return {
            code: error.code,
            provider: error.provider || provider,
            detail: sanitizeMapErrorDetail(error.message)
        };
    }

    const raw = sanitizeMapErrorDetail(error?.message || error?.Msg || error || "");
    const upper = raw.toUpperCase();
    let code = "MAP_SDK_INIT_FAILED";
    if (/INVALID_USER_KEY|INVALID_KEY|KEYINVALID|KEY INVALID|AK INVALID/.test(upper)) {
        code = "MAP_KEY_INVALID";
    } else if (/INVALID_USER_SCODE|SECURITYJSCODE|SECURITY CODE|安全密钥/.test(upper)) {
        code = "MAP_SECURITY_CODE_INVALID";
    } else if (/INVALID_USER_DOMAIN|REFERER|DOMAIN|白名单/.test(upper)) {
        code = "MAP_DOMAIN_NOT_ALLOWED";
    } else if (/USERKEY_PLAT_NOMATCH|SERVICE NOT ENABLED|PRODUCT/.test(upper)) {
        code = "MAP_PRODUCT_NOT_ENABLED";
    } else if (/TIMEOUT|TIMED OUT|超时/.test(upper)) {
        code = "MAP_SDK_TIMEOUT";
    } else if (/NETWORK|LOAD|SCRIPT|ERR_CONNECTION|ERR_NAME|FAILED TO FETCH|网络/.test(upper)) {
        code = "MAP_SDK_NETWORK";
    } else if (/WEBGL/.test(upper)) {
        code = "MAP_WEBGL_UNAVAILABLE";
    }
    return { code, provider, detail: raw };
}

export function supportsWebGl() {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(
            window.WebGLRenderingContext
            && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
        );
    } catch {
        return false;
    }
}

export function withMapTimeout(promise, timeoutMs, code, provider) {
    let timer = null;
    return Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => {
            timer = window.setTimeout(() => {
                reject(new MapRuntimeError(code || "MAP_SDK_TIMEOUT", "地图服务响应超时。", provider));
            }, timeoutMs);
        })
    ]).finally(() => window.clearTimeout(timer));
}

export async function requestMapRuntimeConfig(DiyCommon, requestedProvider) {
    let result;
    try {
        result = await DiyCommon.PostAsync({
            url: "/api/TenantSystemSettings/GetMapRuntime",
            data: { Provider: normalizeMapProvider(requestedProvider) },
            suppressErrorNotification: true,
            timeout: 12000
        });
    } catch (error) {
        throw new MapRuntimeError(
            error?.response?.status === 404 ? "MAP_RUNTIME_API_UNAVAILABLE" : "MAP_RUNTIME_CONFIG_FAILED",
            error?.message || "地图安全配置读取失败。",
            requestedProvider,
            error
        );
    }

    const data = result?.Data || {};
    const provider = normalizeMapProvider(data.Provider, normalizeMapProvider(requestedProvider));
    if (result?.Code !== 1) {
        throw new MapRuntimeError(
            result?.DataAppend?.ReasonCode || data.ReasonCode || "MAP_RUNTIME_CONFIG_FAILED",
            result?.Msg || "地图安全配置读取失败。",
            provider
        );
    }
    if (![MAP_PROVIDER.AMAP, MAP_PROVIDER.BAIDU, MAP_PROVIDER.TENCENT].includes(provider)) {
        throw new MapRuntimeError("MAP_PROVIDER_UNSUPPORTED", "系统返回了不受支持的地图供应商。", provider);
    }
    if (!String(data.ClientKey || "").trim()) {
        throw new MapRuntimeError("MAP_KEY_MISSING", "当前地图供应商尚未配置客户端 Key。", provider);
    }
    return {
        Provider: provider,
        ClientKey: String(data.ClientKey).trim(),
        SecurityJsCode: String(data.SecurityJsCode || "").trim(),
        ServiceHost: String(data.ServiceHost || "").trim(),
        Source: String(data.Source || "Tenant")
    };
}
