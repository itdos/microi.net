import assert from "node:assert/strict";
import test from "node:test";

import {
    getLegacySsoCapabilities,
    getSsoCapabilities,
    readLegacySsoCredential
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
