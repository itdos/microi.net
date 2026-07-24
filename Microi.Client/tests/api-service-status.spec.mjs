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
    reportApiServiceFailure,
    reportApiServiceRecovered
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
