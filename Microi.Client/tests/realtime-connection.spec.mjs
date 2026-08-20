import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    REALTIME_RETRY_DELAYS_MS,
    buildRealtimeHubUrl,
    getRealtimeRetryDelay,
    getRealtimeStatusText
} from "../src/utils/realtime-connection.js";

test("SignalR automatic reconnect uses a bounded backoff", () => {
    assert.deepEqual([...REALTIME_RETRY_DELAYS_MS], [0, 2000, 5000, 10000, 30000]);
    REALTIME_RETRY_DELAYS_MS.forEach((delay, previousRetryCount) => {
        assert.equal(getRealtimeRetryDelay({ previousRetryCount }), delay);
    });
    assert.equal(getRealtimeRetryDelay({ previousRetryCount: REALTIME_RETRY_DELAYS_MS.length }), null);
    assert.match(getRealtimeStatusText("Exhausted"), /已暂停/);
});

test("hub URL carries the explicit tenant and device identity", () => {
    const url = new URL(buildRealtimeHubUrl(
        "https://api.example.com/",
        "lx wb",
        "device/1"
    ));
    assert.equal(url.pathname, "/diy-websocket");
    assert.equal(url.searchParams.get("OsClient"), "lx wb");
    assert.equal(url.searchParams.get("DeviceClientId"), "device/1");
});

test("main connection reads a fresh token and exposes all visible states", () => {
    const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
    const navbar = readFileSync(
        new URL("../src/layout/components/Navbar.vue", import.meta.url),
        "utf8"
    );

    assert.match(source, /accessTokenFactory:\s*\(\)\s*=>\s*DiyCommon\.getToken\(\)/);
    assert.match(source, /withAutomaticReconnect\([\s\S]*?getRealtimeRetryDelay/);
    assert.match(source, /buildRealtimeHubUrl\(identity\.apiBase, identity\.osClient/);
    assert.match(source, /__microiIdentityKey/);
    assert.match(navbar, /RealtimeStatusText/);
    assert.match(navbar, /chat-realtime-indicator__dot/);
});
