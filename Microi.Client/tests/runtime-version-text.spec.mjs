import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildRuntimeVersionText } from "../src/utils/runtime-version-text.js";

test("runtime version text renders the fixed API health version and Web package version", () => {
    assert.equal(
        buildRuntimeVersionText({
            backendVersion: "v7.6.5",
            frontendVersion: "v7.6.5"
        }),
        "Api v7.6.5 - Web v7.6.5"
    );

    assert.equal(
        buildRuntimeVersionText({
            backendVersion: "7.6.6",
            frontendVersion: "7.6.5"
        }),
        "Api v7.6.6 - Web v7.6.5"
    );
});

test("runtime version text keeps a stable placeholder until a version is available", () => {
    assert.equal(
        buildRuntimeVersionText({ frontendVersion: "v7.6.5" }),
        "Api v-- - Web v7.6.5"
    );
});

test("TagsView subscribes to the shared health state and preserves the shell right-edge alignment", async () => {
    const source = await readFile(
        new URL("../src/layout/components/TagsView/index.vue", import.meta.url),
        "utf8"
    );

    assert.match(source, /apiServiceState\.backendVersion/);
    assert.match(source, /apiServiceState\.frontendVersion/);
    assert.match(source, /data-testid="runtime-version"/);
    assert.match(source, /--mci-shell-version-right:\s*18px/);
    assert.match(source, /align-items:\s*center/);
    assert.match(source, /margin:\s*0 var\(--mci-shell-version-right\)/);
    assert.match(source, /background:\s*color-mix\([\s\S]*?--mci-color-primary/);
    assert.match(source, /border:\s*1px solid color-mix\([\s\S]*?--mci-color-primary/);
});
