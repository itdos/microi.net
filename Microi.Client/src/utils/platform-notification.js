export const PLATFORM_NOTIFICATION_ENGINE_KEYS = Object.freeze({
    Send: "msg_event",
    List: "msg_internal_list",
    MarkRead: "msg_internal_mark_read"
});

export const AI_ASSISTANT_CONTACT_ID = "AI";
export const AI_ASSISTANT_CONTACT_NAME = "AI助手";
export const AI_ASSISTANT_CONTACT_AVATAR = "/static/mci/ai/assistant-robot.png";
export const LEGACY_PLATFORM_SYSTEM_CONTACT_ID = "MICROI_PLATFORM_ADMIN";
export const PLATFORM_NOTIFICATION_EVENT = "microi-platform-notification";
export const PLATFORM_NOTIFICATION_SNAPSHOT_EVENT = "microi-platform-notifications-snapshot";

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

export function getPlatformNotificationSender() {
    return AI_ASSISTANT_CONTACT_NAME;
}

export function toPlatformChatRecord(notification, currentUser = {}) {
    const title = String(notification?.Title || "平台消息").trim();
    const content = String(notification?.MsgContent || notification?.Content || "").trim();
    return {
        Id: String(notification?.Id || notification?.EventId || ""),
        NotificationId: String(notification?.Id || ""),
        EventId: String(notification?.EventId || ""),
        FromUserId: AI_ASSISTANT_CONTACT_ID,
        FromUserName: AI_ASSISTANT_CONTACT_NAME,
        FromUserAccount: AI_ASSISTANT_CONTACT_ID,
        FromUserAvatar: AI_ASSISTANT_CONTACT_AVATAR,
        ToUserId: String(currentUser?.Id || ""),
        ToUserName: String(currentUser?.Name || currentUser?.Account || ""),
        Content: title && content && title !== content ? `${title}\n${content}` : (content || title),
        CreateTime: notification?.CreateTime || new Date().toISOString(),
        Type: "platform-system",
        IsRead: Number(notification?.IsRead || 0) === 1,
        IsPlatformNotification: true,
        LinkUrl: String(notification?.LinkUrl || "")
    };
}

function toTimestamp(value) {
    const timestamp = Date.parse(String(value || ""));
    return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergePlatformChatRecords(chatRecords = [], rows = [], currentUser = {}) {
    const ordinaryRecords = (Array.isArray(chatRecords) ? chatRecords : [])
        .filter(item => !item?.IsPlatformNotification);
    const notificationRecords = (Array.isArray(rows) ? rows : [])
        .map(item => toPlatformChatRecord(item, currentUser));
    const notificationIds = new Set();
    const merged = ordinaryRecords.concat(notificationRecords.filter(item => {
        const identity = String(item.NotificationId || item.EventId || item.Id || "");
        if (!identity || notificationIds.has(identity)) return false;
        notificationIds.add(identity);
        return true;
    }));
    return merged
        .map((item, index) => ({ item, index }))
        .sort((left, right) => {
            const timeDelta = toTimestamp(left.item?.CreateTime) - toTimestamp(right.item?.CreateTime);
            return timeDelta || left.index - right.index;
        })
        .map(entry => entry.item);
}

export function createAiAssistantContact(existingContact = {}, rows = [], unreadCount = 0) {
    const latest = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    const chatUpdateTime = existingContact?.UpdateTime || "";
    const notificationUpdateTime = latest?.CreateTime || "";
    const notificationIsLatest = toTimestamp(notificationUpdateTime) > toTimestamp(chatUpdateTime);
    return {
        ...(existingContact || {}),
        ContactId: AI_ASSISTANT_CONTACT_ID,
        ContactUserId: AI_ASSISTANT_CONTACT_ID,
        ContactUserName: AI_ASSISTANT_CONTACT_NAME,
        ContactUserAvatar: AI_ASSISTANT_CONTACT_AVATAR,
        LastMessage: notificationIsLatest
            ? (latest?.MsgContent || latest?.Content || latest?.Title || "平台消息")
            : (existingContact?.LastMessage || "点击开始与AI助手聊天"),
        UpdateTime: notificationIsLatest ? notificationUpdateTime : chatUpdateTime,
        UnRead: Math.max(0, Number(existingContact?.UnRead || 0))
            + Math.max(0, Number(unreadCount || 0)),
        IncludesPlatformNotifications: true
    };
}

function dispatchPlatformEvent(eventName, detail, target) {
    const eventTarget = target || (typeof window !== "undefined" ? window : null);
    if (!eventTarget || typeof eventTarget.dispatchEvent !== "function") return;
    if (typeof CustomEvent === "function") {
        eventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
        return;
    }
    if (typeof document !== "undefined" && document.createEvent) {
        const event = document.createEvent("CustomEvent");
        event.initCustomEvent(eventName, false, false, detail);
        eventTarget.dispatchEvent(event);
    }
}

export function dispatchPlatformNotification(notification, target) {
    dispatchPlatformEvent(PLATFORM_NOTIFICATION_EVENT, notification || {}, target);
}

export function dispatchPlatformNotificationSnapshot(rows, unreadCount, target) {
    dispatchPlatformEvent(PLATFORM_NOTIFICATION_SNAPSHOT_EVENT, {
        rows: Array.isArray(rows) ? rows : [],
        unreadCount: Math.max(0, Number(unreadCount || 0))
    }, target);
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
