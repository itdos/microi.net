import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    collectMenuFieldReferenceIds,
    hasFieldReference,
    selectTableDataSourceFields
} from "../src/views/form-engine/mixins/table-field-data-source.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testDir, "..");

test("keeps every primary-table field but filters unrelated joined-table data sources", () => {
    const fields = [
        { Id: "main-select", TableId: "main" },
        { Id: "tenant-name", TableId: "sys-user" },
        { Id: "wx-mp-id", TableId: "sys-user" }
    ];
    const menu = {
        SearchFieldIds: [{ Id: "tenant-name", TableId: "sys-user" }]
    };

    assert.deepEqual(
        selectTableDataSourceFields(fields, "main", menu).map((field) => field.Id),
        ["main-select", "tenant-name"]
    );
});

test("collects field ids from object arrays, id arrays and serialized menu values", () => {
    const ids = collectMenuFieldReferenceIds({
        SelectFields: [{ Id: "select-a" }],
        TableDiyFieldIds: '["column-a"]',
        InTableEditFields: '[{"Id":"editable-a"}]',
        FixedFields: "fixed-a,fixed-b"
    });

    assert.deepEqual(
        [...ids].sort(),
        ["column-a", "editable-a", "fixed-a", "fixed-b", "select-a"]
    );
});

test("matches inline-edit fields across legacy and current storage shapes", () => {
    assert.equal(hasFieldReference('[{"Id":"open-all"}]', "open-all"), true);
    assert.equal(hasFieldReference([{ Id: "open-all" }], "department"), false);
    assert.equal(hasFieldReference(["open-all"], "open-all"), true);
    assert.equal(hasFieldReference("open-all,department", "department"), true);
    assert.equal(hasFieldReference("{invalid-json", "open-all"), false);
});

test("loads asynchronous field data only after the table field list is reactive", () => {
    const source = fs.readFileSync(
        path.join(clientRoot, "src/views/form-engine/mixins/diy-table-schema.mixin.js"),
        "utf8"
    );
    const assignmentIndex = source.indexOf("self.DiyFieldList = result.Data;");
    const dataSourceIndex = source.indexOf(
        "var dataSourceFields = selectTableDataSourceFields(\n                self.DiyFieldList",
        assignmentIndex
    );
    const loadIndex = source.indexOf("self.DiyCommon.SetFieldsData(dataSourceFields", dataSourceIndex);

    assert.ok(assignmentIndex >= 0, "table fields should be assigned to the reactive list");
    assert.ok(dataSourceIndex > assignmentIndex, "data-source fields should be selected from the reactive list");
    assert.ok(loadIndex > dataSourceIndex, "asynchronous data loading should start after reactive assignment");
});
