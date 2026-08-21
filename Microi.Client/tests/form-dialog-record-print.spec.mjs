import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compileTemplate, parse } from "@vue/compiler-sfc";
import * as sass from "sass";

const fullFormFilename = new URL("../src/views/form-engine/diy-form-full.vue", import.meta.url);
const formFilename = new URL("../src/views/form-engine/diy-form.vue", import.meta.url);
const fullStateFilename = new URL("../src/views/form-engine/mixins/diy-form-full-state.mixin.js", import.meta.url);
const formStateFilename = new URL("../src/views/form-engine/mixins/diy-form-state.mixin.js", import.meta.url);
const fullStyleFilename = new URL("../src/views/form-engine/styles/diy-form-full.global.scss", import.meta.url);
const formStyleFilename = new URL("../src/views/form-engine/styles/diy-form.scss", import.meta.url);
const codeEditorFilename = new URL("../src/views/form-engine/diy-field-component/diy-code-editor.vue", import.meta.url);

function compileVueTemplate(filename) {
    const source = fs.readFileSync(filename, "utf8");
    const parsed = parse(source, { filename: filename.pathname });
    assert.deepEqual(parsed.errors, []);
    const result = compileTemplate({
        source: parsed.descriptor.template.content,
        filename: filename.pathname,
        id: "form-dialog-record-print"
    });
    assert.deepEqual(result.errors, []);
    return source;
}

function between(source, start, end) {
    const startIndex = source.indexOf(start);
    assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
    const endIndex = source.indexOf(end, startIndex);
    assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
    return source.slice(startIndex, endIndex);
}

function overlayBlock(source, marker, closingTag) {
    const markerIndex = source.indexOf(marker);
    assert.notEqual(markerIndex, -1, `missing overlay marker: ${marker}`);
    const startIndex = source.lastIndexOf("<el-", markerIndex);
    const endIndex = source.indexOf(closingTag, markerIndex);
    assert.ok(startIndex > -1 && endIndex > startIndex, `missing overlay boundary for: ${marker}`);
    return source.slice(startIndex, endIndex);
}

test("Dialog and Drawer keep record tools after More with compact equal-height controls", function () {
    const source = compileVueTemplate(fullFormFilename);
    const page = between(source, 'class="form-header diy-form-page-header"', "<!--移动端底部固定操作条");
    const dialog = overlayBlock(source, 'v-if="ShowFieldForm"', "</el-dialog>");
    const drawer = overlayBlock(source, 'v-if="ShowFieldFormDrawer"', "</el-drawer>");

    for (const overlay of [dialog, drawer]) {
        const moreIndex = overlay.indexOf('{{ $t("Msg.More") }}');
        const recordIndex = overlay.indexOf("diy-form-record-selector--dialog");
        const searchIndex = overlay.indexOf('class="diy-form-header-search"');
        assert.ok(moreIndex > -1 && recordIndex > moreIndex, "record selector must follow More");
        assert.ok(searchIndex > recordIndex, "field search must follow record selector");
    }

    const style = fs.readFileSync(fullStyleFilename, "utf8");
    assert.match(style, /diy-form-dialog-actions \.diy-form-record-selector--dialog[\s\S]*?width:\s*226px/);
    assert.match(style, /diy-form-dialog-actions \.diy-form-record-selector--dialog \.el-select__wrapper,[\s\S]*?height:\s*30px/);
    assert.match(style, /diy-form-dialog-actions \.diy-form-record-count[\s\S]*?height:\s*30px/);
    assert.match(style, /diy-form-dialog-actions \.diy-form-header-search[\s\S]*?width:\s*164px/);
    assert.match(page, /class="diy-form-record-selector"/);
    assert.doesNotMatch(page, /diy-form-record-selector--dialog/);
    assert.match(style, /diy-form-page-header--embedded \.diy-form-record-selector \.el-select__wrapper,[\s\S]*?height:\s*40px/);
});

test("Dialog and Drawer record switching reloads locally without changing the table route", function () {
    const source = fs.readFileSync(fullFormFilename, "utf8");
    const method = between(source, "async ApplyWorkspaceRecordSwitch(recordId)", "GetWorkspaceEyebrow()");
    const embeddedIndex = method.indexOf("if (this.IsEmbeddedMode)");
    const emitIndex = method.indexOf('this.$emit("WorkspaceRecordChange", recordId)');
    const localInitIndex = method.indexOf("this._initFieldFormWhenReady");

    assert.ok(embeddedIndex > -1 && emitIndex > embeddedIndex, "only embedded workbench may emit route synchronization");
    assert.ok(localInitIndex > emitIndex, "Dialog and Drawer must continue through their local init path");
    assert.doesNotMatch(method, /\$router\.(push|replace)/);
});

test("single control-center sections hide the redundant tab rail", function () {
    const state = fs.readFileSync(formStateFilename, "utf8");
    const style = fs.readFileSync(formStyleFilename, "utf8");
    assert.match(state, /visibleTabs\.length === 1[\s\S]*?self\.IsControlCenterPresentation/);
    assert.match(state, /if \(hideSingleTab\)[\s\S]*?classes\.push\('tab-pane-hide'\)/);
    assert.match(style, /is-control-center:not\(\.has-section-nav\)\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?grid-template-areas:\s*["']section-main["'];/);
});

test("universal print expands every group and uses browser print with page breaks", function () {
    const fullSource = compileVueTemplate(fullFormFilename);
    const formSource = compileVueTemplate(formFilename);
    const fullState = fs.readFileSync(fullStateFilename, "utf8");
    const formState = fs.readFileSync(formStateFilename, "utf8");
    const fullStyle = fs.readFileSync(fullStyleFilename, "utf8");
    const formStyle = fs.readFileSync(formStyleFilename, "utf8");
    const codeEditorSource = compileVueTemplate(codeEditorFilename);

    assert.equal((fullSource.match(/@click="PrintCurrentForm"/g) || []).length, 3);
    assert.equal((fullSource.match(/PrintCurrentForm\(\)/g) || []).length, 4);
    assert.match(fullSource, /window\.print\(\)/);
    assert.match(fullSource, /diy-form-print-mode/);
    assert.match(fullSource, /diy-form-print-ancestor/);
    assert.match(fullState, /IsPrinting:\s*false/);
    assert.match(formState, /BeginPrintLayout\(\)/);
    assert.match(formState, /EndPrintLayout\(snapshot\)/);
    assert.match(formState, /this\.renderedTabs\.add\(key\)/);
    assert.match(formSource, /diy-form-print-section-head/);
    assert.match(formStyle, /\.el-tab-pane:not\(:first-child\)[\s\S]*?break-before:\s*page/);
    assert.match(formStyle, /\.el-table[\s\S]*?width:\s*100%\s*!important/);
    assert.match(formStyle, /:has\(\.diy-code-editor-print-source\)[\s\S]*?break-inside:\s*auto/);
    assert.match(fullStyle, /@media print[\s\S]*?@page[\s\S]*?diy-form-print-target/);
    assert.match(fullStyle, /body\.diy-form-print-mode\s*>\s*:not\(\.diy-form-print-ancestor\)/);
    assert.match(fullStyle, /\.el-col:not\(\.diy-form-right-panel-col\)[\s\S]*?flex:\s*0 0 100%/);
    assert.match(fullStyle, /\.page-right-col,[\s\S]*?\.diy-form-right-panel-col,[\s\S]*?display:\s*none\s*!important/);
    assert.equal((codeEditorSource.match(/class="diy-code-editor-print-source"/g) || []).length, 2);
    assert.match(codeEditorSource, /\.diy-code-editor-print-source[\s\S]*?white-space:\s*pre-wrap/);
    assert.match(codeEditorSource, /@media print[\s\S]*?\.monaco-container > \.editor-body[\s\S]*?display:\s*none\s*!important/);

    assert.doesNotThrow(() => sass.compileString(fullStyle));
    assert.doesNotThrow(() => sass.compileString(formStyle.replace(/^@use\s+[^;]+;\s*/m, "")));
});
