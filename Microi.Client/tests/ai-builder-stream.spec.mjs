import assert from "node:assert/strict";
import test from "node:test";
import { consumeBuilderStream, readAiEvents } from "../src/views/ai-engine/ai-builder-stream.js";
import fs from "node:fs";
import { parse, compileScript } from "@vue/compiler-sfc";

const frame = (name, value) => `event: ${name}\ndata: ${typeof value === "string" ? value : JSON.stringify(value)}\n\n`;
const fixture = chunks => new Response(new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk)); c.close(); } }));
const message = () => ({ content: "", rawContent: "", thinking: "正在组织回答...", actions: [] });
const options = { paint: async () => {} };

test("真实分片在响应终结前已经逐步显示模型文本和DDL阶段", async () => {
    let controller;
    const response = new Response(new ReadableStream({ start(c) { controller = c; } }));
    const msg = message(); const painted = [];
    const running = consumeBuilderStream(response, msg, { paint: async () => {}, changed: () => painted.push(msg.content) });
    controller.enqueue(new TextEncoder().encode(frame("message", "先检查当前模块。") + frame("agent", { Sequence: 1, Action: "microi_create_table", CallId: "call-1", State: "started", Message: "表结构创建（DDL）：请求已发出。" })));
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(msg.content, "先检查当前模块。");
    assert.match(msg.thinking, /DDL/);
    assert.equal(msg.actions[0].__loading, true);
    assert.ok(painted.length);
    controller.enqueue(new TextEncoder().encode(frame("agent", { Sequence: 2, Action: "microi_create_table", CallId: "call-1", State: "returned", Message: "工具已返回。" }) + frame("message", "执行完成。") + frame("done", "[DONE]")));
    controller.close(); await running;
    assert.equal(msg.content, "先检查当前模块。执行完成。");
    assert.equal(msg.actions[0].__result.Code, 1);
});

test("参数校验失败保留真实工具与失败回执，不把未执行标记为已执行", async () => {
    const msg = message();
    await assert.rejects(consumeBuilderStream(fixture([
        frame("agent", { Sequence: 1, Action: "microi_add_field", CallId: "c", State: "started", Message: "开始" }),
        frame("receipt", { McpCalls: [{ Action: "microi_add_field", CallId: "c", IsError: true, State: "notExecuted", Message: "PARAMETER_VALIDATION(name:invalid_type)" }] }),
        frame("error", "参数校验未通过，未发起写入。")
    ]), msg, options), /未发起写入/);
    assert.equal(msg.actions.length, 1);
    assert.equal(msg.actions[0].State, "notExecuted");
    assert.equal(msg.actions[0].__result, null);
    assert.equal(msg.actions[0].__uncertain, false);
    assert.match(msg.actions[0].__error, /name/);
});

test("断流保留文本并把实际进行中的工具转为待核对，不重发", async () => {
    const msg = message();
    await assert.rejects(consumeBuilderStream(fixture([
        frame("message", "已收到部分说明"), frame("agent", { Sequence: 1, Action: "microi_create_table", CallId: "c", State: "started", Message: "开始" })
    ]), msg, options), /提前结束/);
    assert.equal(msg.content, "已收到部分说明");
    assert.equal(msg.actions[0].__uncertain, true);
    assert.equal(msg.actions[0].__result, null);
});

test("UTF8逐字节、CRLF及EOF无分隔空行仍完整消费", async () => {
    const bytes = new TextEncoder().encode("event: message\r\ndata: 中文🙂\r\ndata: 第二行");
    const response = new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } }));
    const events = []; await readAiEvents(response, (kind, value) => events.push([kind, value]));
    assert.deepEqual(events, [["message", "中文🙂\n第二行"]]);
});

test("按服务端序列严格消费，重复/倒序不能伪造工具完成", async () => {
    const msg = message();
    await assert.rejects(consumeBuilderStream(fixture([
        frame("agent", { Sequence: 2, Action: "a", State: "started", Message: "阶段" }),
        frame("agent", { Sequence: 2, Action: "a", State: "returned", Message: "伪重复" })
    ]), msg, options), /顺序异常/);
    assert.doesNotMatch(msg.thinking, /伪重复/);
});

test("长响应打字队列有真实多个渲染机会，成功result不重复覆盖", async () => {
    const msg = message(); let paints = 0;
    await consumeBuilderStream(fixture([frame("message", "字".repeat(97)), frame("result", "重复"), frame("done", "[DONE]")]), msg, { paint: async () => { paints++; } });
    assert.equal(msg.content, "字".repeat(97)); assert.equal(paints, 4);
});

test("工作台真实发送函数使用builder SSE与真实Signal，不等待response.json或重发", async () => {
    const source = fs.readFileSync(new URL("../src/views/ai-engine/index.vue", import.meta.url), "utf8");
    const { descriptor } = parse(source);
    const script = compileScript(descriptor, { id: "builder-stream" });
    const fn = script.scriptSetupAst.find(node => node.type === "FunctionDeclaration" && node.id?.name === "sendBuilderChat");
    assert.ok(fn);
    const calls = [];
    const runtime = new Function("DiyCommon", "isRelayStationSelected", "selectedRelayModel", "consumeBuilderStream", "fetch", "scrollToBottom", `let abortController; ${descriptor.scriptSetup.content.slice(fn.start, fn.end)}; return sendBuilderChat;`)(
        { GetApiBase: () => "https://fixture.test", getToken: () => "fixture", GetCurrentLang: () => "zh-CN" }, { value: false }, { value: "" },
        (response, msg, opts) => consumeBuilderStream(response, msg, { ...opts, paint: async () => {} }),
        async (url, init) => { calls.push({ url, init }); return fixture([frame("message", "已完成"), frame("done", "[DONE]")]); }, () => {}
    );
    const msg = message(); await runtime({ Mode: "builder", UserChatMsg: "fixture" }, msg);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/Ai\/ChatStream$/);
    assert.equal(JSON.parse(calls[0].init.body).Mode, "builder");
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.equal(msg.content, "已完成");
});
