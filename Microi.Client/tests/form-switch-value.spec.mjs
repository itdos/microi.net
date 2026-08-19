import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFormSwitchValue } from "../src/utils/form-switch-value.js";

test("FormEngine Switch strictly normalizes numeric, boolean and legacy string values", () => {
    for (const value of [1, true, "1", " true ", "TRUE"]) {
        assert.equal(normalizeFormSwitchValue(value), 1, `${JSON.stringify(value)} should be enabled`);
    }

    for (const value of [0, false, "0", " false ", "", null, undefined, 2, "yes"]) {
        assert.equal(normalizeFormSwitchValue(value), 0, `${JSON.stringify(value)} should be disabled`);
    }
});
