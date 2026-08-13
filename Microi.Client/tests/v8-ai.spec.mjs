import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createV8AI } from "../src/utils/v8-ai.js";

test("AI 视频工作区按画质优先规格创建 VideoClip，并要求合成唯一带对白母版", () => {
    const source = fs.readFileSync(new URL("../src/views/ai-engine/index.vue", import.meta.url), "utf8");

    assert.match(source, /画质优先 · 6 秒 \/ 1080P \/ fps 实测/);
    assert.match(source, /10 秒 \/ 768P 是时长优先的另一种取舍/);
    assert.match(source, /AssetType: "VideoClip"/);
    assert.match(source, /"VideoClip", "VideoMaster", "Video"/);
    assert.match(source, /分镜不得单独发布/);
    assert.doesNotMatch(source, /todayCount >= 3/);
    assert.match(source, /preset: "quality-first"/);
    assert.doesNotMatch(source, /preset: "duration"/);
});

test("V8.AI.Chat 固定走平台接口并清除伪造身份与密钥", async () => {
    let captured;
    const ai = createV8AI({
        http: {
            Post: async (param) => {
                captured = param;
                return JSON.stringify({ Code: 1, Data: "ok", Msg: "" });
            }
        }
    });

    const result = await ai.Chat({
        UserChatMsg: "你好",
        AiModel: "model-a",
        OsClient: "forged-tenant",
        CurrentUserId: "forged-user",
        ApiKey: "secret",
        Endpoint: "https://evil.example",
        ServerInternalCall: true,
        source: "ai-intent-router",
        apiKey: "lowercase-secret",
        authorization: "Bearer forged"
    });

    assert.equal(result.Code, 1);
    assert.equal(captured.Url, "/api/Ai/Chat");
    assert.equal(captured.ParamType, "json");
    assert.deepEqual(captured.PostParam, {
        UserChatMsg: "你好",
        AiModel: "model-a"
    });
});

test("V8.AI.ChatGet 支持 GET 且仍由宿主注入鉴权", async () => {
    let captured;
    const ai = createV8AI({
        http: {
            Get: async (param) => {
                captured = param;
                return JSON.stringify({ Code: 1, Data: "ok", Msg: "" });
            }
        }
    });

    const result = await ai.ChatGet({ UserChatMsg: "你好", AiModel: "model-a" });

    assert.equal(result.Code, 1);
    assert.equal(captured.Url, "/api/Ai/Chat");
    assert.equal(captured.GetParam.UserChatMsg, "你好");
});

test("V8.AI MiniMax 视频方法固定走平台接口并清除伪造密钥", async () => {
    const calls = [];
    const getCalls = [];
    const ai = createV8AI({
        http: {
            Get: async (param) => {
                getCalls.push(param);
                return JSON.stringify({ Code: 1, Data: {}, Msg: "" });
            },
            Post: async (param) => {
                calls.push(param);
                return JSON.stringify({ Code: 1, Data: {}, Msg: "" });
            }
        }
    });

    await ai.CreateMiniMaxVideo({ Prompt: "办公室协作", ApiKey: "forged", OsClient: "forged" });
    await ai.GetMiniMaxTokenPlanRemains({ ApiKey: "forged", Authorization: "Bearer forged", OsClient: "forged" });
    await ai.GetMiniMaxVideoTask({ TaskHandle: "signed-task" });
    await ai.GetMiniMaxVideoFile({ FileHandle: "signed-file" });
    await ai.PersistMiniMaxVideoFile({ FileHandle: "signed-file", ApiKey: "forged" });
    await ai.GenerateMiniMaxMusic({ RequestId: "music:test", Prompt: "企业科技感纯音乐", ApiKey: "forged" });
    await ai.GenerateMiniMaxSpeech({ RequestId: "speech:test:female", Text: "我找到问题了。", Speaker: "female", ApiKey: "forged" });

    assert.deepEqual(calls.map((item) => item.Url), [
        "/api/Ai/CreateMiniMaxVideo",
        "/api/Ai/GetMiniMaxVideoTask",
        "/api/Ai/GetMiniMaxVideoFile",
        "/api/Ai/PersistMiniMaxVideoFile",
        "/api/Ai/GenerateMiniMaxMusic",
        "/api/Ai/GenerateMiniMaxSpeech"
    ]);
    assert.deepEqual(getCalls, [{ Url: "/api/Ai/GetMiniMaxTokenPlanRemains", GetParam: {} }]);
    assert.deepEqual(calls[0].PostParam, { Prompt: "办公室协作" });
    assert.equal(ai.CreateMiniMaxVideoAsync, ai.CreateMiniMaxVideo);
    assert.equal(ai.GetMiniMaxTokenPlanRemainsAsync, ai.GetMiniMaxTokenPlanRemains);
    assert.equal(ai.GetMiniMaxVideoTaskAsync, ai.GetMiniMaxVideoTask);
    assert.equal(ai.GetMiniMaxVideoFileAsync, ai.GetMiniMaxVideoFile);
    assert.equal(ai.PersistMiniMaxVideoFileAsync, ai.PersistMiniMaxVideoFile);
    assert.equal(ai.GenerateMiniMaxMusicAsync, ai.GenerateMiniMaxMusic);
    assert.equal(ai.GenerateMiniMaxSpeechAsync, ai.GenerateMiniMaxSpeech);
    assert.deepEqual(calls[3].PostParam, { FileHandle: "signed-file" });
});

test("V8.AI.ChatStream 解析 SSE 打字机分片、最终结果并回收新 Token", async () => {
    const encoder = new TextEncoder();
    const chunks = [
        "event: message\ndata: 你\n\n",
        "event: message\ndata: 好\n\n",
        "event: result\ndata: {\"Answer\":\"你好\"}\n\n",
        "event: done\ndata: [DONE]\n\n"
    ];
    let capturedUrl = "";
    let capturedInit;
    let rotatedToken = "";
    const ai = createV8AI({
        http: {},
        getApiBase: () => "https://microi.test/",
        getPlatformContext: () => ({
            headers: { authorization: "Bearer old-token", did: "MCP:test" },
            requestToken: "old-token"
        }),
        onPlatformResponse: (headers) => { rotatedToken = headers.authorization; },
        fetchAdapter: async (url, init) => {
            capturedUrl = url;
            capturedInit = init;
            return new Response(new ReadableStream({
                start(controller) {
                    chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
                    controller.close();
                }
            }), {
                status: 200,
                headers: { authorization: "new-token", "Content-Type": "text/event-stream" }
            });
        }
    });
    const received = [];

    const result = await ai.ChatStream(
        {
            UserChatMsg: "你好",
            AiModel: "model-a",
            Authorization: "Bearer forged",
            OsClient: "forged"
        },
        (chunk) => { received.push(chunk); });

    assert.equal(capturedUrl, "https://microi.test/api/Ai/ChatStream");
    assert.equal(capturedInit.headers.authorization, "Bearer old-token");
    assert.equal(JSON.parse(capturedInit.body).OsClient, undefined);
    assert.deepEqual(received, ["你", "好"]);
    assert.deepEqual(result, { Code: 1, Data: { Answer: "你好" }, Msg: "" });
    assert.equal(rotatedToken, "new-token");
});
