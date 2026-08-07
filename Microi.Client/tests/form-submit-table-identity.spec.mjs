import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formFile = new URL("../src/views/form-engine/diy-form.vue", import.meta.url);

test("form submit keeps a non-empty table identity when protected metadata omits Name", async () => {
    const source = await readFile(formFile, "utf8");

    assert.match(
        source,
        /param\.FormEngineKey\s*=\s*\[\s*self\.DiyTableModel\s*&&\s*self\.DiyTableModel\.Name,\s*self\.TableName,\s*self\.TableId\s*\]\.find/u,
        "submit should fall back from the table model name to TableName and TableId"
    );
    assert.match(source, /if\s*\(self\.DiyCommon\.IsNull\(param\.FormEngineKey\)\)/u);
    assert.match(source, /param\._TableId\s*=\s*self\.TableId/u);
    assert.doesNotMatch(
        source,
        /param\.FormEngineKey\s*=\s*self\.DiyTableModel\.Name\s*;/u,
        "submit must not send an empty table name when the protected metadata projection omits Name"
    );
});
