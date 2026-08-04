import assert from "node:assert/strict";
import test from "node:test";
import { createV8AI } from "../src/utils/v8-ai.js";

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
