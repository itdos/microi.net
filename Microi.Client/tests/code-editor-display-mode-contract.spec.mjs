import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const filename = new URL("../src/views/form-engine/diy-field-component/diy-code-editor.vue", import.meta.url);
const source = fs.readFileSync(filename, "utf8");

test("CodeEditor supports a field-level dialog button display mode", function () {
    assert.match(source, /Config\?\.CodeEditor\?\.DisplayMode/);
    assert.match(source, /configured === 'dialog'/);
    assert.match(source, /v-if="UseMiniMode"/);
    assert.match(source, /if \(!UseMiniMode\.value\)[\s\S]*?Init\(\)/);
    assert.match(source, /v-model="configForm\.DisplayMode"/);
    assert.match(source, /value="Inline">直接显示代码编辑器/);
    assert.match(source, /value="Dialog">显示“编辑代码（xx字）”按钮/);
    assert.match(source, /CodeEditor\.DisplayMode = configForm\.value\.DisplayMode/);
});

test("dialog mode keeps the compact character-count button and unified rounded dialog", function () {
    assert.match(source, /编辑代码\{\{ miniCodeLength \}\}/);
    assert.match(source, /Array\.from\(String\(ModelValue\.value \|\| ''\)\)\.length/);
    assert.match(source, /return `（\$\{len\}字）`/);
    assert.match(source, /class="mci-unified-dialog code-editor-runtime-dialog"/);
    assert.match(source, /class="mci-unified-dialog mci-field-config-dialog"/);
});
