import assert from "node:assert/strict";
import test from "node:test";

import {
    buildColumnPreferenceCacheKey,
    invertVisibleColumnKeys,
    normalizeHiddenColumnKeys,
    setColumnKeyVisible,
    tableAuditPreferenceKey,
    tableFieldPreferenceKey
} from "../src/views/form-engine/utils/user-table-column-preference.js";

test("normalizes and bounds hidden table column keys", () => {
    assert.deepEqual(
        normalizeHiddenColumnKeys(["field:field-a", "field:field-a", "audit:CreateTime", "unsafe key", ""]),
        ["field:field-a", "audit:CreateTime"]
    );
    assert.deepEqual(normalizeHiddenColumnKeys('{"HiddenColumnKeys":["field:a"]}'), ["field:a"]);
});

test("toggles and inverts visible columns without mutating module defaults", () => {
    assert.deepEqual(setColumnKeyVisible(["field:a"], "field:a", true), []);
    assert.deepEqual(setColumnKeyVisible([], "field:a", false), ["field:a"]);
    assert.deepEqual(
        invertVisibleColumnKeys(["field:b"], ["field:a", "field:b", "audit:CreateTime"]),
        ["field:a", "audit:CreateTime"]
    );
});

test("uses stable field, audit and per-tenant cache keys", () => {
    assert.equal(tableFieldPreferenceKey({ Id: "f-1", Name: "Name" }), "field:f-1");
    assert.equal(tableAuditPreferenceKey("UpdateTime"), "audit:UpdateTime");
    assert.notEqual(
        buildColumnPreferenceCacheKey({ osClient: "a", userId: "u", sysMenuId: "m" }),
        buildColumnPreferenceCacheKey({ osClient: "b", userId: "u", sysMenuId: "m" })
    );
});
