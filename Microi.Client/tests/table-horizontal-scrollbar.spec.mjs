import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");

test("horizontal scrollbar is persistent only when Element Plus reports real overflow", function () {
    assert.doesNotMatch(component, /<el-table[\s\S]*?scrollbar-always-on[\s\S]*?>/);
    assert.match(styles, /--mci-table-horizontal-scrollbar-size:\s*12px;/);
    assert.match(styles, /&\.el-table--scrollable-x\s*\{[\s\S]*?padding-bottom:\s*var\(--mci-table-horizontal-scrollbar-gutter\);[\s\S]*?\.el-scrollbar__bar\.is-horizontal\s*\{[\s\S]*?display:\s*block\s*!important;/);
    assert.match(styles, /&\.el-table--scrollable-x\s*\{[\s\S]*?\.el-scrollbar__bar\.is-horizontal\s*\{[\s\S]*?height:\s*var\(--mci-table-horizontal-scrollbar-size\);[\s\S]*?cursor:\s*pointer;[\s\S]*?opacity:\s*1\s*!important;/);
    assert.match(styles, /&\.el-table--scrollable-x\s*\{[\s\S]*?\.el-scrollbar__bar\.is-horizontal\s+\.el-scrollbar__thumb\s*\{[\s\S]*?min-width:\s*48px;[\s\S]*?cursor:\s*grab;[\s\S]*?opacity:\s*0\.8;/);
    assert.match(styles, /&\.el-table--scrollable-x\s*\{[\s\S]*?\.el-scrollbar__bar\.is-horizontal\s+\.el-scrollbar__thumb:active\s*\{[\s\S]*?cursor:\s*grabbing;/);
});

test("horizontal scrollbar colors and motion follow Microi semantic tokens", function () {
    assert.match(styles, /background-color:\s*var\(--mci-bg-surface,/);
    assert.match(styles, /background-color:\s*var\(--mci-text-tertiary,/);
    assert.match(styles, /background-color:\s*var\(--mci-color-primary,/);
    assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none;/);
});
