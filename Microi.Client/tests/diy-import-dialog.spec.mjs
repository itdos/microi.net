import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "@vue/compiler-sfc";
import { parse as parseScript } from "@babel/parser";
import vm from "node:vm";

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

function progressHarness() {
    const script = parse(dialogSource).descriptor.script.content;
    const exported = parseScript(script, { sourceType: "module" }).program.body.find(node => node.type === "ExportDefaultDeclaration").declaration;
    const methods = exported.properties.find(node => node.key.name === "methods").value.properties;
    const names = ["stopImportProgressPolling", "getImportProgress", "handleUploadSuccess", "handleDialogClosed", "handleFileChange"];
    const callbacks = [], timers = new Map(), emitted = [];
    let id = 0;
    const context = vm.createContext({
        setTimeout: callback => { timers.set(++id, callback); return id; },
        clearTimeout: key => timers.delete(key)
    });
    const bound = vm.runInContext(`({${methods.filter(node => names.includes(node.key.name)).map(node => script.slice(node.start, node.end)).join(",")}})`, context);
    const state = {
        ...bound, visible: true, legacyImportRunning: false, legacyProgressGeneration: 0,
        submitting: true, uploadSucceeded: false, tableId: "fixture", importProgressApi: "/progress",
        appendMenuContext: value => value, stopBackgroundTaskPolling() {},
        $emit: (...args) => emitted.push(args), $t: value => value,
        DiyCommon: { Post: (_url, _params, callback) => callbacks.push(callback), Result: result => result.Code === 1, IsNull: value => value == null }
    };
    return { state, callbacks, timers, emitted, tick() { const [key, callback] = timers.entries().next().value; timers.delete(key); callback(); } };
}

test("accepted background imports keep polling and refresh the list only after commit", () => {
    const h = progressHarness();
    h.state.handleUploadSuccess({ Code: 1 });
    assert.equal(h.state.legacyImportRunning, true);
    assert.equal(h.state.uploadSucceeded, false);
    assert.equal(h.emitted.length, 0);
    h.callbacks.shift()({ Code: 1, Data: ["已处理 614/747 条", "校验通过，正在写入数据"] });
    assert.equal(h.timers.size, 1);
    h.tick();
    h.callbacks.shift()({ Code: 1, Data: ["747 条数据已全部成功结束"] });
    assert.equal(h.state.legacyImportRunning, false);
    assert.equal(h.state.uploadSucceeded, true);
    assert.equal(h.emitted.length, 1);
    assert.equal(h.timers.size, 0);
    h.state.getImportProgress();
    h.callbacks.shift()({ Code: 1, Data: ["已全部成功结束"] });
    assert.equal(h.emitted.length, 1);
});

test("failed imports stop without success and partial commits refresh exactly once", () => {
    for (const [message, success] of [["导入已失败！全部回滚", false], ["已按用户选择跳过错误行，其余成功行均已提交", true]]) {
        const h = progressHarness();
        h.state.handleUploadSuccess({ Code: 1 });
        h.callbacks.shift()({ Code: 1, Data: [message] });
        assert.equal(h.state.legacyImportRunning, false);
        assert.equal(h.state.uploadSucceeded, success);
        assert.equal(h.emitted.length, success ? 1 : 0);
        assert.equal(h.timers.size, 0);
    }
});

test("closing the dialog or requesting fresher progress discards in-flight responses", () => {
    const h = progressHarness();
    h.state.handleUploadSuccess({ Code: 1 });
    const stale = h.callbacks.shift();
    h.state.getImportProgress();
    stale({ Code: 1, Data: ["已全部成功结束"] });
    assert.equal(h.emitted.length, 0);
    h.state.handleDialogClosed();
    h.callbacks.shift()({ Code: 1, Data: ["已全部成功结束"] });
    assert.equal(h.emitted.length, 0);
    assert.equal(h.timers.size, 0);
});

test("upload status changes do not erase the background job or parse its workbook again", async () => {
    const h = progressHarness();
    h.state.clearImportState = () => { throw new Error("Active import was reset"); };
    h.state.handleUploadSuccess({ Code: 1 });
    for (const status of ["uploading", "success", "fail"]) {
        await h.state.handleFileChange({ status, raw: { name: "747-rows.xls" } });
    }
    assert.equal(h.state.legacyImportRunning, true);
    assert.equal(h.callbacks.length, 1);
    assert.equal(h.state.uploadResult.Code, 1);
});

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
    assert.doesNotMatch(designSource, /\.el-dialog\.mci-import-dialog[\s\S]*?max-width:\s*1480px/);
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
    assert.match(dialogSource, /parsedImport\.sourceRows/);
    assert.match(dialogSource, /column\.sourceKey/);
    assert.match(dialogSource, /ImportUnmatchedColumnTip/);
});

test("the original workbook is always available independently of field matching", () => {
    assert.match(dialogSource, /VueOfficeExcel/);
    assert.match(dialogSource, /@vue-office\/excel\/lib\/index\.css/);
    assert.match(dialogSource, /ImportOriginalWorkbook/);
    assert.match(dialogSource, /workbookPreviewSource/);
    assert.match(dialogSource, /normalizeXlsxPreviewArrayBuffer/);
    assert.match(dialogSource, /extension === "xlsx"[\s\S]*?normalizeXlsxPreviewArrayBuffer\(fileBuffer\)/);
    assert.match(dialogSource, /parsedImport \|\| workbookPreviewSource/);
    assert.match(designSource, /\.mci-import-dialog__raw-workbook/);
    assert.match(designSource, /\.mci-import-dialog__preview-head[\s\S]*?&\.is-unmatched/);
});

test("Excel and UTF-8 or GBK CSV files use the shared preview and import pipeline", () => {
    assert.match(dialogSource, /\.xls,\.xlsx,\.csv/);
    assert.match(dialogSource, /decodeCsvArrayBuffer/);
    assert.match(dialogSource, /FS: csv\.delimiter/);
    assert.match(dialogSource, /_ImportEncoding/);
    assert.match(dialogSource, /_ImportDelimiter/);
});

test("confirmed standard import uploads the original file with the exact server parse contract", () => {
    assert.match(dialogSource, /workbookUpload/);
    assert.match(dialogSource, /uploader\.submit\(\)/);
    assert.match(dialogSource, /_ImportSheetIndex/);
    assert.match(dialogSource, /_ImportHeaderStartRow/);
    assert.match(dialogSource, /_ImportDataStartRow/);
    assert.match(dialogSource, /_ImportColumnsJson/);
    assert.match(dialogSource, /_ImportMetaJson/);
    assert.match(dialogSource, /_ImportErrorPolicy/);
    assert.match(dialogSource, /_ImportIdempotencyKey/);
    assert.match(dialogSource, /importIdempotencyKey = this\.DiyCommon\.NewGuid\(\)/);
    assert.match(dialogSource, /ImportDiyTableRow/);
    assert.match(tableSource, /:diyFieldList="DiyFieldList"/);
    assert.match(tableSource, /:diyTableModel="CurrentDiyTableModel"/);
});

test("users choose rollback or continue and see authoritative table unique rules before upload", () => {
    assert.match(dialogSource, /IMPORT_ERROR_POLICY\.ROLLBACK_ALL/);
    assert.match(dialogSource, /IMPORT_ERROR_POLICY\.CONTINUE_ON_ERROR/);
    assert.match(dialogSource, /v-model="errorPolicy"/);
    assert.match(dialogSource, /buildDiyFieldUniqueRules/);
    assert.match(dialogSource, /ImportUniqueRules/);
    assert.match(dialogSource, /ImportNoUniqueRules/);
    assert.match(dialogSource, /uniqueRuleText/);
    assert.match(dialogSource, /requiresAtomicImport/);
    assert.match(dialogSource, /\^ApiEngine:/);
    assert.match(designSource, /\.mci-import-dialog__policy-grid/);
    assert.match(designSource, /\.mci-import-dialog__unique-rules/);
});

test("page V8 retains the declarative background import bridge with the same preview", () => {
    assert.match(tableSource, /V8\.OpenImportDialog = function\(options\)/);
    assert.match(tableSource, /refDiyImportDialog/);
    assert.match(dialogSource, /Workbook \|\| \{\}/);
    assert.match(dialogSource, /_ImportRowsJson/);
    assert.match(dialogSource, /_ImportMetaJson/);
    assert.match(dialogSource, /_ImportUniqueRulesJson/);
    assert.match(dialogSource, /_ImportErrorPolicy/);
    assert.match(dialogSource, /ApiEngine\.RunBackground/);
    assert.match(dialogSource, /\/apiengine\/platform-background-task/);
    assert.match(dialogSource, /microi-background-task-started/);
    assert.match(dialogSource, /TERMINAL_TASK_STATUSES/);
});
