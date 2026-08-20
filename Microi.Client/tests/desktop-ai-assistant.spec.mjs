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
const aiEngineSource = fs.readFileSync(
    path.resolve(testDir, "../src/views/ai-engine/index.vue"),
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

test("PC entry opens a movable dialog backed by the unified AI core", () => {
    assert.match(desktopSource, /<el-dialog[\s\S]*?draggable[\s\S]*?destroy-on-close/);
    assert.match(desktopSource, /data-testid="desktop-ai-dialog-drag-handle"/);
    assert.match(desktopSource, /<AiEngine embedded\s*\/>/);
    assert.match(desktopSource, /height:\s*min\(760px, calc\(100vh - 140px\)\)/);
    assert.match(aiEngineSource, /data-testid="unified-ai-assistant"/);
    assert.match(aiEngineSource, /data-testid="unified-ai-history"/);
    assert.match(aiEngineSource, /data-testid="unified-ai-new-conversation"/);
    assert.match(aiEngineSource, /data-testid="unified-ai-history-archived"/);
    assert.match(aiEngineSource, /value:\s*"secure-data"/);
    assert.match(aiEngineSource, /sendMobileAiQuestion/);
    assert.match(aiEngineSource, /sendChatStream/);
    assert.match(aiEngineSource, /sendDataQuestion/);
    assert.match(aiEngineSource, /sendCodeQuestion/);
    assert.match(aiEngineSource, /sendBuilderQuestion/);
});

test("unified core preserves both conversation protocols and security boundaries", () => {
    assert.match(aiEngineSource, /const SOURCE = "ai-engine-workbench"/);
    assert.match(aiEngineSource, /const SECURE_DATA_SOURCE = "mci-ai-data-assistant"/);
    assert.match(aiEngineSource, /loadMobileAiBootstrap/);
    assert.match(aiEngineSource, /listMobileAiConversations/);
    assert.match(aiEngineSource, /listMobileAiMessages/);
    assert.match(aiEngineSource, /renameMobileAiConversation/);
    assert.match(aiEngineSource, /setMobileAiConversationArchived/);
    assert.match(aiEngineSource, /\/api\/Ai\/ChatStream/);
    assert.match(aiEngineSource, /\/api\/Ai\/NL2SQL/);
    assert.match(aiEngineSource, /\/api\/Ai\/NL2V8Engine/);
    assert.match(aiEngineSource, /内容由人工智能生成，请注意甄别/);
    assert.match(aiEngineSource, /数据权限已校验/);
    assert.match(aiEngineSource, /secureAssistantFailure\.description/);
    assert.match(aiEngineSource, /classifyMobileAiBootstrapFailure\(error\)/);
    assert.match(aiEngineSource, /安全业务数据：\{\{ secureAssistantFailure\.description \}\}/);
    assert.match(aiEngineSource, /title:\s*text,[\s\S]*?desc:\s*`查询范围：\$\{secureAssistantScopeLabel\.value\}`/);
    assert.doesNotMatch(aiEngineSource, /title:\s*`安全数据分析\$\{/);
});

test("unified core renders safe Markdown and keeps the assistant chrome quiet", () => {
    const markdownSource = fs.readFileSync(
        path.resolve(testDir, "../src/utils/ai-markdown.js"),
        "utf8"
    );
    assert.match(markdownSource, /marked\.parse\(String\(value\), MARKDOWN_OPTIONS\)/);
    assert.match(markdownSource, /sanitizeHtml\(/);
    assert.match(aiEngineSource, /v-safe-html="renderAiMarkdown\(message\.content\)"/);
    assert.doesNotMatch(aiEngineSource, /<pre v-if="message\.content"/);
    assert.match(aiEngineSource, /\.slice\(0, 4\)/);
    assert.match(aiEngineSource, /class="quick-prompt-content"/);
    assert.match(aiEngineSource, /class="composer-settings-trigger"/);
    assert.match(aiEngineSource, /data-testid="unified-ai-settings"/);
    assert.match(aiEngineSource, /popper-class="ai-composer-settings-popper"/);
});
