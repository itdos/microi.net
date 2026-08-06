import assert from "node:assert/strict";
import test from "node:test";

import {
    ensureFieldDataLoaded,
    hasServerBackedFieldData
} from "../src/views/form-engine/diy-field-component/field-data-load-fallback.js";

function sqlField(extra = {}) {
    return {
        Id: "field-1",
        Data: [],
        Config: { DataSource: "Sql", Sql: "select Id, Name from demo" },
        ...extra
    };
}

test("retries an empty field whose reused-form loading flag is stale", () => {
    const calls = [];
    const field = sqlField({ _DataLoading: true, _DataLoadingStartedAt: 1000 });
    const loaded = ensureFieldDataLoaded({
        field,
        formData: { Id: "row-1" },
        tableChildAuth: null,
        diyCommon: { SetFieldsData: (...args) => calls.push(args) },
        now: 4001
    });

    assert.equal(loaded, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][0], [field]);
    assert.deepEqual(calls[0][1], { Id: "row-1" });
});

test("does not duplicate a recent request or reload populated data", () => {
    const calls = [];
    const diyCommon = { SetFieldsData: (...args) => calls.push(args) };

    assert.equal(ensureFieldDataLoaded({
        field: sqlField({ _DataLoading: true, _DataLoadingStartedAt: 3000 }),
        diyCommon,
        now: 4000
    }), false);
    assert.equal(ensureFieldDataLoaded({
        field: sqlField({ Data: [{ Id: "1" }] }),
        diyCommon,
        now: 4000
    }), false);
    assert.equal(calls.length, 0);
});

test("recognizes only configured server-backed data sources", () => {
    assert.equal(hasServerBackedFieldData(sqlField()), true);
    assert.equal(hasServerBackedFieldData({ Data: [], Config: { DataSource: "Data" } }), false);
    assert.equal(hasServerBackedFieldData({ Data: [], Config: { DataSource: "ApiEngine", DataSourceApiEngineKey: "" } }), false);
});
