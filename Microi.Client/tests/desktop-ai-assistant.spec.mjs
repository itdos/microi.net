import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const desktopSource = fs.readFileSync(
    path.resolve(testDir, "../src/components/DesktopAiAssistant/index.vue"),
    "utf8"
);
const navbarSource = fs.readFileSync(
    path.resolve(testDir, "../src/layout/components/Navbar.vue"),
    "utf8"
);
const assistantSource = fs.readFileSync(
    path.resolve(testDir, "../src/views/mobile/ai-assistant.vue"),
    "utf8"
);

test("PC navbar exposes the same feature-gated robot entry", () => {
    assert.match(navbarSource, /<DesktopAiAssistant\s*\/>/);
    assert.match(desktopSource, /isMobileAiAssistantEnabled\(diyStore\.SysConfig\)/);
    assert.match(desktopSource, /data-testid="desktop-ai-entry"/);
    assert.match(desktopSource, /src="\/static\/mci\/ai\/assistant-robot\.png"/);
    assert.match(desktopSource, /aria-label="打开AI助手"/);
    assert.doesNotMatch(desktopSource, /吾码\s*AI\s*助手|吾码AI助手/);
});

test("PC entry opens a movable dialog backed by the complete assistant", () => {
    assert.match(desktopSource, /<el-dialog[\s\S]*?draggable[\s\S]*?destroy-on-close/);
    assert.match(desktopSource, /data-testid="desktop-ai-dialog-drag-handle"/);
    assert.match(desktopSource, /<MobileAiAssistant embedded @close="closeAssistant"\s*\/>/);
    assert.match(desktopSource, /height:\s*min\(720px, calc\(100vh - 140px\)\)/);
    assert.match(assistantSource, /defineProps\(\{[\s\S]*embedded:/);
    assert.match(assistantSource, /if \(embedded\.value\)[\s\S]*emit\("close"\)/);
    assert.match(assistantSource, /\.mobile-ai-page--embedded \.mobile-ai-history-mask[\s\S]*position:\s*absolute/);
});
