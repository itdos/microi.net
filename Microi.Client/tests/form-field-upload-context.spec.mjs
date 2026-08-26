import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    appendFormFieldUploadContext,
    buildFormFieldUploadContext
} from "../src/utils/form-field-upload-context.js";

test("form field upload context carries authoritative lookup and authorization clues", () => {
    const tableChildAuth = {
        ParentSysMenuId: "parent-menu",
        ParentRowId: "parent-row"
    };
    const context = buildFormFieldUploadContext({
        field: { Id: "field-1", Name: "Cover", TableId: "table-id" },
        diyTableModel: { Id: "table-id", Name: "article" },
        formData: { Id: "row-from-model" },
        tableRowId: "row-explicit",
        sysMenuId: "menu-1",
        tableChildAuth
    });

    assert.deepEqual(context, {
        FormEngineKey: "article",
        FieldId: "field-1",
        FormDataId: "row-explicit",
        SysMenuId: "menu-1",
        _TableChildAuth: JSON.stringify(tableChildAuth)
    });
});

test("multipart helper omits empty optional values and serializes table child context", () => {
    const entries = [];
    const formData = { append: (name, value) => entries.push([name, value]) };

    appendFormFieldUploadContext(formData, {
        field: { Name: "Attachment", TableId: "table-id" },
        tableChildAuth: { ParentRowId: "parent-row" }
    });

    assert.deepEqual(entries, [
        ["FormEngineKey", "table-id"],
        ["FieldId", "Attachment"],
        ["_TableChildAuth", JSON.stringify({ ParentRowId: "parent-row" })]
    ]);
});

test("file, image and rich text uploads all attach the verified field context", async () => {
    const componentRoot = new URL(
        "../src/views/form-engine/diy-field-component/",
        import.meta.url
    );
    const [fileSource, imageSource, richTextSource] = await Promise.all([
        readFile(new URL("diy-fileupload.vue", componentRoot), "utf8"),
        readFile(new URL("diy-imgupload.vue", componentRoot), "utf8"),
        readFile(new URL("diy-richtext.vue", componentRoot), "utf8")
    ]);

    assert.match(fileSource, /\.\.\.getFormFieldUploadContext\(\)/);
    assert.match(fileSource, /buildFormFieldUploadContext\(\{/);
    assert.match(imageSource, /appendFormFieldUploadContext\(formData,\s*\{/);
    assert.match(richTextSource, /appendFormFieldUploadContext\(formData,\s*\{/);
});
