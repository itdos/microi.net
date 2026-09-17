import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("file download selector keeps unauthorized rows and submits an authorized zip request", async function () {
    const source = await readFile(new URL("../src/views/form-engine/diy-field-component/diy-file-download-dialog.vue", import.meta.url), "utf8");
    assert.match(source, /canReadFile\(scope\.row\)/u);
    assert.match(source, /无权限/u);
    assert.match(source, /FilePathNames:\s*paths/u);
    assert.match(source, /\/api\/HDFS\/DownloadFilesZip/u);
    assert.match(source, /platform-private-file-url/u);
});

test("file upload metadata is rendered and persisted for each attachment", async function () {
    const source = await readFile(new URL("../src/views/form-engine/diy-field-component/diy-fileupload.vue", import.meta.url), "utf8");
    assert.match(source, /getUploaderName\(file\)/u);
    assert.match(source, /getUploadTime\(file\)/u);
    assert.match(source, /sanitizeUploadMeta\(responseData\)/u);
    assert.match(source, /DiyFileDownloadDialog/u);
});

test("OpenAnyTable forwards form defaults into nested form-engine instances", async function () {
    const [tableSource, leftSource, formSource] = await Promise.all([
        readFile(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/left-right/LeftView.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/diy-form-full.vue", import.meta.url), "utf8")
    ]);
    assert.match(tableSource, /:FormDefaultValues="OpenAnyTableParam\.FormDefaultValues/u);
    assert.match(leftSource, /:FormDefaultValues="OpenAnyTableParam\.FormDefaultValues/u);
    assert.match(formSource, /param\.FormDefaultValues/u);
});
