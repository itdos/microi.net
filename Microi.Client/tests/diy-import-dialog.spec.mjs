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

test("smart import dialog remains a valid Vue SFC", () => {
    const result = parse(dialogSource, { filename: "DiyImportDialog.vue" });
    assert.deepEqual(result.errors, []);
    assert.ok(result.descriptor.template);
    assert.ok(result.descriptor.script);
});

test("dialog uses the platform shell and defaults to eighty percent width", () => {
    assert.match(dialogSource, /class="mci-unified-dialog mci-import-dialog"/);
    assert.match(dialogSource, /align-center/);
    assert.match(dialogSource, /:modal="true"/);
    assert.match(dialogSource, /:close-on-click-modal="false"/);
    assert.match(dialogSource, /\|\| "80%"/);
    assert.match(designSource, /\.el-dialog\.mci-import-dialog[\s\S]*?width: 80% !important;/);
    assert.match(designSource, /> \.el-dialog__header > \.el-dialog__headerbtn[\s\S]*?width: 40px;[\s\S]*?background:/);
});

test("all imports parse first and expose manual ranges, mapping, and fifteen-row pagination", () => {
    assert.match(dialogSource, /:auto-upload="false"/);
    assert.match(dialogSource, /analyzeExcelWorkbook/);
    assert.match(dialogSource, /ImportHeaderStartRow/);
    assert.match(dialogSource, /ImportHeaderEndRow/);
    assert.match(dialogSource, /ImportDataStartRow/);
    assert.match(dialogSource, /ImportDataEndRow/);
    assert.match(dialogSource, /updateColumnMapping/);
    assert.match(dialogSource, /v-model:current-page="previewPage"/);
    assert.match(dialogSource, /IMPORT_PREVIEW_PAGE_SIZE/);
    assert.match(dialogSource, /needsManualReview/);
});

test("confirmed standard import uploads the original file with the exact server parse contract", () => {
    assert.match(dialogSource, /workbookUpload/);
    assert.match(dialogSource, /uploader\.submit\(\)/);
    assert.match(dialogSource, /_ImportSheetIndex/);
    assert.match(dialogSource, /_ImportHeaderStartRow/);
    assert.match(dialogSource, /_ImportDataStartRow/);
    assert.match(dialogSource, /_ImportColumnsJson/);
    assert.match(dialogSource, /_ImportMetaJson/);
    assert.match(dialogSource, /ImportDiyTableRow/);
    assert.match(tableSource, /:diyFieldList="DiyFieldList"/);
});

test("page V8 retains the declarative background import bridge with the same preview", () => {
    assert.match(tableSource, /V8\.OpenImportDialog = function\(options\)/);
    assert.match(tableSource, /refDiyImportDialog/);
    assert.match(dialogSource, /Workbook \|\| \{\}/);
    assert.match(dialogSource, /_ImportRowsJson/);
    assert.match(dialogSource, /_ImportMetaJson/);
    assert.match(dialogSource, /ApiEngine\.RunBackground/);
    assert.match(dialogSource, /\/api\/BackgroundTask\/List/);
    assert.match(dialogSource, /microi-background-task-started/);
    assert.match(dialogSource, /TERMINAL_TASK_STATUSES/);
});
