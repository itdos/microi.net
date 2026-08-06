import assert from "node:assert/strict";
import test from "node:test";

import {
    buildIdBackedTreeFilterOptions,
    isIdBackedTreeFilterField
} from "../src/views/form-engine/mixins/column-filter-options.js";

const departmentField = {
    Component: "Department",
    Config: { Department: { EmitPath: false } },
    Data: [
        {
            Id: "root-id",
            Name: "制造中心",
            _Child: [
                { Id: "device-id", Name: "设备部", _Child: [] }
            ]
        }
    ]
};

test("treats leaf-id department fields as readable option filters", () => {
    assert.equal(isIdBackedTreeFilterField(departmentField), true);
    assert.deepEqual(buildIdBackedTreeFilterOptions(departmentField), [
        { label: "制造中心", value: "root-id" },
        { label: "设备部", value: "device-id" }
    ]);
});

test("does not rewrite path-backed department storage as leaf-id filtering", () => {
    const pathField = {
        ...departmentField,
        Config: { Department: { EmitPath: true } }
    };

    assert.equal(isIdBackedTreeFilterField(pathField), false);
    assert.deepEqual(buildIdBackedTreeFilterOptions(pathField), []);
});
