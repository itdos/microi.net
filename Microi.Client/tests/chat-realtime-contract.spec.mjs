import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    buildAiOtherInfo,
    cleanupWebSocketEvents,
    initWebSocketEvents,
    splitTypewriterUnits
} from "../src/utils/chat.common.js";

test("chat listeners can be removed with their original handler references", () => {
    global.window = {};
    const listeners = new Map();
    const removed = [];
    const websocket = {
        on(name, handler) { listeners.set(name, handler); },
        off(name, handler) {
            removed.push({ name, handler });
            if (listeners.get(name) === handler) listeners.delete(name);
        }
    };
    let aiError = "";
    assert.equal(initWebSocketEvents(websocket, {
        onReceiveAIError(message) { aiError = message; }
    }, { scope: "test", logPrefix: "[test]" }), true);

    listeners.get("ReceiveAIError")("model unavailable", "AI", "user-1");
    assert.equal(aiError, "model unavailable");
    cleanupWebSocketEvents(websocket, "[test]", "test");
    assert.equal(listeners.size, 0);
    assert.ok(removed.some(item => item.name === "ReceiveAIChunk"));
    assert.ok(removed.some(item => item.name === "ReceiveAIError"));
});

test("AI selection sends both model key and durable model id", () => {
    assert.deepEqual(JSON.parse(buildAiOtherInfo("AI", {
        Id: "model-id",
        AiModel: "gpt-compatible"
    })), {
        AiModel: "gpt-compatible",
        AiModelId: "model-id"
    });
});

test("AI typewriter keeps markup atomic while revealing Unicode text", () => {
    assert.deepEqual(splitTypewriterUnits("<think>分析🙂</think>答复"), [
        "<think>", "分", "析", "🙂", "</think>", "答", "复"
    ]);
});

test("PC chat has quick contacts, event-driven connection state and visible AI failure", () => {
    const source = readFileSync(new URL("../src/views/chat/index.vue", import.meta.url), "utf8");
    const layout = readFileSync(new URL("../src/views/chat/css/layout.scss", import.meta.url), "utf8");
    assert.match(source, /ContactUserName:\s*"AI助手"/);
    assert.match(source, /createPlatformSystemContact/);
    assert.match(source, /PLATFORM_SYSTEM_CONTACT_ID/);
    assert.match(source, /REALTIME_STATE_EVENT/);
    assert.match(source, /onReceiveAIError/);
    assert.match(source, /AI回复失败/);
    assert.match(source, /isLocalRealtime/);
    assert.match(source, /const localPending = self\.ChatRecord\.filter/);
    assert.match(source, /const merged = incoming\.slice\(\)/);
    assert.match(source, /assistant-robot\.png/);
    assert.match(source, /<Picture \/>/);
    assert.match(source, /class="chat-emoji-glyph"/);
    assert.match(source, /queueAITypewriterChunk/);
    assert.match(source, /completeAITypewriter/);
    assert.match(layout, /width:\s*1120px/);
    assert.match(layout, /\.vc-recordList\s*\{[\s\S]*?overflow-x:\s*hidden !important/);
    assert.match(layout, /\.vc-recordList ul li \.info\s*\{[\s\S]*?min-width:\s*0/);
    assert.doesNotMatch(source, /setTimeout\(checkConnection|每200ms|刷新页面重试/);
});
