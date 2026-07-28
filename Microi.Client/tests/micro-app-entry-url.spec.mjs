import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    appendMicroAppVersionQuery,
    buildMicroAppEntryUrl
} from "../src/utils/microAppEntryUrl.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("managed micro-app entry keeps a stable path and uses version only for cache busting", () => {
    assert.equal(buildMicroAppEntryUrl({
        apiBase: "https://api.itdos.com/",
        osClient: "iTdos",
        appKey: "microi-platform-service",
        version: "v1.0.3"
    }), "https://api.itdos.com/micro-app/iTdos/microi-platform-service/index.html?v=v1.0.3");
});

test("managed micro-app entry remains valid when build version is unavailable", () => {
    assert.equal(buildMicroAppEntryUrl({
        osClient: "tenant a",
        appKey: "app/key"
    }), "/micro-app/tenant%20a/app%2Fkey/index.html");
});

test("cache version appends without replacing an existing query", () => {
    assert.equal(
        appendMicroAppVersionQuery("/micro-app/demo/app/index.html?mode=preview", "v2.1.0"),
        "/micro-app/demo/app/index.html?mode=preview&v=v2.1.0"
    );
});

test("all built-in hosts use the stable entry helper instead of a version path segment", () => {
    for (const file of ["dialog.vue", "host.vue", "dev-component.vue"]) {
        const source = fs.readFileSync(path.join(root, "src/views/micro-app", file), "utf8");
        assert.match(source, /buildMicroAppEntryUrl/);
        assert.doesNotMatch(source, /versionPart/);
    }
});
