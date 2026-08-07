import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    getFileIcon,
    isPrivateUploadField,
    isSpecialTableField,
    normalizeUploadItems,
    stripHtmlText,
    summarizeJsonValue
} from "../src/views/form-engine/utils/table-special-field.js";

test("normalizes legacy single and multiple upload values", () => {
    assert.deepEqual(normalizeUploadItems("/files/a.pdf").map(item => item.Name), ["a.pdf"]);
    assert.deepEqual(
        normalizeUploadItems(JSON.stringify([
            { Path: "/files/a.png", Name: "封面.png" },
            { FilePathName: "/files/b.png", FileName: "详情.png" }
        ])).map(item => [item.Path, item.Name]),
        [["/files/a.png", "封面.png"], ["/files/b.png", "详情.png"]]
    );
    assert.equal(normalizeUploadItems({ Url: "https://api.itdos.com/api/HDFS/OpenPrivateFile?o=iTdos&t=abc" })[0].Path.includes("OpenPrivateFile"), true);
});

test("detects private upload fields without treating ordinary uploads as private", () => {
    assert.equal(isPrivateUploadField({ Component: "ImgUpload", Config: { ImgUpload: { Limit: true } } }), true);
    assert.equal(isPrivateUploadField({ Component: "FileUpload", Config: JSON.stringify({ FileUpload: { Limit: "true" } }) }), true);
    assert.equal(isPrivateUploadField({ Component: "ImgUpload", Config: { ImgUpload: { Multiple: true } } }), false);
});

test("covers special field components and useful previews", () => {
    for (const component of ["ImgUpload", "FileUpload", "TableChild", "Map", "Qrcode", "RichText", "JsonTable", "Progress", "Rate", "Switch"]) {
        assert.equal(isSpecialTableField({ Component: component }), true, component);
    }
    assert.equal(getFileIcon({ Name: "合同.pdf" }), "far fa-file-pdf");
    assert.equal(stripHtmlText("<p>正文 <strong>内容</strong></p>"), "正文 内容");
    assert.equal(summarizeJsonValue('[{"Id":1},{"Id":2}]').label, "2 行数据");
});

test("diy table uses the shared special-cell renderer in table and card modes", async () => {
    const source = await readFile(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
    assert.match(source, /<DiyTableSpecialCell[\s\S]*@open-table-child="OpenTableChildCell"/);
    assert.match(source, /v-safe-html:template=/);
    assert.match(source, /typeof OpenAnyTableParam\.SubmitEvent === 'function'/);
});
