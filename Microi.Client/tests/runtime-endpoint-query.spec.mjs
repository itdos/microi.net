import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    getRuntimeEndpointQuery,
    normalizeRuntimeApiBase,
    normalizeRuntimeOsClient,
    publishRuntimeEndpointContext,
    RUNTIME_ENDPOINT_PROTOCOL
} from "../src/utils/runtime-endpoint-query.js";

test("URL ApiBase and OsClient overrides are decoded and normalized", function () {
    const query = getRuntimeEndpointQuery(
        "?OsClient=junchi&ApiBase=https%3A%2F%2Fapi.chongstech.com%2Fv2%2F"
    );

    assert.deepEqual(query, {
        apiBase: { present: true, value: "https://api.chongstech.com/v2" },
        osClient: { present: true, value: "junchi" }
    });
    assert.equal(normalizeRuntimeApiBase("http://localhost:61501/"), "http://localhost:61501");
    assert.equal(normalizeRuntimeOsClient(" iTdos "), "iTdos");
    assert.equal(
        getRuntimeEndpointQuery("?OsClient=iTdos&ApiBase=https://api.example.com").apiBase.value,
        "https://api.example.com"
    );
});

test("query names are case-insensitive but conflicting duplicates fail closed", function () {
    assert.deepEqual(getRuntimeEndpointQuery("?osclient=iTdos&apibase=https://api.example.com"), {
        apiBase: { present: true, value: "https://api.example.com" },
        osClient: { present: true, value: "iTdos" }
    });
    assert.throws(
        () => getRuntimeEndpointQuery("?ApiBase=https://api.a.example&apibase=https://api.b.example"),
        /互相冲突的 ApiBase/
    );
    assert.throws(() => getRuntimeEndpointQuery("?OsClient="), /OsClient 不能为空/);
});

test("unsafe endpoint overrides are rejected instead of silently selecting another server", function () {
    assert.throws(() => getRuntimeEndpointQuery("?ApiBase=javascript%3Aalert(1)"), /只允许 http/);
    assert.throws(() => getRuntimeEndpointQuery("?ApiBase=https%3A%2F%2Fuser%3Apwd%40api.example.com"), /用户名或密码/);
    assert.throws(() => getRuntimeEndpointQuery("?ApiBase=https%3A%2F%2Fapi.example.com%3Fx%3D1"), /query 或 hash/);
    assert.throws(() => getRuntimeEndpointQuery("?OsClient=tenant%20two"), /非法字符/);
});

test("the public runtime endpoint context exposes no token and preserves query priority", function (t) {
    const originalWindow = globalThis.window;
    const originalCustomEvent = globalThis.CustomEvent;
    const events = [];
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, options) {
            this.type = type;
            this.detail = options?.detail;
        }
    };
    globalThis.window = {
        location: {
            origin: "http://localhost:61500",
            search: "?OsClient=junchi&ApiBase=https%3A%2F%2Fapi.chongstech.com"
        },
        dispatchEvent(event) {
            events.push(event);
            return true;
        }
    };
    t.after(() => {
        globalThis.window = originalWindow;
        globalThis.CustomEvent = originalCustomEvent;
    });

    const context = publishRuntimeEndpointContext({
        apiBase: "https://api.from-config.example",
        osClient: "from-config"
    });

    assert.equal(context.protocol, RUNTIME_ENDPOINT_PROTOCOL);
    assert.equal(context.apiBase, "https://api.chongstech.com");
    assert.equal(context.osClient, "junchi");
    assert.deepEqual(context.queryOverrides, { apiBase: true, osClient: true });
    assert.equal(context.requiresIsolatedContextForParallelTenants, true);
    assert.equal("token" in context, false);
    assert.equal(window.__MICROI_RUNTIME_ENDPOINT__, context);
    assert.equal(events[0]?.type, "microi:runtime-endpoint-ready");
});

test("both frontend routing entry points read URL overrides before globals, config and storage", async function () {
    const [diyCommon, diyOsClient] = await Promise.all([
        readFile(new URL("../src/utils/diy.common.js", import.meta.url), "utf8"),
        readFile(new URL("../src/utils/itdos.osclient.js", import.meta.url), "utf8")
    ]);

    const diyApiGetter = diyCommon.slice(
        diyCommon.indexOf("GetApiBase: function ()"),
        diyCommon.indexOf("IsNull: function", diyCommon.indexOf("GetApiBase: function ()"))
    );
    assert.ok(diyApiGetter.indexOf("getRuntimeEndpointQuery()") < diyApiGetter.indexOf('getRuntimeWindowValue("ApiBase")'));
    assert.ok(diyApiGetter.indexOf('getRuntimeWindowValue("ApiBase")') < diyApiGetter.indexOf("config.ApiBaseDev"));

    const diyTenantGetter = diyCommon.slice(
        diyCommon.indexOf("GetOsClient()"),
        diyCommon.indexOf("GetClientType()", diyCommon.indexOf("GetOsClient()"))
    );
    assert.ok(diyTenantGetter.indexOf("getRuntimeEndpointQuery()") < diyTenantGetter.indexOf('getRuntimeWindowValue("OsClient")'));
    assert.ok(diyTenantGetter.indexOf('getRuntimeWindowValue("OsClient")') < diyTenantGetter.indexOf("store.state.DiyStore.OsClient"));

    const osClientApiGetter = diyOsClient.slice(
        diyOsClient.indexOf("GetApiBase: function ()"),
        diyOsClient.indexOf("GetOsClient: function", diyOsClient.indexOf("GetApiBase: function ()"))
    );
    assert.ok(osClientApiGetter.indexOf("getRuntimeEndpointQuery()") < osClientApiGetter.indexOf('getRuntimeWindowValue("ApiBase")'));
    assert.ok(osClientApiGetter.indexOf('getRuntimeWindowValue("ApiBase")') < osClientApiGetter.indexOf("config.ApiBaseDev"));

    const osClientTenantGetter = diyOsClient.slice(
        diyOsClient.indexOf("GetOsClientNotDomain: function ()"),
        diyOsClient.indexOf("GetFileServer: function", diyOsClient.indexOf("GetOsClientNotDomain: function ()"))
    );
    assert.ok(osClientTenantGetter.indexOf("getRuntimeEndpointQuery()") < osClientTenantGetter.indexOf('getRuntimeWindowValue("OsClient")'));
    assert.match(diyOsClient, /publishRuntimeEndpointContext\(\{/);
});
