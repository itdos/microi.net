import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCascaderModelValue } from "../src/views/form-engine/diy-field-component/diy-cascader-value.js";

test("parses a persisted multi-path value when form data arrives after mount", () => {
    const stored = '[["滨海工厂","9#楼","9#1F","喷塑车间"]]';

    assert.deepEqual(
        normalizeCascaderModelValue(stored, { multiple: true, emitPath: true }),
        [["滨海工厂", "9#楼", "9#1F", "喷塑车间"]]
    );
});

test("keeps a scalar value when emitPath is disabled", () => {
    assert.equal(
        normalizeCascaderModelValue("喷塑车间", { multiple: false, emitPath: false }),
        "喷塑车间"
    );
});

test("uses the correct empty value shape for multiple cascaders", () => {
    assert.deepEqual(normalizeCascaderModelValue(null, { multiple: true }), []);
    assert.equal(normalizeCascaderModelValue(undefined, { multiple: false }), "");
});
