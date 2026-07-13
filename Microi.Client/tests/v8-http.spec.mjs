import assert from "node:assert/strict";
import test from "node:test";
import { createV8Http } from "../src/utils/v8-http.js";

function createMock(response, calls) {
    return async function request(option) {
        calls.push(option);
        return typeof response === "function" ? response(option) : response;
    };
}

test("V8.Http.Post 使用后端同构 JSON 参数并返回字符串", async () => {
    const calls = [];
    const http = createV8Http({
        requestAdapter: createMock({ data: '{"Code":1}', status: 200, headers: {} }, calls),
        getApiBase: () => "https://api.example.com",
        getPlatformContext: () => ({ headers: { authorization: "Bearer old", lang: "zh-CN" }, requestToken: "old" })
    });

    const result = await http.Post({
        Url: "/api/test",
        PostParamString: JSON.stringify({ user: { name: "张三" } }),
        ParamType: "json",
        Timeout: 8,
        Headers: { "X-Test": "1" }
    });

    assert.equal(result, '{"Code":1}');
    assert.equal(calls[0].url, "https://api.example.com/api/test");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].data, '{"user":{"name":"张三"}}');
    assert.equal(calls[0].timeout, 8000);
    assert.equal(calls[0].headers.authorization, "Bearer old");
    assert.equal(calls[0].headers["Content-Type"], "application/json");
});

test("V8.Http.Patch 使用 PatchParam 且默认发送 form", async () => {
    const calls = [];
    const http = createV8Http({
        requestAdapter: createMock({ data: "ok", status: 200, headers: {} }, calls),
        getApiBase: () => "https://api.example.com"
    });

    assert.equal(await http.Patch({
        Url: "/users/1",
        GetParam: { notify: 1 },
        PatchParam: { Name: "李四", Tags: ["a", "b"] }
    }), "ok");
    assert.equal(calls[0].method, "PATCH");
    assert.deepEqual(calls[0].params, { notify: 1 });
    assert.equal(calls[0].data.toString(), "Name=%E6%9D%8E%E5%9B%9B&Tags=a&Tags=b");
    assert.match(calls[0].headers["Content-Type"], /^application\/x-www-form-urlencoded/);
    assert.equal(calls[0].timeout, 600000);
});

test("V8.Http.Get 使用 GetParam", async () => {
    const calls = [];
    const http = createV8Http({
        requestAdapter: createMock({ data: "[]", status: 200, headers: {} }, calls),
        getApiBase: () => "https://api.example.com"
    });

    assert.equal(await http.Get({ Url: "/users", GetParam: { page: 2 } }), "[]");
    assert.deepEqual(calls[0].params, { page: 2 });
    assert.equal(calls[0].data, undefined);
});

test("Response 方法返回 Content、Headers、StatusCode 与 RawBytes", async () => {
    const calls = [];
    const http = createV8Http({
        requestAdapter: createMock({
            data: new TextEncoder().encode('{"Code":0}').buffer,
            status: 422,
            headers: { "content-type": "application/json", "x-trace-id": "trace-1" }
        }, calls),
        getApiBase: () => "https://api.example.com"
    });

    const response = await http.PatchResponse({
        Url: "/users/1",
        PatchParam: { Name: "王五" },
        ParamType: "json"
    });

    assert.equal(response.StatusCode, 422);
    assert.equal(response.Content, '{"Code":0}');
    assert.equal(response.RawBytes instanceof Uint8Array, true);
    assert.equal(response.Headers.find((item) => item.Name === "x-trace-id").Value, "trace-1");
});

test("外部绝对地址不会自动携带吾码登录头", async () => {
    const calls = [];
    const http = createV8Http({
        requestAdapter: createMock({ data: "ok", status: 200, headers: {} }, calls),
        getApiBase: () => "https://api.example.com",
        getPlatformContext: () => ({ headers: { authorization: "Bearer secret", did: "device" } })
    });

    await http.Get({ Url: "https://third-party.example.net/data", Headers: { "X-Api-Key": "key" } });
    assert.equal(calls[0].headers.authorization, undefined);
    assert.equal(calls[0].headers.did, undefined);
    assert.equal(calls[0].headers["X-Api-Key"], "key");
});
