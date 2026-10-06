import assert from "node:assert/strict";
import test from "node:test";
import { resolveSaasPublicTrialHostConfig } from "../src/views/micro-app/saas-public-trial-route.js";

test("fixed anonymous signup cannot select a different application or source", () => {
    assert.deepEqual(resolveSaasPublicTrialHostConfig({ saasPublicTrial: true,
        AppKey: "other-app", MicroServiceKey: "private-app", RoutePath: "/system-settings",
        Url: "https://attacker.example/", UrlApiEngineId: "privileged-engine", Version: "v1.0.0" }),
    { appKey: "microi-platform-service", version: "", microRoutePath: "/saas-trial",
        microAppUrl: "", urlApiEngineId: "" });
});

test("ordinary pages and truthy strings cannot opt in to the public signup host", () => {
    for (const meta of [{}, { Anonymous: true }, { saasPublicTrial: "true" }, { saasPublicTrial: 1 }])
        assert.equal(resolveSaasPublicTrialHostConfig(meta), null);
});
