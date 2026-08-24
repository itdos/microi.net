import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

test("all confirmation message boxes receive the Microi rounded dialog contract", function () {
    const common = read("src/utils/diy.common.js");
    const runtime = read("src/utils/mci-dialog-runtime.js");
    const style = read("src/styles/mci-design.scss");

    assert.match(common, /customClass:\s*\[option\.CustomClass,\s*"mci-unified-message-box"\]/);
    assert.match(runtime, /function enhanceMciMessageBox/);
    assert.match(runtime, /querySelectorAll\("\.el-message-box"\)/);
    assert.match(style, /\.el-message-box\.mci-unified-message-box[\s\S]*?border-radius:\s*24px\s*!important/);
    assert.match(style, /\.el-message-box__header[\s\S]*?&::before/);
    assert.match(style, /\.el-message-box__btns[\s\S]*?height:\s*44px/);
});
