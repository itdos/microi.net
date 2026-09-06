import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compileScript, compileStyle, compileTemplate, parse } from "@vue/compiler-sfc";

const filename = new URL(
    "../src/views/form-engine/diy-components/module-form-workbench.vue",
    import.meta.url
);
const tableFilename = new URL("../src/views/form-engine/diy-table.vue", import.meta.url);
const fullFormFilename = new URL("../src/views/form-engine/diy-form-full.vue", import.meta.url);
const fullFormDialogMixinFilename = new URL(
    "../src/views/form-engine/mixins/diy-form-full-dialog.mixin.js",
    import.meta.url
);
const presentationMixinFilename = new URL(
    "../src/views/form-engine/mixins/diy-table-presentation.mixin.js",
    import.meta.url
);

test("module form workbench compiles and embeds DiyFormFull while preserving table V8 button scopes", function () {
    const source = fs.readFileSync(filename, "utf8");
    const parsed = parse(source, { filename: filename.pathname });
    assert.deepEqual(parsed.errors, []);

    const script = compileScript(parsed.descriptor, { id: "module-form-workbench" });
    const template = compileTemplate({
        source: parsed.descriptor.template.content,
        filename: filename.pathname,
        id: "module-form-workbench",
        compilerOptions: { bindingMetadata: script.bindings }
    });
    const style = compileStyle({
        source: parsed.descriptor.styles[0].content,
        filename: filename.pathname,
        id: "module-form-workbench",
        scoped: true,
        preprocessLang: "scss"
    });

    assert.deepEqual(template.errors, []);
    assert.deepEqual(style.errors, []);
    assert.match(source, /import\("@\/views\/form-engine\/diy-form-full\.vue"\)/);
    assert.doesNotMatch(source, /import\("@\/views\/form-engine\/diy-form\.vue"\)/);
    assert.doesNotMatch(source, /\.FormSubmit\(formParam/);
    assert.match(source, /_RowMoreBtnsOut/);
    assert.match(source, /_RowMoreBtnsIn/);
    assert.match(source, /pageButtons/);
    assert.match(source, /batchButtons/);
    assert.match(source, /runAction\(action, 'Page'\)/);
    assert.match(source, /runAction\(action, 'Batch'\)/);
    assert.match(source, /runAction\(action, 'Row'\)/);
    assert.match(source, /selectedRecord\.value \|\| \{\}/);
    assert.match(source, /form-ready/);
    assert.match(source, /currentForm/);
    assert.doesNotMatch(source, /切换到经典表格|当前记录<|workbench-toolbar/);
    assert.match(source, /RecordSelector/);
    assert.match(source, /PresentationConfig/);
    assert.match(source, /DialogType:\s*"Embedded"/);
    assert.match(source, /embeddedHeader/);
    assert.match(source, /CallbackSetFormData/);
    assert.match(source, /recordOptions/);
    assert.match(source, /EmbeddedRecordNavigator/);
    assert.match(source, /#workspace-actions/);
    assert.match(source, /<DiyFormFull[\s\S]*?<template #workspace-actions>[\s\S]*?<\/DiyFormFull>/);
    assert.doesNotMatch(source, /<header class="workbench-toolbar"/);
    assert.match(source, /size="small"[\s\S]*?runAction\(action, 'Page'\)/);
    assert.match(source, /typeof form\.SwitchWorkspaceRecord === "function"/);
    assert.match(source, /activeFormId !== nextId/);
    assert.match(source, /lastEmbeddedFormInstance !== form/);
    assert.match(source, /lastEmbeddedSignature\.value = ""/);
    assert.doesNotMatch(source, /dynamicActions/);
    assert.doesNotMatch(source, />业务功能</);
    assert.doesNotMatch(source, /\beval\s*\(|new Function\s*\(/);
});

test("ViewMode=Table remains a route state without classic/workbench switch UI", function () {
    const tableSource = fs.readFileSync(tableFilename, "utf8");
    const mixinSource = fs.readFileSync(presentationMixinFilename, "utf8");

    assert.doesNotMatch(tableSource, /ModuleFormWorkbenchClassicEnabled|返回表单工作台|SwitchClassicToModuleWorkbench/);
    assert.match(tableSource, /Msg\.MoreFunctions/);
    assert.doesNotMatch(tableSource, /module-workbench-return-bar/);
    assert.match(tableSource, /:batch-buttons="SysMenuModel\.BatchSelectMoreBtns \|\| \[\]"/);
    assert.match(tableSource, /:page-buttons="SysMenuModel\.PageBtns \|\| \[\]"/);
    assert.match(tableSource, /@run-action="HandleModuleWorkbenchAction"/);
    assert.match(tableSource, /:title-icon="SysMenuModel\.Icon \|\| ''"/);
    assert.match(mixinSource, /TableMultipleSelection = selection/);
    assert.match(tableSource, /V8\.SelectedData/);
    assert.match(mixinSource, /requestedMode !== "table"/);
    assert.match(mixinSource, /hasScalarRecordId\(this\.\$route\?\.query\?\.RecordId\)/);
    assert.match(mixinSource, /FormPresentationConfig/);
    assert.match(mixinSource, /legacyFormView\?\.Layout\?\.Hero\s*\|\|\s*this\.ModuleListView\?\.Layout\?\.Hero/);
    assert.match(mixinSource, /migrateLegacyModuleHeroBanner\(sharedBanner\)/);
    assert.match(mixinSource, /resolveModuleOpenFirstRecord\(this\.SysMenuModel, moduleForm\)/);
    assert.match(tableSource, /PresentationMode:\s*self\.ModuleFormWorkbenchAvailable/);
    assert.match(tableSource, /PresentationConfig:\s*self\.ModuleFormWorkbenchConfig\s*\|\|\s*\{\}/);
    assert.match(tableSource, /RecordNavigator:/);
    assert.match(tableSource, /Enabled:\s*self\.FormMode !== "Add"[\s\S]{0,240}!self\._IsTableChild[\s\S]{0,160}self\.PropsEmbedded !== true[\s\S]{0,160}self\.PropsIsJoinTable !== true/);
    assert.doesNotMatch(mixinSource, /delete query\.ViewMode|delete query\.viewMode/);
});

test("dialog and drawer record switching never replaces the host module route", function () {
    // Git 在 Windows 工作区可能检出 CRLF；保留方法边界与路由断言，只统一换行。
    const mixinSource = fs.readFileSync(presentationMixinFilename, "utf8").replace(/\r\n/g, "\n");
    const handler = mixinSource.match(/HandleWorkspaceDialogRecordChange\(recordId\)\s*\{([\s\S]*?)\n\s*\},\n\s*ResolvePresentationField/);
    assert.ok(handler, "workspace dialog record handler should remain explicit");
    assert.match(handler[1], /SyncModuleWorkbenchSelection\(current\)/);
    assert.doesNotMatch(handler[1], /\$router|HandleModuleWorkbenchRecordChange/);
});

test("DiyFormFull supports the embedded workbench contract and forwards presentation to DiyForm", function () {
    const source = fs.readFileSync(fullFormFilename, "utf8");
    const dialogMixinSource = fs.readFileSync(fullFormDialogMixinFilename, "utf8");
    const parsed = parse(source, { filename: fullFormFilename.pathname });
    assert.deepEqual(parsed.errors, []);
    assert.match(source, /IsEmbeddedMode/);
    assert.match(source, /dialogType\s*==\s*"Embedded"/);
    assert.match(source, /EmbeddedHeader/);
    assert.match(source, /EmbeddedRecordNavigator/);
    assert.match(source, /diy-form-workbench-title-icon/);
    assert.match(source, /diy-form-record-selector/);
    assert.equal((source.match(/class="[^"]*diy-form-dialog-actions[^"]*diy-form-toolbar/g) || []).length, 3);
    assert.match(source, /class="diy-form-toolbar__extensions"[\s\S]*?<slot name="workspace-actions"/);
    assert.match(source, /SwitchWorkspaceRecord/);
    assert.match(source, /_formFullInitRequestToken/);
    assert.match(source, /initRequestToken !== self\._formFullInitRequestToken/);
    assert.match(source, /:PresentationMode="PresentationMode"/);
    assert.match(source, /:PresentationConfig="PresentationConfig"/);
    assert.match(source, /\$emit\("CallbackSetFormData"/);
    assert.doesNotMatch(dialogMixinSource, /source === "Embedded"[\s\S]{0,160}\$emit\("CallbackSetFormData"/);
});

test("DiyForm exposes the generic control-center presentation without replacing field components", function () {
    const diyFormFilename = new URL("../src/views/form-engine/diy-form.vue", import.meta.url);
    const source = fs.readFileSync(diyFormFilename, "utf8");
    const parsed = parse(source, { filename: diyFormFilename.pathname });
    assert.deepEqual(parsed.errors, []);
    assert.match(source, /PresentationConfig/);
    assert.match(source, /PresentationSections/);
    assert.match(source, /ActivatePresentationSection/);
    assert.match(source, /GetPresentationFieldClass\(field\)/);
    assert.match(source, /StandardFormBanner/);
    assert.match(source, /DiyReadonlyValue/);
    assert.match(source, /GetEffectiveTabsPosition/);
    assert.match(source, /:is="GetFieldComponent\(field\)"/);
    assert.match(source, /@CallbackRunV8Code="RunV8Code"/);
});
