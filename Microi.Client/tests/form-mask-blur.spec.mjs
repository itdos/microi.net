import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("all Element Plus dialogs and message boxes inherit the explicit global blur setting", async function () {
    const runtime = await readFile(new URL("../src/utils/mci-dialog-runtime.js", import.meta.url), "utf8");
    const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
    const styles = await readFile(new URL("../src/styles/mci-design.scss", import.meta.url), "utf8");

    assert.match(runtime, /isFormMaskBlurEnabled\(getSysConfig\(\)\s*\|\|\s*\{\}\)/);
    assert.match(runtime, /"mci-global-overlay--plain"/);
    assert.match(runtime, /querySelectorAll\("\.el-overlay, \.el-overlay-message-box"\)/);
    assert.match(runtime, /node\.matches\("\.el-overlay, \.el-overlay-message-box"\)/);
    assert.match(runtime, /applyGlobalMaskBlurClass\(overlay\)/);
    assert.match(runtime, /applyGlobalMaskBlurClass\(wrapper\)/);
    assert.match(main, /installMciDialogRuntime\(\{\s*getSysConfig:/);
    assert.match(main, /refreshMciDialogMaskBlur/);
    assert.match(styles, /\.el-overlay\.mci-global-overlay--plain[\s\S]*?backdrop-filter:\s*none\s*!important/);
    assert.match(styles, /\.el-overlay-message-box\.mci-global-overlay--plain[\s\S]*?backdrop-filter:\s*none\s*!important/);
});
