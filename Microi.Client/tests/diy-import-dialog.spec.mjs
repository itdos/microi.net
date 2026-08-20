import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "@vue/compiler-sfc";

const dialogPath = new URL(
    "../src/views/form-engine/diy-components/DiyImportDialog.vue",
    import.meta.url
);
const dialogSource = await readFile(dialogPath, "utf8");
const tableSource = await readFile(
    new URL("../src/views/form-engine/diy-table.vue", import.meta.url),
    "utf8"
);
const designSource = await readFile(
    new URL("../src/styles/mci-design.scss", import.meta.url),
    "utf8"
);

test("custom import dialog remains a valid Vue SFC", () => {
    const result = parse(dialogSource, { filename: "DiyImportDialog.vue" });
    assert.deepEqual(result.errors, []);
    assert.ok(result.descriptor.template);
    assert.ok(result.descriptor.script);
});

test("dialog uses the centered large-radius platform shell with visible actions", () => {
    assert.match(dialogSource, /class="mci-unified-dialog mci-import-dialog"/);
    assert.match(dialogSource, /align-center/);
    assert.match(dialogSource, /:modal="true"/);
    assert.match(dialogSource, /:close-on-click-modal="false"/);
    assert.match(designSource, /> \.el-dialog__header > \.el-dialog__headerbtn[\s\S]*?width: 40px;[\s\S]*?background:/);
    assert.match(designSource, /> \.el-dialog__footer[\s\S]*?min-width: 96px;[\s\S]*?height: 42px;/);
});

test("page V8 can open one declarative workbook import bridge", () => {
    assert.match(tableSource, /V8\.OpenImportDialog = function\(options\)/);
    assert.match(tableSource, /refDiyImportDialog/);
    assert.match(dialogSource, /Workbook \|\| \{\}/);
    assert.match(dialogSource, /DataStartRow/);
    assert.match(dialogSource, /DataEndRow/);
    assert.match(dialogSource, /KeyField/);
    assert.match(dialogSource, /_ImportRowsJson/);
    assert.match(dialogSource, /_ImportMetaJson/);
});

test("custom imports submit a persistent background task and poll real status", () => {
    assert.match(dialogSource, /ApiEngine\.RunBackground/);
    assert.match(dialogSource, /\/api\/BackgroundTask\/List/);
    assert.match(dialogSource, /microi-background-task-started/);
    assert.match(dialogSource, /task\.Current/);
    assert.match(dialogSource, /task\.Total/);
    assert.match(dialogSource, /TERMINAL_TASK_STATUSES/);
});

test("legacy table import remains available when no custom options are supplied", () => {
    assert.match(dialogSource, /v-if="isCustomImport"/);
    assert.match(dialogSource, /v-else[\s\S]*?:action="importApi"/);
    assert.match(dialogSource, /ImportDiyTableRow/);
    assert.match(dialogSource, /getImportProgress/);
});
