import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = {
    location: {
        origin: "https://client.example.com"
    },
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    fetch: async function () {
        return { status: 200 };
    }
};

const {
    apiServiceState,
    checkApiServiceNow,
    reportApiServiceFailure,
    reportApiServiceRecovered,
    reportApiServiceResponse
} = await import("../src/utils/api-service-status.js");

const context = {
    apiBase: "https://api.example.com",
    osClient: "example",
    url: "/api/FormEngine/GetFieldsData"
};

function networkError() {
    const error = new Error("Network Error");
    error.code = "ERR_NETWORK";
    return error;
}

function wait(milliseconds) {
    return new Promise(function (resolve) {
        setTimeout(resolve, milliseconds);
    });
}

function recover() {
    reportApiServiceRecovered({
        apiBase: context.apiBase,
        url: "/api/FormEngine/GetSysConfig"
    });
}

test("a single failed endpoint does not activate the global outage screen", async function () {
    let probeCount = 0;
    window.fetch = async function () {
        probeCount += 1;
        return { status: 200 };
    };

    reportApiServiceFailure(networkError(), context);
    assert.equal(apiServiceState.active, false);

    await wait(1050);

    assert.equal(probeCount, 1);
    assert.equal(apiServiceState.active, false);
});

test("a normal platform response cancels a pending outage probe", async function () {
    let probeCount = 0;
    window.fetch = async function () {
        probeCount += 1;
        return { status: 200 };
    };

    reportApiServiceFailure(networkError(), context);
    recover();
    await wait(950);

    assert.equal(probeCount, 0);
    assert.equal(apiServiceState.active, false);
});

test("the global outage screen requires two consecutive failed health probes", async function () {
    let probeCount = 0;
    window.fetch = async function () {
        probeCount += 1;
        throw networkError();
    };

    reportApiServiceFailure(networkError(), context);
    await wait(1050);
    assert.equal(probeCount, 1);
    assert.equal(apiServiceState.active, false);

    await wait(1400);
    assert.equal(probeCount, 2);
    assert.equal(apiServiceState.active, true);

    recover();
    assert.equal(apiServiceState.active, false);
});

test("SecurityBlocked keeps the exact backend diagnosis instead of showing API unavailable", async function () {
    const expiresAtUtc = new Date(Date.now() + 60_000).toISOString();
    const payload = {
        Code: 0,
        Msg: "当前IP访问过于频繁，已被安全防护临时拦截，请稍后再试或联系管理员。",
        DataAppend: {
            SecurityBlocked: true,
            Ip: "183.133.34.254",
            Reason: "IP在10秒内请求602次，超过阈值600。",
            ExpiresAtUtc: expiresAtUtc,
            UnblockAdvice: "到期后自动解除；超级管理员可手动解除。"
        }
    };

    assert.equal(reportApiServiceResponse(payload, context), true);
    assert.equal(apiServiceState.active, true);
    assert.equal(apiServiceState.mode, "security");
    assert.equal(apiServiceState.message, payload.Msg);
    assert.equal(apiServiceState.ip, "183.133.34.254");
    assert.equal(apiServiceState.reason, payload.DataAppend.Reason);
    assert.equal(apiServiceState.expiresAtUtc, expiresAtUtc);

    // 并发中的普通成功响应不能覆盖明确的安全拦截事实。
    recover();
    assert.equal(apiServiceState.active, true);
    assert.equal(apiServiceState.mode, "security");

    window.fetch = async function () {
        return { status: 200, json: async function () { return { Code: 1 }; } };
    };
    assert.equal(await checkApiServiceNow(), true);
    assert.equal(apiServiceState.active, false);
});
