import assert from "node:assert/strict";
import test from "node:test";

import { normalizeNotShowFields } from "../src/views/form-engine/utils/not-show-fields.js";

test("filters null, blank and invalid NotShowFields entries", () => {
    assert.deepEqual(
        normalizeNotShowFields([
            null,
            "",
            "  ",
            1,
            false,
            [],
            {},
            { Label: "invalid" },
            " FieldA ",
            { Name: " FieldB ", Label: "字段 B" },
            { Id: " field-c ", Name: "" }
        ]),
        [
            "FieldA",
            { Name: "FieldB", Label: "字段 B" },
            { Id: "field-c" }
        ]
    );
});

test("accepts persisted JSON and fails closed for malformed roots", () => {
    assert.deepEqual(normalizeNotShowFields('[null,"Code",{"Name":"Name"}]'), [
        "Code",
        { Name: "Name" }
    ]);
    assert.deepEqual(normalizeNotShowFields('{"Name":"not-an-array"}'), []);
    assert.deepEqual(normalizeNotShowFields("not-json"), []);
    assert.deepEqual(normalizeNotShowFields(null), []);
});
