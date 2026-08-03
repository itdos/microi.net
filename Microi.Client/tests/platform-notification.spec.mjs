import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    PLATFORM_NOTIFICATION_ENGINE_KEYS,
    createPlatformNotificationApi,
    mergePlatformNotification,
    normalizeNotificationLink,
    normalizePlatformNotificationResult
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
    assert.doesNotMatch(main, /ChatType\s*==\s*"吾码IM"/);
});
