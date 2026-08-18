import assert from "node:assert/strict";
import test from "node:test";
import { hasScalarRecordId, normalizeRecordId } from "../src/utils/record-id.js";

test("record ids accept scalar values and reject transport-breaking objects", () => {
    assert.equal(normalizeRecordId("  row-id  "), "row-id");
    assert.equal(normalizeRecordId(123), "123");
    assert.equal(normalizeRecordId({}), "");
    assert.equal(normalizeRecordId([]), "");
    assert.equal(normalizeRecordId(null), "");
    assert.equal(hasScalarRecordId({ Id: "nested" }), false);
});
