import assert from "node:assert/strict";
import test from "node:test";

import {
    getLegacySsoCapabilities,
    getSsoCapabilities,
    readLegacySsoCredential,
    withoutLegacySsoCredential,
    legacySsoTarget,
    isLegacySsoDeepLink
} from "../src/utils/sso-federation.js";

test("SSO discovery is delivered by marketplace ApiEngines", async () => {
    const calls = [];
    const diyCommon = {
        async PostAsync(url, payload) {
            calls.push({ url, payload });
            return { Code: 1, Data: url.includes("legacy") ? [] : { Providers: [] } };
        }
    };

    await getSsoCapabilities(diyCommon, "iTdos");
    await getLegacySsoCapabilities(diyCommon, "iTdos");

    assert.deepEqual(calls.map((item) => item.url), [
        "/apiengine/sso_capabilities",
        "/apiengine/sso_legacy_capabilities"
    ]);
    assert.ok(calls.every((item) => item.payload.ApiEngineKey === undefined));
    assert.ok(calls.every((item) => item.payload.OsClient === "iTdos"));
});

test("consumed credentials never survive URL cleanup or dynamic-route rematches", () => {
    const href = "https://microi.example/?OsClient=loctek&TOKEN=outer#/zichanxiaoydc?ShowClassicLeft=0&ShowClassicTop=0&token=inner";
    assert.equal(withoutLegacySsoCredential(href, "token"), "https://microi.example/?OsClient=loctek#/zichanxiaoydc?ShowClassicLeft=0&ShowClassicTop=0");
    const target = legacySsoTarget({ path: "/zichanxiaoydc", query: { token: "inner", ShowClassicLeft: "0", ShowClassicTop: "0" } }, "token");
    assert.deepEqual(target, { path: "/zichanxiaoydc", query: { ShowClassicLeft: "0", ShowClassicTop: "0" }, hash: "", replace: true });
    assert.equal(isLegacySsoDeepLink(target), true);
});

test("only a local explicit business page takes priority over the configured home", () => {
    for (const path of ["/", "/login", "/auth-redirect", "/access-login", "//evil.example", "https://evil.example", ""]) {
        assert.equal(isLegacySsoDeepLink({ path }), false, path);
    }
    assert.equal(isLegacySsoDeepLink({ path: "/assets/detail" }), true);
});

test("legacy SSO credential reader accepts only the configured parameter", () => {
    const href = "https://microi.example/?OsClient=iTdos&corp_ticket=Bearer%20abc123#/home";
    assert.equal(readLegacySsoCredential(href, "corp_ticket"), "Bearer abc123");
    assert.equal(readLegacySsoCredential(href, "token"), "");
});

test("legacy SSO credential reader supports encoded and hash query forms", () => {
    assert.equal(
        readLegacySsoCredential("https://microi.example/%3Fcorp_ticket%3Dabc%252B123", "corp_ticket"),
        "abc%2B123"
    );
    assert.equal(
        readLegacySsoCredential("https://microi.example/#/login?corp_ticket=a%2Fb%3Dc", "corp_ticket"),
        "a/b=c"
    );
});

test("legacy SSO credential reader rejects unsafe names, placeholders and oversized values", () => {
    assert.equal(readLegacySsoCredential("https://microi.example/?token=value", "token|other"), "");
    assert.equal(readLegacySsoCredential("https://microi.example/?token=$V8.CurrentToken$", "token"), "");
    assert.equal(readLegacySsoCredential(`https://microi.example/?token=${"a".repeat(17000)}`, "token"), "");
});
