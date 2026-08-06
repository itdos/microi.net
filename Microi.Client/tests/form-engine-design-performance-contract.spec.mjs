import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const formFilename = new URL("../src/views/form-engine/diy-form.vue", import.meta.url);
const formStateFilename = new URL("../src/views/form-engine/mixins/diy-form-state.mixin.js", import.meta.url);
const formCleanupFilename = new URL("../src/views/form-engine/mixins/diy-form-cleanup.mixin.js", import.meta.url);
const formFullFilename = new URL("../src/views/form-engine/diy-form-full.vue", import.meta.url);
const formDialogFilename = new URL("../src/views/form-engine/mixins/diy-form-full-dialog.mixin.js", import.meta.url);
const formUtilsFilename = new URL("../src/views/form-engine/mixins/form-utils.mixin.js", import.meta.url);
const formStyleFilename = new URL("../src/styles/diy-form.scss", import.meta.url);
const formSchemaFilename = new URL("../src/views/form-engine/mixins/diy-form-schema.mixin.js", import.meta.url);
const jsonTableFilename = new URL("../src/views/form-engine/diy-field-component/diy-jsontable.vue", import.meta.url);
const tableFilename = new URL("../src/views/form-engine/diy-table.vue", import.meta.url);
const tableNavigationFilename = new URL("../src/views/form-engine/mixins/diy-table-navigation.mixin.js", import.meta.url);
const tableStateFilename = new URL("../src/views/form-engine/mixins/diy-table-state.mixin.js", import.meta.url);
const tableCleanupFilename = new URL("../src/views/form-engine/mixins/diy-table-cleanup.mixin.js", import.meta.url);

function read(filename) {
    return fs.readFileSync(filename, "utf8");
}

function extractBalancedBlock(source, marker) {
    const markerIndex = source.indexOf(marker);
    assert.notEqual(markerIndex, -1, `missing source marker: ${marker}`);
    const blockStart = source.indexOf("{", markerIndex + marker.length);
    assert.notEqual(blockStart, -1, `missing block after source marker: ${marker}`);

    let depth = 0;
    let quote = "";
    let escaped = false;
    for (let index = blockStart; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = "";
            continue;
        }
        if (character === '"' || character === "'" || character === "`") {
            quote = character;
            continue;
        }
        if (character === "{") depth += 1;
        if (character === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(blockStart + 1, index);
        }
    }
    assert.fail(`unterminated block after source marker: ${marker}`);
}

test("diy form keeps one V8 context per field until the form context changes", function () {
    const formSource = read(formFilename);
    const stateSource = read(formStateFilename);
    const getV8Body = extractBalancedBlock(formSource, "\n        GetV8(field)");
    const resetBody = extractBalancedBlock(formSource, "\n        ResetV8FieldCache(context)");

    assert.match(stateSource, /_V8FieldCache\s*:\s*new WeakMap\(\)/);
    assert.match(getV8Body, /_V8FieldCacheContext\s*!==\s*context/);
    assert.match(getV8Body, /ResetV8FieldCache\(context\)/);
    assert.match(getV8Body, /_V8FieldCache\.get\(field\)/);
    assert.match(getV8Body, /_V8FieldCache\.set\(field,\s*v8\)/);
    assert.match(getV8Body, /if\s*\(\s*!v8\s*\)[\s\S]*InitV8CodeSync/);
    assert.match(getV8Body, /else\s*\{[\s\S]*RefreshCachedV8Context\(v8\)/);
    assert.match(resetBody, /_V8FieldCache\s*=\s*new WeakMap\(\)/);
    assert.match(resetBody, /_V8RootInstance\s*=\s*null/);
    assert.match(resetBody, /_V8FieldCacheContext\s*=\s*context\s*\|\|\s*["']/);
});

test("form cleanup releases cached field V8 contexts", function () {
    const cleanupSource = read(formCleanupFilename);

    assert.match(cleanupSource, /_V8FieldCache\s*=\s*new WeakMap\(\)/);
    assert.match(cleanupSource, /_V8RootInstance\s*=\s*null/);
    assert.match(cleanupSource, /_V8FieldCacheContext\s*=\s*["']["']/);
});

test("opening an existing form does not eagerly request log comment and version data", function () {
    const dialogSource = read(formDialogFilename);
    const openDetailBody = extractBalancedBlock(dialogSource, "OpenDetail(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam)");

    assert.doesNotMatch(openDetailBody, /\bLoadDataLog\s*\(/);
    assert.doesNotMatch(openDetailBody, /\bLoadDataComment\s*\(/);
    assert.doesNotMatch(openDetailBody, /\bLoadDataVersion\s*\(/);
});

test("dialog form buttons evaluate async V8CodeShow through the async visibility runner", function () {
    const fullSource = read(formFullFilename);
    const dialogSource = read(formDialogFilename);
    const handlerBody = extractBalancedBlock(fullSource, "\n        async HandlerBtns(btns, row, v8)");

    assert.match(handlerBody, /HandlerBtnsAsync\(btns,\s*row,\s*v8\)/);
    assert.match(fullSource, /runV8ButtonVisibilityCodeAsync/);
    assert.match(dialogSource, /fieldForm\.Init\(true,\s*async function\s*\(callbackValue\)/);
    assert.match(dialogSource, /await self\.HandlerBtnsAsync\(self\.SysMenuModel\.FormBtns/);
});

test("button controls keep the top-label spacer and titled DevComponents keep their business label", async function () {
    const formSource = read(formFilename);
    const styleSource = read(formStyleFilename);
    const formUtilsMixin = (await import(formUtilsFilename)).default;

    assert.ok((formSource.match(/is-button-field/g) || []).length >= 2);
    assert.match(styleSource, /\.el-form--label-top \.is-button-field:not\(\.hide-label\)/);
    assert.match(styleSource, /min-height:\s*28px/);
    assert.equal(formUtilsMixin.methods.shouldShowLabel({ Component: "DevComponent", Label: "盘点明细", Config: { DevComponentName: "CountingDetails" } }), true);
    assert.equal(formUtilsMixin.methods.shouldShowLabel({ Component: "DevComponent", Label: "", Config: { DevComponentName: "Dashboard" } }), false);
});

test("sys_menu module design uses mini code editors throughout DiyForm", function () {
    const fullSource = read(formFullFilename);
    const formSource = read(formFilename);
    const useMiniBody = extractBalancedBlock(fullSource, "UseMiniCodeEditor()");

    assert.match(useMiniBody, /TableName/);
    assert.match(useMiniBody, /sys_menu/i);
    assert.ok(
        (fullSource.match(/:CodeEditorMini=["']UseMiniCodeEditor["']/g) || []).length >= 4,
        "every DiyForm opening mode must receive the sys_menu mini-editor flag"
    );
    assert.ok(
        (formSource.match(/:CodeEditorMini=["']CodeEditorMini["']/g) || []).length >= 2,
        "both tabbed and non-tabbed field renderers must forward the mini-editor flag"
    );
});

test("heavy form tabs mount fields progressively and keep programmatic tab navigation compatible", function () {
    const formSource = read(formFilename);
    const stateSource = read(formStateFilename);
    const schemaSource = read(formSchemaFilename);
    const cleanupSource = read(formCleanupFilename);

    assert.match(formSource, /v-for="field in GetRenderedTabFields\(tab\.Id \|\| tab\.Name\)"/);
    assert.match(schemaSource, /ShouldProgressivelyRenderTab/);
    assert.match(schemaSource, /JsonTable/);
    assert.match(schemaSource, /BATCH_SIZE_NEXT/);
    assert.match(schemaSource, /FieldActiveTab !== tabKey/);
    assert.match(extractBalancedBlock(schemaSource, "ClickFormTab(tabName)"), /QueueTabRender\(tabKey\)/);
    assert.match(schemaSource, /QueueTabRender\(tabKey\)/);
    assert.match(schemaSource, /IsModuleDesignProgressiveRender/);
    assert.match(schemaSource, /CodeEditorMini === true/);
    assert.match(schemaSource, /tableName === "sysmenu"/);
    assert.match(schemaSource, /tabKey === this\._initialRenderedTabKey/);
    assert.doesNotMatch(formSource, /v-memo=/);
    assert.match(stateSource, /_tabRenderTimers\s*:\s*\{\}/);
    assert.match(stateSource, /_tabActivationFrames\s*:\s*\{\}/);
    assert.match(stateSource, /FieldActiveTab\(tabKey\)/);
    assert.match(cleanupSource, /Object\.values\(self\._tabRenderTimers\)/);
    assert.match(cleanupSource, /Object\.values\(self\._tabActivationFrames\)/);
});

test("ordinary forms and the initial module tab always render every field while later module batches finish automatically", async function () {
    const schemaMixin = (await import(formSchemaFilename)).default;
    const methods = schemaMixin.methods;
    const fields = Array.from({ length: 10 }, (_, index) => ({
        Id: String(index + 1),
        Name: `Field${index + 1}`,
        Component: index < 6 ? "JsonTable" : "Text"
    }));

    const ordinaryContext = {
        TableName: "sys_user",
        DiyTableModel: { Name: "sys_user" },
        CodeEditorMini: false,
        LoadMode: "View",
        _initialRenderedTabKey: "main",
        DiyFieldListGrouped: { main: fields },
        renderedFieldCounts: {},
        BATCH_SIZE_FIRST: 2,
        IsModuleDesignProgressiveRender: methods.IsModuleDesignProgressiveRender,
        ShouldProgressivelyRenderTab: methods.ShouldProgressivelyRenderTab
    };
    assert.equal(methods.ShouldProgressivelyRenderTab.call(ordinaryContext, fields, "main"), false);
    assert.equal(methods.GetRenderedTabFields.call(ordinaryContext, "main").length, fields.length);

    const moduleContext = {
        TableName: "sys_menu",
        DiyTableModel: { Name: "sys_menu" },
        CodeEditorMini: true,
        LoadMode: "Edit",
        _initialRenderedTabKey: "module-info",
        DiyFieldListGrouped: { "module-info": fields, buttons: fields },
        renderedFieldCounts: {},
        BATCH_SIZE_FIRST: 2,
        BATCH_SIZE_NEXT: 2,
        _tabRenderTimers: {},
        _isDestroyed: false,
        FieldActiveTab: "buttons",
        IsModuleDesignProgressiveRender: methods.IsModuleDesignProgressiveRender,
        ShouldProgressivelyRenderTab: methods.ShouldProgressivelyRenderTab,
        StartProgressiveTabRender: methods.StartProgressiveTabRender
    };
    assert.equal(methods.ShouldProgressivelyRenderTab.call(moduleContext, fields, "module-info"), false);
    assert.equal(methods.GetRenderedTabFields.call(moduleContext, "module-info").length, fields.length);
    assert.equal(methods.ShouldProgressivelyRenderTab.call(moduleContext, fields, "buttons"), true);

    methods.StartProgressiveTabRender.call(moduleContext, "buttons");
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(moduleContext.renderedFieldCounts.buttons, fields.length);
});

test("json tables avoid duplicate initial parsing and skip pointless Sortable instances", function () {
    const source = read(jsonTableFilename);
    const mountedBody = extractBalancedBlock(source, "onMounted(() =>");

    assert.doesNotMatch(mountedBody, /parseData\(/);
    assert.match(mountedBody, /tableData\.value\.length > 1/);
    assert.match(source, /if \(sortableInitPending\) return/);
    assert.match(source, /length > 1 && !sortableInstance/);
});

test("table pages warm the form dialog during idle time without eagerly mounting it", function () {
    const tableSource = read(tableFilename);
    const navigationSource = read(tableNavigationFilename);
    const stateSource = read(tableStateFilename);
    const cleanupSource = read(tableCleanupFilename);

    assert.match(tableSource, /v-if="_shouldRenderDiyFormDialog"/);
    assert.match(tableSource, /WarmupDiyFormDialog/);
    assert.match(navigationSource, /import\("@\/views\/form-engine\/diy-form-full\.vue"\)/);
    assert.match(navigationSource, /import\("@\/views\/form-engine\/diy-form\.vue"\)/);
    assert.match(navigationSource, /_diyFormDialogWarmupPromise/);
    assert.match(stateSource, /requestIdleCallback/);
    assert.match(stateSource, /timeout:\s*1500/);
    assert.match(cleanupSource, /cancelIdleCallback/);
});
