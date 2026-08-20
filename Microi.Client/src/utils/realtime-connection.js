export const REALTIME_STATE_EVENT = "microi-realtime-state-changed";
export const REALTIME_CONNECTED_EVENT = "microi-websocket-connected";

export const REALTIME_RETRY_DELAYS_MS = Object.freeze([
    0,
    2000,
    5000,
    10000,
    30000
]);

export function getRealtimeRetryDelay(retryContext, delays = REALTIME_RETRY_DELAYS_MS) {
    const retryCount = Math.max(0, Number(retryContext?.previousRetryCount || 0));
    return retryCount < delays.length ? Number(delays[retryCount]) : null;
}

export function buildRealtimeHubUrl(apiBase, osClient, deviceClientId) {
    const base = String(apiBase || "").replace(/\/+$/, "");
    const params = new URLSearchParams();
    params.set("OsClient", String(osClient || ""));
    params.set("DeviceClientId", String(deviceClientId || ""));
    return `${base}/diy-websocket?${params.toString()}`;
}

export function normalizeRealtimeState(value) {
    const state = String(value || "Disconnected");
    return ["Connected", "Connecting", "Reconnecting", "Disconnected", "Exhausted", "Unavailable"]
        .includes(state)
        ? state
        : "Disconnected";
}

export function getRealtimeStatusText(state, retryCount = 0, retryDelay = null) {
    const normalized = normalizeRealtimeState(state);
    if (normalized === "Connected") return "实时通信已连接";
    if (normalized === "Connecting") return "实时通信正在连接";
    if (normalized === "Reconnecting") {
        const seconds = Number.isFinite(Number(retryDelay))
            ? Math.max(0, Math.ceil(Number(retryDelay) / 1000))
            : null;
        return seconds === null
            ? `实时通信正在重连（第 ${Math.max(1, Number(retryCount) || 1)} 次）`
            : `实时通信将在 ${seconds} 秒内重连（第 ${Math.max(1, Number(retryCount) || 1)} 次）`;
    }
    if (normalized === "Exhausted") return "实时通信重连已暂停，点击聊天图标可手动重试";
    if (normalized === "Unavailable") return "当前页面不启用独立实时连接";
    return "实时通信已断开，点击聊天图标可重试";
}

export function dispatchRealtimeState(detail, target) {
    const eventTarget = target || (typeof window !== "undefined" ? window : null);
    if (!eventTarget || typeof eventTarget.dispatchEvent !== "function") return null;
    const normalized = {
        state: normalizeRealtimeState(detail?.state),
        retryCount: Math.max(0, Number(detail?.retryCount || 0)),
        retryDelay: detail?.retryDelay === null || detail?.retryDelay === undefined
            ? null
            : Math.max(0, Number(detail.retryDelay) || 0),
        connectionId: String(detail?.connectionId || ""),
        osClient: String(detail?.osClient || ""),
        reason: String(detail?.reason || ""),
        at: new Date().toISOString()
    };
    eventTarget.__MICROI_REALTIME_STATE__ = normalized;
    if (typeof CustomEvent === "function") {
        eventTarget.dispatchEvent(new CustomEvent(REALTIME_STATE_EVENT, { detail: normalized }));
    } else if (typeof document !== "undefined" && document.createEvent) {
        const event = document.createEvent("CustomEvent");
        event.initCustomEvent(REALTIME_STATE_EVENT, false, false, normalized);
        eventTarget.dispatchEvent(event);
    }
    return normalized;
}
