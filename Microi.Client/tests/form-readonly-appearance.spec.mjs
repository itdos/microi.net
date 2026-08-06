import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testDir, "..");
const read = (relativePath) => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

test("runtime form items expose a dedicated readonly state", () => {
    const form = read("src/views/form-engine/diy-form.vue");
    const readonlyClassCount = form.match(/GetFieldReadOnly\(field\) \? ' is-field-readonly '/g)?.length || 0;

    assert.equal(readonlyClassCount, 2, "design and runtime field layouts should use the readonly class");
});

test("readonly fields keep readable text and a distinct disabled surface", () => {
    const styles = read("src/styles/diy-form.scss");

    assert.match(styles, /\.el-form-item\.is-field-readonly/);
    assert.match(styles, /background-color: var\(--el-disabled-bg-color/);
    assert.match(styles, /var\(--el-disabled-border-color/);
    assert.match(styles, /cursor: not-allowed/);
    assert.match(styles, /-webkit-text-fill-color: var\(--el-text-color-regular\)/);
});
