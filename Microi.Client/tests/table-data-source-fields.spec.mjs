import assert from "node:assert/strict";
import test from "node:test";

import {
    collectMenuFieldReferenceIds,
    hasFieldReference,
    selectTableDataSourceFields
} from "../src/views/form-engine/mixins/table-field-data-source.js";

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
