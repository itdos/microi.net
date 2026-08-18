import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    createDynamicRouteRematch,
    shouldStartInitialRouteLoading
} from "../src/router/navigation-state.js";
import { DEFAULT_TAB_ICONS, resolveTabIcon } from "../src/utils/tab-icon.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testDir, "..");
const read = relativePath => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

test("dynamic menu rematch drops the provisional 404 route identity", () => {
    const target = createDynamicRouteRematch({
        path: "/api-engine",
        fullPath: "/api-engine?view=all#anchor",
        query: { view: "all" },
        hash: "#anchor",
        name: "page_404",
        matched: [{ name: "page_404" }],
        redirectedFrom: { path: "/" }
    });

    assert.deepEqual(target, {
        path: "/api-engine",
        query: { view: "all" },
        hash: "#anchor",
        replace: true
    });
    assert.equal("name" in target, false);
    assert.equal("matched" in target, false);
});

test("route skeleton is cold-start only after the platform shell mounts", () => {
    assert.equal(shouldStartInitialRouteLoading({ matched: [] }, false), true);
    assert.equal(shouldStartInitialRouteLoading({ matched: [{ path: "/" }] }, false), false);
    assert.equal(shouldStartInitialRouteLoading({ matched: [] }, true), false);
});

test("permission guard re-resolves dynamic routes by URL and preserves the mounted shell", () => {
    const permission = read("src/permission.js");
    assert.match(permission, /createDynamicRouteRematch/);
    assert.match(permission, /shouldStartInitialRouteLoading\(from, shellMounted\)/);
    assert.match(permission, /#tags-view-container-microi, \.app-main-microi/);
    assert.doesNotMatch(permission, /next\(\{\s*\.\.\.to,\s*replace:\s*true\s*\}\)/);
});

test("horizontal workspace, module and form tabs expose the animated Element Plus active bar", () => {
    const design = read("src/styles/mci-design.scss");
    const tags = read("src/layout/components/TagsView/index.vue");
    const fieldTabs = read("src/views/form-engine/diy-field-component/diy-tabs.vue");

    assert.match(design, /\.mci-tabs:not\(\.el-tabs--left\):not\(\.el-tabs--right\)[\s\S]*?\.el-tabs__active-bar[\s\S]*?display:\s*block/);
    assert.match(design, /\.el-tabs__active-bar[\s\S]*?transition:\s*width \.3s cubic-bezier[\s\S]*?transform \.3s cubic-bezier/);
    assert.match(design, /\.mci-tabs\.el-tabs--left,[\s\S]*?\.el-tabs__active-bar[\s\S]*?display:\s*none/);
    assert.match(tags, /\.el-tabs__active-bar\s*\{\s*display:\s*block/);
    assert.match(fieldTabs, /:deep\(\.el-tabs__active-bar\)[\s\S]*?display:\s*block[\s\S]*?transition:/);
});

test("platform tabs preserve configured icons and provide ten distinct defaults", () => {
    const design = read("src/styles/mci-design.scss");
    const tags = read("src/layout/components/TagsView/index.vue");
    const table = read("src/views/form-engine/diy-table.vue");
    const form = read("src/views/form-engine/diy-form.vue");
    const fieldTabs = read("src/views/form-engine/diy-field-component/diy-tabs.vue");
    const iconPicker = read("src/views/form-engine/diy-field-component/diy-fontawesome.vue");

    assert.equal(DEFAULT_TAB_ICONS.length, 10);
    assert.equal(new Set(DEFAULT_TAB_ICONS).size, 10);
    assert.equal(resolveTabIcon("fas fa-star", 4), "fas fa-star");
    assert.equal(resolveTabIcon("", 0), DEFAULT_TAB_ICONS[0]);
    assert.equal(resolveTabIcon(null, 10), DEFAULT_TAB_ICONS[0]);
    assert.match(tags, /ResolveTabIcon\(tab\.meta && tab\.meta\.icon, index\)/);
    assert.match(table, /ResolveTabIcon\(tab\.Icon, tabIndex\)/);
    assert.match(form, /ResolveTabIcon\(tab\.Icon, tabIndex\)/);
    assert.match(fieldTabs, /resolveTabIcon\(pane\.Icon, paneIndex\)/);
    assert.match(iconPicker, /<fa-icon\s+:icon="[^"]*ModelValue[^"]*"/);
    assert.match(design, /\.el-tabs__item[\s\S]*?display:\s*inline-flex[\s\S]*?align-items:\s*center/);
});

test("field configuration headers show both table label and physical table name", () => {
    const runtime = read("src/utils/mci-dialog-runtime.js");
    const designerMixin = read("src/views/form-engine/mixins/diy-form-designer.mixin.js");
    const designer = read("src/views/form-engine/diy-design.vue");
    const simpleDialog = read("src/views/form-engine/diy-field-component/shared/DiySimpleFieldConfigDialog.vue");

    assert.match(runtime, /context\.tableName[\s\S]*?表名：\$\{context\.tableName\}/);
    assert.match(runtime, /staleFieldSummary[\s\S]*?requestAnimationFrame\(flushPendingDialogs\)/);
    assert.match(runtime, /runtimeObserver\.observe\(document\.body,[\s\S]*?childList:\s*true/);
    assert.match(runtime, /attributes:\s*true[\s\S]*?attributeFilter:\s*\["class"\]/);
    assert.doesNotMatch(runtime, /characterData:\s*true/);
    assert.match(designerMixin, /buildDialogContext[\s\S]*?tableName:\s*tableModel\.Name\s*\|\|\s*self\.TableName/);
    assert.match(designer, /表名：\{\{ CurrentDiyTableModel\.Name \}\}/);
    assert.match(simpleDialog, /表名：\{\{ physicalTableName \}\}/);
});
