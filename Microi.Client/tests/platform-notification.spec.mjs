import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    AI_ASSISTANT_CONTACT_ID,
    AI_ASSISTANT_CONTACT_NAME,
    LEGACY_PLATFORM_SYSTEM_CONTACT_ID,
    PLATFORM_NOTIFICATION_ENGINE_KEYS,
    createAiAssistantContact,
    createPlatformNotificationApi,
    getPlatformNotificationSender,
    mergePlatformChatRecords,
    mergePlatformNotification,
    normalizeNotificationLink,
    normalizePlatformNotificationResult,
    toPlatformChatRecord
} from "../src/utils/platform-notification.js";

test("frontend V8 notification API maps stable overloads to server engines", async () => {
    const calls = [];
    const api = createPlatformNotificationApi(async (engineKey, param) => {
        calls.push({ engineKey, param });
        return { Code: 1, Data: param };
    });

    let callbackResult = null;
    await api.Send("order_ready", { EventId: "event-1" }, (result) => {
        callbackResult = result;
    });
    await api.Send({ MsgKey: "audit_warning", ReceiverUserIds: ["user-1"] });
    await api.List({ _PageSize: 20 });
    await api.MarkRead("notice-1");
    await api.MarkRead({ All: true });

    assert.deepEqual(calls, [
        { engineKey: PLATFORM_NOTIFICATION_ENGINE_KEYS.Send, param: { EventId: "event-1", MsgKey: "order_ready" } },
        { engineKey: PLATFORM_NOTIFICATION_ENGINE_KEYS.Send, param: { MsgKey: "audit_warning", ReceiverUserIds: ["user-1"] } },
        { engineKey: PLATFORM_NOTIFICATION_ENGINE_KEYS.List, param: { _PageSize: 20 } },
        { engineKey: PLATFORM_NOTIFICATION_ENGINE_KEYS.MarkRead, param: { Id: "notice-1" } },
        { engineKey: PLATFORM_NOTIFICATION_ENGINE_KEYS.MarkRead, param: { All: true } }
    ]);
    assert.equal(callbackResult.Code, 1);
});

test("notification list coalesces one render burst and mutations invalidate it", async () => {
    const calls = [];
    let resolveFirst;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    const api = createPlatformNotificationApi((engineKey, param) => {
        calls.push({ engineKey, param });
        if (engineKey === PLATFORM_NOTIFICATION_ENGINE_KEYS.List && calls.length === 1) return first;
        return Promise.resolve({ Code: 1, Data: [], DataCount: 0, DataAppend: { UnreadCount: 0 } });
    });

    const left = api.List({ _PageSize: 20 });
    const right = api.List({ _PageSize: 20 });
    assert.equal(calls.length, 1);
    resolveFirst({ Code: 1, Data: [{ Id: "notice-1" }], DataCount: 1 });
    assert.deepEqual(await left, await right);

    await api.List({ _PageSize: 20 });
    assert.equal(calls.length, 1, "the short render-burst cache should reuse the completed snapshot");

    await api.MarkRead("notice-1");
    await api.List({ _PageSize: 20 });
    assert.deepEqual(calls.map((item) => item.engineKey), [
        PLATFORM_NOTIFICATION_ENGINE_KEYS.List,
        PLATFORM_NOTIFICATION_ENGINE_KEYS.MarkRead,
        PLATFORM_NOTIFICATION_ENGINE_KEYS.List
    ]);
});

test("notification snapshot keeps server unread count and has a safe fallback", () => {
    assert.deepEqual(normalizePlatformNotificationResult({
        Code: 1,
        Data: [{ Id: "1", IsRead: 0 }, { Id: "2", IsRead: 1 }],
        DataCount: 12,
        DataAppend: { UnreadCount: 7 }
    }), {
        rows: [{ Id: "1", IsRead: 0 }, { Id: "2", IsRead: 1 }],
        unreadCount: 7,
        dataCount: 12
    });

    assert.equal(normalizePlatformNotificationResult({
        Code: 1,
        Data: [{ Id: "1", IsRead: 0 }, { Id: "2", IsRead: 1 }]
    }).unreadCount, 1);
});

test("realtime hints merge by durable notification identity", () => {
    const merged = mergePlatformNotification([
        { Id: "notice-1", Title: "old" },
        { Id: "notice-2", Title: "second" }
    ], { Id: "notice-1", Title: "new" });

    assert.deepEqual(merged, [
        { Id: "notice-1", Title: "new" },
        { Id: "notice-2", Title: "second" }
    ]);
});

test("platform notifications are projected into the single AI assistant conversation", () => {
    const notification = {
        Id: "notice-1",
        EventId: "event-1",
        Title: "平台维护",
        MsgContent: "今晚升级",
        CreateTime: "2026-08-20T21:30:00",
        Payload: JSON.stringify({ SystemSenderAccount: "admin" }),
        IsRead: 0
    };
    const contact = createAiAssistantContact({
        ContactUserId: AI_ASSISTANT_CONTACT_ID,
        LastMessage: "older AI reply",
        UpdateTime: "2026-08-20T20:30:00",
        UnRead: 2
    }, [notification], 3);
    const record = toPlatformChatRecord(notification, { Id: "user-1", Name: "管理员" });

    assert.equal(getPlatformNotificationSender(notification), AI_ASSISTANT_CONTACT_NAME);
    assert.equal(contact.ContactUserId, AI_ASSISTANT_CONTACT_ID);
    assert.equal(contact.ContactUserName, AI_ASSISTANT_CONTACT_NAME);
    assert.equal(contact.LastMessage, "今晚升级");
    assert.equal(contact.UnRead, 5);
    assert.equal(record.FromUserId, AI_ASSISTANT_CONTACT_ID);
    assert.equal(record.FromUserName, AI_ASSISTANT_CONTACT_NAME);
    assert.equal(record.ToUserId, "user-1");
    assert.equal(record.Type, "platform-system");
    assert.match(record.Content, /平台维护\n今晚升级/);
    assert.notEqual(record.FromUserId, LEGACY_PLATFORM_SYSTEM_CONTACT_ID);
});

test("AI chat history and durable platform notifications merge chronologically without duplicates", () => {
    const records = [
        {
            Id: "chat-1",
            FromUserId: "AI",
            Content: "普通 AI 回复",
            CreateTime: "2026-08-20T21:00:00"
        },
        {
            Id: "notice-old-projection",
            NotificationId: "notice-1",
            IsPlatformNotification: true,
            CreateTime: "2026-08-20T21:30:00"
        }
    ];
    const notifications = [
        {
            Id: "notice-2",
            Title: "第二条",
            CreateTime: "2026-08-20T22:00:00"
        },
        {
            Id: "notice-1",
            Title: "第一条",
            CreateTime: "2026-08-20T21:30:00"
        },
        {
            Id: "notice-1",
            Title: "重复项",
            CreateTime: "2026-08-20T21:30:00"
        }
    ];

    const merged = mergePlatformChatRecords(records, notifications, { Id: "user-1" });
    assert.deepEqual(merged.map(item => item.Id), ["chat-1", "notice-1", "notice-2"]);
    assert.equal(merged.filter(item => item.NotificationId === "notice-1").length, 1);
    assert.ok(merged.filter(item => item.IsPlatformNotification)
        .every(item => item.FromUserId === AI_ASSISTANT_CONTACT_ID));
});

test("notification links reject script schemes and keep safe routes", () => {
    assert.equal(normalizeNotificationLink("javascript:alert(1)", "https://microi.example"), "");
    assert.equal(normalizeNotificationLink("data:text/html,x", "https://microi.example"), "");
    assert.equal(normalizeNotificationLink("/mic/orders/1", "https://microi.example"), "/mic/orders/1");
    assert.equal(normalizeNotificationLink("#message", "https://microi.example"), "#message");
    assert.equal(normalizeNotificationLink("https://docs.microi.net/a", "https://microi.example"), "https://docs.microi.net/a");
    assert.equal(normalizeNotificationLink("//evil.example/x", "https://microi.example"), "https://evil.example/x");
});

test("notification center binds the fixed SignalR event and performs authoritative startup readback", () => {
    const component = readFileSync(
        new URL("../src/layout/components/BackgroundTaskCenter.vue", import.meta.url),
        "utf8"
    );
    const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

    assert.match(component, /ws\.on\("ReceivePlatformNotification", this\.handlePlatformNotification\)/);
    assert.match(component, /mounted\(\)\s*\{[\s\S]*?this\.loadPlatformNotifications\(\)/);
    assert.match(component, /DiyCommon\.Notification\.List/);
    assert.match(component, /DiyCommon\.Notification\.MarkRead/);
    assert.match(component, /dispatchPlatformNotificationSnapshot/);
    assert.doesNotMatch(main, /ChatType\s*==\s*"吾码IM"/);
});
