import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const filename = new URL("../src/views/workflow/my-work.vue", import.meta.url);
const source = fs.readFileSync(filename, "utf8");

test("home work tabs use a compact segmented treatment instead of a heavy active bar", function () {
    assert.match(source, /\.main-tab-label\s*\{[\s\S]*min-width:\s*92px[\s\S]*border-radius:\s*9px/);
    assert.match(source, /\.el-tabs__active-bar[\s\S]*display:\s*none/);
    assert.match(source, /\.is-active[\s\S]*\.main-tab-label[\s\S]*el-color-primary-light-9/);
});

test("notice badge and tab navigation explicitly allow overflow", function () {
    assert.match(source, /\.el-tabs__nav-wrap[\s\S]*\.el-tabs__nav-scroll[\s\S]*overflow:\s*visible/);
    assert.match(source, /\.notice-badge\s*\{[\s\S]*overflow:\s*visible/);
    assert.match(source, /\.el-badge__content[\s\S]*transform:\s*translate\(55%,\s*-45%\)/);
});
