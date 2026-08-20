import assert from "node:assert/strict";
import test from "node:test";
import {
    isFormMaskBlurDisabled,
    isFormMaskBlurEnabled
} from "../src/utils/form-mask-blur.js";

test("new FormMaskBlur setting is opt-in and defaults to disabled", function () {
    assert.equal(isFormMaskBlurEnabled({}), false);
    assert.equal(isFormMaskBlurEnabled({ FormMaskBlur: null }), false);
    assert.equal(isFormMaskBlurEnabled({ FormMaskBlur: 0 }), false);
    assert.equal(isFormMaskBlurEnabled({ FormMaskBlur: "false" }), false);
    assert.equal(isFormMaskBlurEnabled({ FormMaskBlur: 1 }), true);
    assert.equal(isFormMaskBlurEnabled({ FormMaskBlur: "true" }), true);
    assert.equal(isFormMaskBlurDisabled({ FormMaskBlur: 0 }), true);
});

test("new setting wins while legacy DisableFormMaskBlur remains compatible", function () {
    assert.equal(isFormMaskBlurEnabled({ DisableFormMaskBlur: 0 }), true);
    assert.equal(isFormMaskBlurEnabled({ DisableFormMaskBlur: 1 }), false);
    assert.equal(isFormMaskBlurEnabled({ FormMaskBlur: 0, DisableFormMaskBlur: 0 }), false);
    assert.equal(isFormMaskBlurEnabled({ FormMaskBlur: 1, DisableFormMaskBlur: 1 }), true);
    assert.equal(isFormMaskBlurEnabled({ FormMaskBlur: "", DisableFormMaskBlur: 0 }), true);
});
