import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(
    new URL("../src/views/form-engine/left-right/LeftTreeJoinRightForm.vue", import.meta.url),
    "utf8"
);
const apiSource = await readFile(
    new URL("../src/utils/api.itdos.js", import.meta.url),
    "utf8"
);
const controllerSource = await readFile(
    new URL("../../Microi.Server/Microi.net.Api/Controllers/FormEngineController.cs", import.meta.url),
    "utf8"
);

test("left-right page loads protected configuration through its authorized endpoint", () => {
    assert.match(pageSource, /PostAsync\(this\.DiyApi\.GetLeftRightPageConfig/);
    assert.doesNotMatch(
        pageSource,
        /FormEngine\.GetFormData\(\{\s*FormEngineKey:\s*["']diy_LeftJoinRightView["']/s
    );
    assert.match(apiSource, /GetLeftRightPageConfig:\s*["']\/api\/FormEngine\/GetLeftRightPageConfig["']/);
});

test("left-right configuration endpoint authorizes the exact menu before its server-owned read", () => {
    assert.match(controllerSource, /GetLeftRightPageConfig\(\[FromBody\] JObject param\)/);
    assert.match(controllerSource, /AuthorizeClientMenuMetadataOperationAsync/);
    assert.match(controllerSource, /FormEngineKey\s*=\s*"diy_LeftJoinRightView"/);
    assert.match(controllerSource, /_InvokeType\s*=\s*InvokeType\.Server\.ToString\(\)/);
    assert.match(controllerSource, /_TrustedServerInvocation\s*=\s*true/);
    assert.match(controllerSource, /JArray\.Parse\(linkedMenuIds\)/);
});
