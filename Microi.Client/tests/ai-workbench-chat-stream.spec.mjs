import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parse, compileScript } from "@vue/compiler-sfc";

const source = fs.readFileSync(new URL("../src/views/ai-engine/index.vue", import.meta.url), "utf8");
const { descriptor, errors } = parse(source, { filename: "ai-engine/index.vue" });
assert.deepEqual(errors, []);
const script = compileScript(descriptor, { id: "ai-workbench-chat-stream-regression" });
const testedFunctions = [
    "sendChatQuestion", "sendChatStream", "readChatSse", "applyStreamText",
    "splitThinkingText", "normalizeAiText", "cancelRequest"
];
// 按 SFC 的真实 AST 提取原始函数正文；仅替换网络和宿主状态，避免测试另一份聊天实现。
const closure = testedFunctions.map(name => {
    const declaration = script.scriptSetupAst.find(node => node.type === "FunctionDeclaration" && node.id?.name === name);
    assert.ok(declaration, `工作台缺少 ${name}`);
    return descriptor.scriptSetup.content.slice(declaration.start, declaration.end);
}).join("\n");

function message() {
    return { content: "", rawContent: "", thinking: "正在组织回答...", streaming: true };
}

function responseFromChunks(chunks) {
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
            controller.close();
        }
    }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function fixture(response = responseFromChunks(["event: message\ndata: 你好\n\n", "event: done\ndata: [DONE]\n\n"])) {
    const calls = [];
    const rendered = [];
    const state = {
        DiyCommon: {
            GetApiBase: () => "https://api.example.test",
            getToken: () => "fixture-token",
            GetCurrentLang: () => "zh-CN"
        },
        selectedRuntimeModelId: { value: "MiniMax-M3" },
        selectedAiModel: { value: { Id: "model-record" } },
        isRelayStationSelected: { value: false },
        selectedRelayModel: { value: "relay-model" },
        osClient: { value: "test-tenant" },
        currentConversationId: { value: "conversation-1" },
        effectiveReasoningEffort: { value: "medium" },
        sending: { value: true },
        SOURCE: "ai-engine-workbench",
        buildSystemPrompt: () => "fixture system prompt",
        scrollToBottom: () => rendered.push(true),
        fetch: async (url, init) => {
            calls.push({ url, init });
            return typeof response === "function" ? response(init) : response;
        }
    };
    const runtime = new Function(...Object.keys(state), `"use strict";\nlet abortController = null;\n${closure}\nreturn { ${testedFunctions.join(", ")} };`)(...Object.values(state));
    return { ...runtime, state, calls, rendered };
}

test("真实工作台普通对话消费 SSE 并显示回答，不依赖未声明的 options", async () => {
    const f = fixture();
    const assistant = message();
    const attachments = [{ FileName: "report.txt", Text: "fixture attachment" }];
    await f.sendChatQuestion("你好", assistant, attachments);
    assert.equal(assistant.content, "你好");
    assert.equal(assistant.rawContent, "你好");
    assert.equal(assistant.thinking, "");
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].url, "https://api.example.test/api/Ai/ChatStream");
    assert.equal(f.calls[0].init.method, "POST");
    assert.equal(f.calls[0].init.headers.authorization, "Bearer fixture-token");
    assert.ok(f.calls[0].init.signal instanceof AbortSignal);
    const payload = JSON.parse(f.calls[0].init.body);
    assert.equal(payload.AiModel, "MiniMax-M3");
    assert.equal(payload.AiModelId, "model-record");
    assert.equal(payload.OsClient, "test-tenant");
    assert.equal(payload.ConversationId, "conversation-1");
    assert.equal(payload.Source, "ai-engine-workbench");
    assert.equal(payload.Mode, "chat");
    assert.equal(payload.ReasoningEffort, "medium");
    assert.equal(payload.RelayModel, "");
    assert.deepEqual(payload.Attachments, attachments);
    assert.ok(f.rendered.length > 0);
});

test("工作台中转对话仍使用选定的运行模型与中转模型", async () => {
    const f = fixture();
    f.state.isRelayStationSelected.value = true;
    await f.sendChatQuestion("你好", message());
    assert.equal(JSON.parse(f.calls[0].init.body).RelayModel, "relay-model");
});

test("工作台消费 UTF-8 逐字节和 CRLF 跨块 SSE，不丢中文或多行数据", async () => {
    const bytes = new TextEncoder().encode("event: message\r\ndata: 你好\r\ndata: 第二行\r\n\r\nevent: done\r\ndata: [DONE]\r\n\r\n");
    const f = fixture(responseFromChunks(Array.from(bytes, byte => Uint8Array.of(byte))));
    const assistant = message();
    await f.sendChatQuestion("你好", assistant);
    assert.equal(assistant.content, "你好\n第二行");
    assert.equal(assistant.rawContent, "你好\n第二行");
});

test("工作台只收到 result 时兼容历史 JSON 字符串最终回答", async () => {
    const f = fixture(responseFromChunks(["event: result\ndata: \"历史回答\"\n\n", "event: done\ndata: [DONE]\n\n"]));
    const assistant = message();
    await f.sendChatQuestion("你好", assistant);
    assert.equal(assistant.content, "历史回答");
});

test("工作台显示真实增量且不让重复 result 覆盖已经消费的回答", async () => {
    const f = fixture(responseFromChunks([
        "event: message\ndata: <think>分析\n\n",
        "event: message\ndata: 完毕</think>\n\n",
        "event: message\ndata: 最终回答\n\n",
        "event: result\ndata: \"重复最终回答\"\n\n"
    ]));
    const assistant = message();
    await f.sendChatQuestion("你好", assistant);
    assert.equal(assistant.thinking, "分析完毕");
    assert.equal(assistant.content, "最终回答");
    assert.equal(assistant.rawContent, "<think>分析完毕</think>最终回答");
});

test("工作台 SSE error 拒绝请求并保留已收到的部分回答", async () => {
    const f = fixture(responseFromChunks(["event: message\ndata: 部分回答\n\n", "event: error\ndata: 模型额度不足\n\n"]));
    const assistant = message();
    await assert.rejects(f.sendChatQuestion("你好", assistant), /模型额度不足/);
    assert.equal(assistant.rawContent, "部分回答");
});

test("工作台 HTTP 失败保留明确状态，不冒充正常回答", async () => {
    const f = fixture(new Response("upstream failed", { status: 503, statusText: "Service Unavailable" }));
    const assistant = message();
    await assert.rejects(f.sendChatQuestion("你好", assistant), /HTTP 503: Service Unavailable/);
    assert.equal(assistant.rawContent, "");
    assert.equal(f.rendered.length, 0);
});

test("工作台网络失败不重发供应商调用", async () => {
    const f = fixture(() => { throw new TypeError("Failed to fetch"); });
    await assert.rejects(f.sendChatQuestion("你好", message()), /Failed to fetch/);
    assert.equal(f.calls.length, 1);
});

test("工作台停止按钮取消实际 fetch Signal，流读取抛出 AbortError", async () => {
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    const f = fixture(init => new Response(new ReadableStream({
        start(controller) {
            init.signal.addEventListener("abort", () => controller.error(new DOMException("已取消", "AbortError")), { once: true });
            started();
        }
    }), { status: 200 }));
    const request = f.sendChatQuestion("你好", message());
    const rejection = assert.rejects(request, error => error.name === "AbortError");
    await ready;
    f.cancelRequest();
    await rejection;
    assert.equal(f.calls[0].init.signal.aborted, true);
    assert.equal(f.state.sending.value, false);
    assert.equal(f.calls.length, 1);
});

test("工作台兼容无可读流的历史文本响应", async () => {
    const f = fixture({ ok: true, body: null, text: async () => "历史文本回答" });
    const assistant = message();
    await f.sendChatQuestion("你好", assistant);
    assert.equal(assistant.content, "历史文本回答");
});
