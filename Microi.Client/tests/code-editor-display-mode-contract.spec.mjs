import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parse } from '../node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js';
import { isCodeEditorDialog, codeEditorButtonText } from '../src/utils/code-editor-display.js';

const filename = new URL("../src/views/form-engine/diy-field-component/diy-code-editor.vue", import.meta.url);
const source = fs.readFileSync(filename, "utf8");

test('component configuration remains available in both inline and dialog modes', () => {
    const parsed = parse(source);
    assert.deepEqual(parsed.errors, []);
    const config = parsed.descriptor.template.ast.children.find(node => node.tag === 'el-dialog'
        && node.props.some(prop => prop.name === 'title' && prop.value?.content === '代码编辑器配置'));
    assert.ok(config, 'configuration must be a root sibling, not inside the Inline-only branch');
});

test("CodeEditor supports a field-level dialog button display mode", function () {
    assert.equal(isCodeEditorDialog(), false);
    assert.equal(isCodeEditorDialog({ DisplayMode: 'Inline' }, true), false);
    assert.equal(isCodeEditorDialog({ DisplayMode: 'Dialog' }), true);
    assert.equal(isCodeEditorDialog({ DisplayMode: 'mini' }), true);
    assert.equal(isCodeEditorDialog({ DisplayMode: 'invalid' }), false);
    assert.match(source, /isCodeEditorDialog\(props.field\?\.Config\?\.CodeEditor, props.CodeEditorMini\)/);
    assert.match(source, /v-if="UseMiniMode"/);
    assert.match(source, /if \(!UseMiniMode\.value\)[\s\S]*?Init\(\)/);
    assert.match(source, /v-model="configForm\.DisplayMode"/);
    assert.match(source, /value="Inline">直接显示代码编辑器/);
    assert.match(source, /value="Dialog">显示“编辑代码（xx字）”按钮/);
    assert.match(source, /CodeEditor\.DisplayMode = configForm\.value\.DisplayMode/);
});

test("dialog mode keeps the compact character-count button and unified rounded dialog", function () {
    assert.match(source, /\{\{ miniButtonText \}\}/);
    assert.equal(codeEditorButtonText('中文😀'), '编辑代码（3字）');
    assert.equal(codeEditorButtonText('a\r\nb\nc', '当前{{charCount}}字代码、{{lineCount}}行代码'), '当前6字代码、3行代码');
    assert.equal(codeEditorButtonText('', '{{charCount}}/{{lineCount}}'), '0/0');
    assert.equal(codeEditorButtonText(null, ''), '编辑代码（0字）');
    assert.equal(codeEditorButtonText('x', '{{unknown}}<b>{{ charCount }}</b>'), '{{unknown}}<b>1</b>');
    assert.match(source, /class="mci-unified-dialog code-editor-runtime-dialog"/);
    assert.match(source, /class="mci-unified-dialog mci-field-config-dialog"/);
});
