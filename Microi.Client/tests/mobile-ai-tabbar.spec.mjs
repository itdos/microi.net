import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    createMobileAiAssistantRoute,
    isMobileAiAssistantEnabled
} from "../src/components/MobileTabBar/mobile-ai-entry.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const componentSource = fs.readFileSync(
    path.resolve(testDir, "../src/components/MobileTabBar/index.vue"),
    "utf8"
);
const designSource = fs.readFileSync(
    path.resolve(testDir, "../src/styles/mci-design.scss"),
    "utf8"
);
const clientRobot = fs.readFileSync(
    path.resolve(testDir, "../public/static/mci/ai/assistant-robot.png")
);
const miniappRobot = fs.readFileSync(
    path.resolve(testDir, "../../microi.uniapp/src/static/mci/ai/assistant-robot.png")
);

test("AI entry is enabled by default and only an explicit negative switch hides it", () => {
    assert.equal(isMobileAiAssistantEnabled(), true);
    assert.equal(isMobileAiAssistantEnabled({}), true);
    assert.equal(isMobileAiAssistantEnabled({ DisableAiAssistant: 0 }), true);
    assert.equal(isMobileAiAssistantEnabled({ DisableAiAssistant: "0" }), true);
    assert.equal(isMobileAiAssistantEnabled({ DisableAiAssistant: false }), true);
    assert.equal(isMobileAiAssistantEnabled({ DisableAiAssistant: 1 }), false);
    assert.equal(isMobileAiAssistantEnabled({ DisableAiAssistant: "1" }), false);
    assert.equal(isMobileAiAssistantEnabled({ DisableAiAssistant: true }), false);
    assert.equal(isMobileAiAssistantEnabled({ DisableAiAssistant: "true" }), false);
    assert.equal(isMobileAiAssistantEnabled({ IsShowAiAssistant: 0 }), false);
    assert.equal(isMobileAiAssistantEnabled({ IsShowAiAssistant: 1 }), true);
});

test("AI entry targets the dedicated data assistant page", () => {
    assert.deepEqual(createMobileAiAssistantRoute(), {
        path: "/mobile/ai-assistant"
    });
});

test("tabbar keeps the AI control in a separate safe-area-aware touch slot", () => {
    assert.match(componentSource, /class="mobile-tabbar-shell"/);
    assert.match(componentSource, /<nav class="mobile-tabbar"/);
    assert.match(componentSource, /class="mobile-ai-entry"/);
    assert.match(componentSource, /data-testid="mobile-ai-entry"/);
    assert.match(componentSource, /v-if="aiAssistantEnabled"/);
    assert.match(componentSource, /aria-label="打开AI助手"/);
    assert.match(componentSource, /src="\/static\/mci\/ai\/assistant-robot\.png"/);
    assert.doesNotMatch(componentSource, /<Avatar|mobile-ai-entry__spark/);
    assert.deepEqual(clientRobot, miniappRobot, "Client must use the exact same robot bitmap as UniApp");
    assert.match(componentSource, /var\(--mci-safe-bottom/);
    assert.match(componentSource, /min-height:\s*54px/);
    assert.match(designSource, /--mci-tabbar-height:\s*62px/, "page content reserves the complete separated bar height");
});
