export const PLATFORM_NOTIFICATION_ENGINE_KEYS = Object.freeze({
    Send: "msg_event",
    List: "msg_internal_list",
    MarkRead: "msg_internal_mark_read"
});

function callEngine(runEngine, engineKey, param, callback) {
    const promise = Promise.resolve(runEngine(engineKey, param || {}));
    if (typeof callback === "function") {
        promise.then(callback);
    }
    return promise;
}

export function createPlatformNotificationApi(runEngine) {
    if (typeof runEngine !== "function") {
        throw new TypeError("runEngine must be a function");
    }
    return Object.freeze({
        Send(msgKeyOrParam, paramOrCallback, callback) {
            let param;
            if (typeof msgKeyOrParam === "string") {
                param = { ...(paramOrCallback && typeof paramOrCallback === "object" ? paramOrCallback : {}) };
                param.MsgKey = msgKeyOrParam;
                if (typeof paramOrCallback === "function") callback = paramOrCallback;
            } else {
                param = { ...(msgKeyOrParam || {}) };
                callback = typeof paramOrCallback === "function" ? paramOrCallback : callback;
            }
            return callEngine(runEngine, PLATFORM_NOTIFICATION_ENGINE_KEYS.Send, param, callback);
        },
        List(param, callback) {
            return callEngine(runEngine, PLATFORM_NOTIFICATION_ENGINE_KEYS.List, param, callback);
        },
        MarkRead(idOrParam, callback) {
            const param = typeof idOrParam === "string" ? { Id: idOrParam } : { ...(idOrParam || {}) };
            return callEngine(runEngine, PLATFORM_NOTIFICATION_ENGINE_KEYS.MarkRead, param, callback);
        }
    });
}

export function normalizePlatformNotificationResult(result) {
    const rows = result && result.Code === 1 && Array.isArray(result.Data) ? result.Data : [];
    const dataAppend = result?.DataAppend || {};
    const unread = Number(dataAppend.UnreadCount);
    return {
        rows,
        unreadCount: Number.isFinite(unread)
            ? Math.max(0, unread)
            : rows.filter((item) => Number(item?.IsRead || 0) !== 1).length,
        dataCount: Number(result?.DataCount || rows.length || 0)
    };
}

export function mergePlatformNotification(rows, incoming, limit = 100) {
    const source = Array.isArray(rows) ? rows : [];
    if (!incoming || (!incoming.Id && !incoming.EventId)) return source.slice(0, limit);
    const identity = String(incoming.Id || incoming.EventId);
    return [incoming, ...source.filter((item) => String(item?.Id || item?.EventId || "") !== identity)]
        .slice(0, Math.max(1, Number(limit) || 100));
}

export function normalizeNotificationLink(value, currentOrigin = "") {
    const link = String(value || "").trim();
    if (!link || /^(javascript|data|vbscript):/i.test(link)) return "";
    if ((link.startsWith("/") && !link.startsWith("//")) || link.startsWith("#")) return link;
    try {
        const parsed = new URL(link, currentOrigin || "http://microi.local");
        if (!/^https?:$/i.test(parsed.protocol)) return "";
        return parsed.href;
    } catch (_) {
        return "";
    }
}
