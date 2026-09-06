import assert from "node:assert/strict";
import test from "node:test";
import { generateMiniMaxImage } from "../src/views/ai-engine/minimax-image-task.js";

const diy = { GetApiBase: () => "https://api.example.test", getToken: () => "unit-test-token",
    GetDid: () => "unit-device", GetOsClient: () => "unit-tenant" };
const input = { RequestId: "image:test-001", Prompt: "A blue ceramic vase", Model: "image-01" };
const pending = { Code: 2, Data: { TaskId: "task-1", Status: "Running" } };
const complete = { Code: 1, Data: { TaskId: "task-1", Status: "Succeeded", Images: [{ FilePath: "/image.jpg" }] } };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

test("one submission is followed only by status queries until the image is persisted", async () => {
    const calls = [];
    const result = await generateMiniMaxImage({ diy, request: input, pollIntervalMs: 1,
        fetchImpl: async (url, options) => { calls.push([url, options.method]); return reply(calls.length < 3 ? pending : complete); } });
    assert.equal(result.Images[0].FilePath, "/image.jpg");
    assert.deepEqual(calls.map(x => x[1]), ["POST", "GET", "GET"]);
    assert.match(calls[1][0], /GetMiniMaxImageTask\?taskId=task-1$/);
});

test("a lost submission response retries byte-identical input and does not mint a new RequestId", async () => {
    const bodies = [];
    let calls = 0;
    await generateMiniMaxImage({ diy, request: input, pollIntervalMs: 1,
        fetchImpl: async (_url, options) => {
            calls += 1;
            if (options.method === "POST") bodies.push(options.body);
            if (calls === 1) throw new TypeError("lost response after enqueue");
            return reply(calls === 2 ? pending : complete);
        } });
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
    assert.equal(JSON.parse(bodies[1]).RequestId, input.RequestId);
});

test("an explicit upstream refusal is terminal and its diagnostic is shown", async () => {
    let calls = 0;
    await assert.rejects(generateMiniMaxImage({ diy, request: input, pollIntervalMs: 1,
        fetchImpl: async () => reply(++calls === 1 ? pending : {
            Code: 0, Data: { TaskId: "task-1", Status: "Failed", UpstreamCode: 1004 }, Msg: "MiniMax 返回错误（1004）：验证失败"
        }) }), /1004/);
    assert.equal(calls, 2);
});

test("an uncertain generation is never resubmitted", async () => {
    let calls = 0;
    await assert.rejects(generateMiniMaxImage({ diy, request: input, pollIntervalMs: 1,
        fetchImpl: async () => { calls += 1; return reply({ Code: 0, Data: { Status: "Uncertain" }, Msg: "结果不确定" }); }
    }), /结果不确定/);
    assert.equal(calls, 1);
});

test("cancelled UI waiting can resume by TaskId without another generation", async () => {
    const controller = new AbortController();
    const methods = [];
    await assert.rejects(generateMiniMaxImage({ diy, request: input, signal: controller.signal,
        onProgress: () => controller.abort(), fetchImpl: async (_url, options) => { methods.push(options.method); return reply(pending); }
    }), { name: "AbortError" });
    const result = await generateMiniMaxImage({ diy, taskId: "task-1",
        fetchImpl: async (_url, options) => { methods.push(options.method); return reply(complete); } });
    assert.equal(result.Images.length, 1);
    assert.deepEqual(methods, ["POST", "GET"]);
});

test("a transient status gateway error retries the same GET and preserves the original submission", async () => {
    const calls = [];
    await generateMiniMaxImage({ diy, request: input, pollIntervalMs: 1,
        fetchImpl: async (_url, options) => { calls.push(options.method); return calls.length === 2 ? reply({}, 524) : reply(calls.length === 1 ? pending : complete); }
    });
    assert.deepEqual(calls, ["POST", "GET", "GET"]);
});

test("explicit result recovery posts only the existing TaskId then polls without generation input", async () => {
    const calls = [];
    const result = await generateMiniMaxImage({ diy, taskId: "task-1", recoverResult: true, pollIntervalMs: 1,
        fetchImpl: async (url, options) => { calls.push({url, ...options}); return reply(calls.length === 1 ? pending : complete); } });
    assert.equal(result.Images.length, 1);
    assert.match(calls[0].url, /RecoverMiniMaxImageTask\?taskId=task-1$/);
    assert.equal(calls[0].body, undefined);
    assert.deepEqual(calls.map(x => x.method), ["POST", "GET"]);
    assert.ok(calls.every(x => !x.url.includes("/GenerateMiniMaxImage")));
});

test("a recoverable download failure exposes recovery state without automatically calling recovery", async () => {
    let calls = 0;
    await assert.rejects(generateMiniMaxImage({ diy, taskId: "task-1", fetchImpl: async () => {
        calls++; return reply({Code: 0, Data: {Status: "Failed", TaskId: "task-1", CanRecoverResult: true}, Msg: "下载失败"});
    }}), error => error.canRecoverResult === true && error.taskId === "task-1");
    assert.equal(calls, 1);
});
