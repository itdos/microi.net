import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildMicroAppComponentSourceInfo } from "../src/utils/microAppDevComponentResolver.js";
import { buildMicroAppEntryUrl } from "../src/utils/microAppEntryUrl.js";

function harness(read) {
    const state = { api: "https://tenant.example/api", tenant: "a", token: "session-a", now: 1000 };
    const common = {
        GetApiBase: () => state.api, GetOsClient: () => state.tenant, getToken: () => state.token,
        FormEngine: { GetTableData: read }
    };
    const source = fs.readFileSync(new URL("../src/utils/microAppComponentSource.js", import.meta.url), "utf8")
        .replace(/^import .+;\r?$/gm, "").replace(/^export /gm, "");
    const api = new Function("DiyCommon", "buildMicroAppEntryUrl", "buildMicroAppComponentSourceInfo", "Date",
        `${source}\nreturn { loadMicroAppComponentPages, loadMicroAppComponentSourceInfo };`
    )(common, buildMicroAppEntryUrl, buildMicroAppComponentSourceInfo, { now: () => state.now });
    return { api, state };
}

test("component source cache deduplicates requests but expires and isolates endpoint, tenant and user", async () => {
    let calls = 0;
    const { api, state } = harness(async () => ({ Code: 1, Data: [{ Id: ++calls }] }));
    const first = api.loadMicroAppComponentPages();
    assert.equal(first, api.loadMicroAppComponentPages());
    await first;
    assert.equal(calls, 1);
    state.now += 30001;
    await api.loadMicroAppComponentPages();
    assert.equal(calls, 2);
    for (const key of ["tenant", "token", "api"]) {
        state[key] += "-other";
        await api.loadMicroAppComponentPages();
    }
    assert.equal(calls, 5);
});

test("failed metadata requests never poison subsequent source discovery", async () => {
    let calls = 0;
    const { api } = harness(async () => {
        calls += 1;
        if (calls === 1) return { Code: 1002 };
        if (calls === 2) throw new Error("temporary network failure");
        return { Code: 1, Data: [] };
    });
    assert.equal((await api.loadMicroAppComponentPages()).Code, 1002);
    await assert.rejects(api.loadMicroAppComponentPages(), /temporary network/);
    assert.equal((await api.loadMicroAppComponentPages()).Code, 1);
    assert.equal(calls, 3);
});

test("optional service metadata failure preserves known coordinates and exposes no session secrets", async () => {
    const { api } = harness(async () => { throw new Error("metadata denied"); });
    const info = await api.loadMicroAppComponentSourceInfo({
        MicroServiceKey: "counting", PageKey: "inventory", RoutePath: "/inventory", BuildVersion: "stale-version"
    }, "/loctek/CountingDetails.vue");
    assert.equal(info.appKey, "counting");
    assert.equal(info.routePath, "/inventory");
    assert.equal(info.version, "");
    assert.equal(info.sourcePath, "AI应用/counting");
    assert.doesNotMatch(JSON.stringify(info), /session-a|metadata denied/);
});
