import assert from "node:assert/strict";
import test from "node:test";
import {
    hasScalarRecordId,
    normalizeRecordId,
    shouldReuseRecordWorkbenchRoute
} from "../src/utils/record-id.js";

test("record ids accept scalar values and reject transport-breaking objects", () => {
    assert.equal(normalizeRecordId("  row-id  "), "row-id");
    assert.equal(normalizeRecordId(123), "123");
    assert.equal(normalizeRecordId({}), "");
    assert.equal(normalizeRecordId([]), "");
    assert.equal(normalizeRecordId(null), "");
    assert.equal(hasScalarRecordId({ Id: "nested" }), false);
});

test("record workbench query changes reuse one module tab", () => {
    assert.equal(shouldReuseRecordWorkbenchRoute({ query: { RecordId: "row-1" }, meta: {} }), true);
    assert.equal(shouldReuseRecordWorkbenchRoute({ query: { ViewMode: "Table" }, meta: {} }), true);
    assert.equal(shouldReuseRecordWorkbenchRoute({ query: {}, meta: {} }), false);
    assert.equal(shouldReuseRecordWorkbenchRoute({
        query: { RecordId: "row-1" },
        meta: { microAppHost: true }
    }), false);
});
