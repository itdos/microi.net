import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, "..");
const readSource = (relativePath) => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

test("the platform dialog runtime gives every Element Plus dialog one viewport contract", () => {
    const runtime = readSource("src/utils/mci-dialog-runtime.js");
    const styles = readSource("src/styles/mci-design.scss");

    assert.match(runtime, /dialog\.classList\.add\("mci-unified-dialog",\s*"mci-native-title-dialog"\)/);
    assert.match(runtime, /node\.matches\("\.el-dialog"\)\)\s*enhanceMciDialog\(node\)/);
    assert.match(styles, /:where\([\s\S]*?\.el-dialog\.mci-unified-dialog[\s\S]*?\)\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
    assert.match(styles, /:where\([\s\S]*?\.el-dialog\.mci-unified-dialog[\s\S]*?\)\s*>\s*:where\(\.el-dialog__header,\s*\.el-dialog__footer\)\s*\{[\s\S]*?flex:\s*0 0 auto;/);
    assert.match(styles, /:where\([\s\S]*?\.el-dialog\.mci-unified-dialog[\s\S]*?\)\s*>\s*:where\(\.el-dialog__body\)\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
    assert.match(styles, /\.el-dialog\.mci-unified-dialog,[\s\S]*?max-height:\s*calc\(100vh - 32px\);[\s\S]*?max-height:\s*calc\(100dvh - 32px\);[\s\S]*?margin:\s*auto;/);
    assert.match(styles, /\.mci-unified-overlay\s*>\s*\.el-overlay-dialog\s*\{[\s\S]*?overflow:\s*auto;/);
});

test("long form dialogs delegate scrolling to the dialog body while drawers keep their own body scroller", () => {
    const form = readSource("src/views/form-engine/diy-form-full.vue");
    const formStyles = readSource("src/views/form-engine/styles/diy-form-full.global.scss");

    assert.match(form, /class="diy-form-container diy-form-modern-dialog"/);
    assert.match(form, /class="clear diy-form-dialog-scroll-content"/);
    assert.match(formStyles, /\.diy-form-container\.el-dialog\.diy-form-modern-dialog[\s\S]*?\.diy-form-dialog-scroll-content[\s\S]*?overflow-y:\s*visible !important;/);
    assert.match(formStyles, /\.diy-form-container\.el-drawer\.diy-form-modern-drawer[\s\S]*?> \.el-drawer__body\s*\{[\s\S]*?overflow-y:\s*auto;/);
});
